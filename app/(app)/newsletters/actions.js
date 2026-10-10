"use server";

import { isValidObjectId } from "mongoose";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { revalidateArchive } from "@/lib/archive-data";
import { requireMigma } from "@/lib/auth";
import { ensureListTag, listBrands } from "@/lib/migma";
import { MAX_AUTHOR_BIO_LENGTH, MAX_DESCRIPTION_LENGTH } from "@/lib/newsletters";
import { parseSocialLinks } from "@/lib/social";
import Newsletter from "@/models/Newsletter";

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
	const brands = await listBrands(migma);
	if (!brands.some(({ id }) => id === projectId)) throw new Error("Pick a brand from your Migma account");
	const tag = await ensureListTag(migma, { projectId, name });
	return { projectId, tagId: String(tag.id) };
}

export async function saveNewsletter(_state, formData) {
	const { accountId, migma } = await requireMigma();
	const id = readText(formData, "id");
	if (id && !isValidObjectId(id)) return { error: "Newsletter not found" };

	const values = readNewsletter(formData);
	const error = validateNewsletter(values);
	if (error) return { error };
	const document = { ...values, socialLinks: values.socialLinks.links };

	let createdId;
	try {
		if (id) {
			const { matchedCount } = await Newsletter.updateOne({ _id: id, accountId }, { $set: document }, { runValidators: true });
			if (!matchedCount) return { error: "Newsletter not found" };
		} else {
			if (await Newsletter.exists({ slug: document.slug })) return { error: "This slug is already used" };
			const migmaRefs = await createInMigma(migma, { projectId: readText(formData, "projectId"), name: values.name });
			createdId = (await Newsletter.create({ ...document, accountId, migma: migmaRefs }))._id.toString();
		}
	} catch (error) {
		if (error?.code === 11000) return { error: "This slug is already used" };
		console.error("[newsletters] Save failed:", error);
		return { error: error.message || "Couldn't save the newsletter" };
	}

	revalidatePath("/newsletters");
	revalidateArchive();
	if (createdId) redirect(`/newsletters/${createdId}`);
	return { ok: true, savedAt: Date.now() };
}
