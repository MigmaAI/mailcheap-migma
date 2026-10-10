"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { revalidateArchive } from "@/lib/archive-data";
import { requireMigma } from "@/lib/auth";
import { createNewsletter, isSlugTaken, updateNewsletter } from "@/lib/data/newsletters";
import { toBrandWebsite } from "@/lib/brands";
import { MigmaRequestError, ensureListTag, getBrandImport, listBrands, retryBrandImport, startBrandImport } from "@/lib/migma";
import { MAX_AUTHOR_BIO_LENGTH, MAX_DESCRIPTION_LENGTH } from "@/lib/newsletters";
import { parseSocialLinks } from "@/lib/social";
import { isObjectIdString } from "@/lib/validation";

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IMAGE_URL_PATTERN = /^(https:\/\/[^\s"'<>]{4,490}|\/[\w\-./]{1,200})$/;

function readText(formData, key) {
	return String(formData.get(key) ?? "").trim();
}

function readNewsletter(formData) {
	return {
		name: readText(formData, "name"),
		slug: readText(formData, "slug").toLowerCase(),
		imageUrl: readText(formData, "imageUrl"),
		fromName: readText(formData, "fromName"),
		fromEmail: readText(formData, "fromEmail").toLowerCase(),
		replyTo: readText(formData, "replyTo").toLowerCase(),
		postalAddress: readText(formData, "postalAddress"),
		archiveEnabled: formData.get("archiveEnabled") === "on",
		description: readText(formData, "description"),
		author: { bio: readText(formData, "authorBio"), imageUrl: readText(formData, "authorImageUrl") },
		socialLinks: parseSocialLinks(formData.get("socialLinks")),
	};
}

function validateNewsletter(values) {
	if (!values.name) return "Name is required";
	if (!SLUG_PATTERN.test(values.slug)) return "Slug can only use lowercase letters, numbers and dashes";
	if (values.imageUrl && !IMAGE_URL_PATTERN.test(values.imageUrl)) {
		return "Image must be an https:// link or a path like /logos/name.webp";
	}
	if (!EMAIL_PATTERN.test(values.fromEmail)) return "From email is invalid";
	if (values.replyTo && !EMAIL_PATTERN.test(values.replyTo)) return "Reply-to email is invalid";
	if (!values.postalAddress) return "Add a postal address: anti-spam laws require one in every email";
	if (values.description.length > MAX_DESCRIPTION_LENGTH) {
		return `Keep the description under ${MAX_DESCRIPTION_LENGTH} characters`;
	}
	if (values.author.bio.length > MAX_AUTHOR_BIO_LENGTH) {
		return `Keep the author bio under ${MAX_AUTHOR_BIO_LENGTH} characters`;
	}
	if (values.author.imageUrl && !IMAGE_URL_PATTERN.test(values.author.imageUrl)) {
		return "Author photo must be an https:// link or a path like /authors/name.jpg";
	}
	return values.socialLinks.error ?? null;
}

// A new newsletter gets its own list (a tag) on the chosen Migma brand. The brand can't change later:
// the subscribers are contacts on it.
async function createInMigma(migma, { projectId, name }) {
	const brand = (await listBrands(migma)).find(({ id }) => id === projectId);
	if (!brand) throw new Error("Pick a brand from your Migma account");
	if (brand.importing) throw new Error(`Migma is still reading ${brand.domain || brand.name}. Try again in a minute.`);
	const tag = await ensureListTag(migma, { projectId, name });
	return { refs: { projectId, tagId: String(tag.id) }, brand };
}

export async function saveNewsletter(_state, formData) {
	const { accountId, migma } = await requireMigma();
	const id = readText(formData, "id");
	if (id && !isObjectIdString(id)) return { error: "Newsletter not found" };

	const values = readNewsletter(formData);
	const error = validateNewsletter(values);
	if (error) return { error };
	const document = { ...values, socialLinks: values.socialLinks.links };

	let createdId;
	try {
		if (id) {
			if (!(await updateNewsletter(accountId, id, document))) return { error: "Newsletter not found" };
		} else {
			if (await isSlugTaken(document.slug)) return { error: "This slug is already used" };
			const { refs, brand } = await createInMigma(migma, { projectId: readText(formData, "projectId"), name: values.name });
			// Without an image of its own, the newsletter shows its brand's logo.
			const imageUrl = document.imageUrl || (brand.logoUrl?.startsWith("https://") ? brand.logoUrl : "");
			createdId = await createNewsletter({ ...document, imageUrl, accountId, migma: refs });
		}
	} catch (error) {
		if (/UNIQUE constraint failed/.test(error?.message)) return { error: "This slug is already used" };
		console.error("[newsletters] Save failed:", error);
		return { error: error.message || "Couldn't save the newsletter" };
	}

	revalidatePath("/newsletters");
	revalidateArchive();
	if (createdId) redirect(`/newsletters/${createdId}`);
	return { ok: true, savedAt: Date.now() };
}

// Migma's refusal in its own words (a plan's brand limit, a rate limit), or a plain fallback.
function describeBrandError(error, fallback) {
	if (error instanceof MigmaRequestError && error.status === 403) return error.reason || fallback;
	return error?.message || fallback;
}

// Creates a brand in the account's Migma workspace from its website. The import runs in Migma;
// checkBrand reports when it's ready.
export async function createBrand(_state, formData) {
	const { migma } = await requireMigma();
	const website = toBrandWebsite(formData.get("website"));
	if (!website) return { error: "Enter your website, like acme.com" };
	try {
		const host = new URL(website).hostname.replace(/^www\./, "");
		return { projectId: await startBrandImport(migma, website), website: host };
	} catch (error) {
		console.error("[brands] Import failed to start:", error);
		return { error: describeBrandError(error, "Migma couldn't start reading that website") };
	}
}

export async function checkBrand(projectId) {
	if (!isObjectIdString(projectId)) return { status: "error", error: "Brand not found" };
	const { migma } = await requireMigma();
	try {
		const result = await getBrandImport(migma, projectId);
		if (result.status === "active") revalidatePath("/newsletters/new");
		return result;
	} catch (error) {
		// A dropped check isn't a failed import: the next check asks again.
		return { status: "unknown", error: describeBrandError(error, "Migma didn't answer") };
	}
}

export async function retryBrand(projectId) {
	if (!isObjectIdString(projectId)) return { error: "Brand not found" };
	const { migma } = await requireMigma();
	try {
		await retryBrandImport(migma, projectId);
		return { ok: true };
	} catch (error) {
		return { error: describeBrandError(error, "Migma couldn't retry this brand") };
	}
}
