"use server";

import { isValidObjectId } from "mongoose";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PUBLISHED_STATUSES, revalidateArchive } from "@/lib/archive-data";
import { requireMigma } from "@/lib/auth";
import { isSendingEnabled } from "@/lib/config";
import { getScheduleProblem } from "@/lib/schedule";
import { checkDesign, scheduleSend, sendNow, sendTestEmail, startDesign, syncCampaign, unschedule } from "@/lib/sending";
import { ARCHIVE_SLUG_PATTERN } from "@/lib/slug";
import { firstImageUrl } from "@/lib/thumbnail";
import { MAX_BODY_BYTES, normalizeEmail } from "@/lib/validation";
import Account from "@/models/Account";
import Campaign from "@/models/Campaign";
import Newsletter from "@/models/Newsletter";

const MAX_SUBJECT_LENGTH = 200;
const MAX_PROMPT_LENGTH = 4000;
const COPY_SUFFIX = " (copy)";

// Every campaign and newsletter is looked up with the signed-in account's id.
async function findCampaign(id) {
	const context = await requireMigma();
	if (!isValidObjectId(id)) return { ...context, campaign: null };
	const campaign = await Campaign.findOne({ _id: id, accountId: context.accountId }).lean();
	return { ...context, campaign };
}

async function findNewsletter(accountId, newsletterId) {
	if (!isValidObjectId(newsletterId)) return null;
	return Newsletter.findOne({ _id: newsletterId, accountId }).lean();
}

// Sending errors become toasts; a thrown error would replace the page with the error boundary.
async function run(task) {
	try {
		return (await task()) ?? { ok: true };
	} catch (error) {
		console.error("[campaigns]", error);
		return { error: error.message || "Something went wrong" };
	}
}

function revalidateCampaign(id) {
	revalidatePath("/");
	revalidatePath("/campaigns");
	revalidatePath(`/campaigns/${id}`);
}

export async function createCampaign(newsletterId) {
	const { accountId } = await requireMigma();
	if (!(await findNewsletter(accountId, newsletterId))) return { error: "Newsletter not found" };
	const campaign = await Campaign.create({ accountId, newsletterId });
	revalidatePath("/campaigns");
	redirect(`/campaigns/${campaign._id}`);
}

// Migma writes and designs the issue on the newsletter's brand; the draft fills in when it's done.
export async function createDesignedCampaign(newsletterId, prompt) {
	const { accountId, migma } = await requireMigma();
	const newsletter = await findNewsletter(accountId, newsletterId);
	if (!newsletter) return { error: "Newsletter not found" };
	const brief = String(prompt ?? "").trim();
	if (brief.length < 10) return { error: "Say a little more about this issue" };
	if (brief.length > MAX_PROMPT_LENGTH) return { error: `Keep it under ${MAX_PROMPT_LENGTH} characters` };

	const result = await run(async () => {
		const designing = await startDesign(migma, { newsletter, prompt: brief });
		const campaign = await Campaign.create({ accountId, newsletterId, format: "html", source: "migma", migma: { designing } });
		return { id: String(campaign._id) };
	});
	if (result.error) return result;
	revalidatePath("/campaigns");
	redirect(`/campaigns/${result.id}`);
}

export async function checkCampaignDesign(id) {
	const { migma, campaign } = await findCampaign(id);
	if (!campaign) return { error: "Campaign not found" };
	return run(() => checkDesign(migma, campaign));
}

// The status check is part of the write, so a save can't land on a campaign that is going out.
export async function saveCampaign(id, values) {
	const { accountId, campaign } = await findCampaign(id);
	if (!campaign) return { error: "Campaign not found" };
	if (campaign.status !== "draft") return { error: "Unschedule it to edit" };

	const body = String(values?.body ?? "");
	const bytes = Buffer.byteLength(body, "utf8");
	if (bytes > MAX_BODY_BYTES) {
		return { error: `The content is ${Math.ceil(bytes / 1000)} KB. The limit is ${MAX_BODY_BYTES / 1000} KB.` };
	}

	// The editor opens Markdown drafts as rich text, so their first save moves them to it.
	const format = campaign.format === "markdown" ? "rich" : campaign.format;
	const thumbnailUrl = firstImageUrl({ format, html: body });
	const { matchedCount } = await Campaign.updateOne(
		{ _id: campaign._id, accountId, status: "draft" },
		{
			$set: {
				subject: String(values?.subject ?? "").slice(0, MAX_SUBJECT_LENGTH),
				previewText: String(values?.previewText ?? "").slice(0, 300),
				format,
				html: body,
				...(thumbnailUrl && { thumbnailUrl }),
			},
			...(!thumbnailUrl && { $unset: { thumbnailUrl: 1 } }),
		}
	);
	if (!matchedCount) return { error: "This campaign is already going out" };

	revalidatePath("/campaigns");
	return { ok: true };
}

export async function sendTestCampaign(id, to) {
	const { account, accountId, migma, campaign } = await findCampaign(id);
	if (!campaign) return { error: "Campaign not found" };
	if (!isSendingEnabled()) return { error: "Sending is off" };
	const email = normalizeEmail(to);
	if (!email) return { error: "Enter the address to send the test to" };
	const newsletter = await findNewsletter(accountId, campaign.newsletterId);

	const result = await run(() => sendTestEmail(migma, { campaign, newsletter, to: email }));
	if (result.ok && account.testEmail !== email) await Account.updateOne({ accountId }, { $set: { testEmail: email } });
	revalidatePath(`/campaigns/${id}`);
	return result;
}

export async function sendCampaign(id) {
	const { accountId, migma, campaign } = await findCampaign(id);
	if (!campaign) return { error: "Campaign not found" };
	if (!["draft", "scheduled"].includes(campaign.status)) return { error: "Already sent" };
	if (!isSendingEnabled()) return { error: "Sending is off" };
	const newsletter = await findNewsletter(accountId, campaign.newsletterId);

	const result = await run(() => sendNow(migma, { campaign, newsletter }));
	revalidateCampaign(id);
	if (!result.error) revalidateArchive();
	return result;
}

export async function scheduleCampaign(id, { scheduledAt } = {}) {
	const { accountId, migma, campaign } = await findCampaign(id);
	if (!campaign) return { error: "Campaign not found" };
	if (!["draft", "scheduled"].includes(campaign.status)) return { error: "Already sent" };
	if (!isSendingEnabled()) return { error: "Sending is off" };

	const at = new Date(scheduledAt ?? NaN);
	const problem = getScheduleProblem(at);
	if (problem) return { error: problem };
	const newsletter = await findNewsletter(accountId, campaign.newsletterId);

	const result = await run(() => scheduleSend(migma, { campaign, newsletter, scheduledAt: at }));
	revalidateCampaign(id);
	return result;
}

export async function unscheduleCampaign(id) {
	const { migma, campaign } = await findCampaign(id);
	if (!campaign) return { error: "Campaign not found" };
	if (campaign.status !== "scheduled") return { error: "It isn't scheduled anymore" };

	const result = await run(async () => {
		if (!(await unschedule(migma, campaign))) throw new Error("It isn't scheduled anymore");
	});
	revalidateCampaign(id);
	return result;
}

export async function refreshCampaign(id) {
	const { migma, campaign } = await findCampaign(id);
	if (!campaign) return { error: "Campaign not found" };
	const result = await run(() => syncCampaign(migma, campaign).then(() => undefined));
	revalidatePath(`/campaigns/${id}`);
	return result;
}

export async function toggleArchivePin(id) {
	const { accountId, campaign } = await findCampaign(id);
	if (!campaign) return { error: "Campaign not found" };
	if (!campaign.archiveSlug || campaign.archiveListed === false) return { error: "Not listed on the archive" };

	await Campaign.updateOne({ _id: campaign._id, accountId }, { $set: { archivePinned: !campaign.archivePinned } });
	revalidatePath(`/campaigns/${id}`);
	revalidateArchive();
	return { ok: true };
}

export async function duplicateCampaign(id) {
	const { accountId, campaign } = await findCampaign(id);
	if (!campaign) return { error: "Campaign not found" };

	const copy = await Campaign.create({
		accountId,
		newsletterId: campaign.newsletterId,
		subject: campaign.subject ? `${campaign.subject.slice(0, MAX_SUBJECT_LENGTH - COPY_SUFFIX.length)}${COPY_SUFFIX}` : "",
		previewText: campaign.previewText,
		format: campaign.format,
		markdown: campaign.markdown,
		html: campaign.html,
		thumbnailUrl: campaign.thumbnailUrl,
		...(campaign.source === "migma" && { source: "migma" }),
	});
	revalidatePath("/campaigns");
	redirect(`/campaigns/${copy._id}`);
}

// Discarded campaigns keep everything: canceled hides them from the lists. A scheduled one is
// cancelled in Migma first, so it can't still go out.
export async function discardCampaign(id) {
	const { accountId, migma, campaign } = await findCampaign(id);
	if (!campaign) return { error: "Campaign not found" };
	if (!["draft", "scheduled"].includes(campaign.status)) return { error: "Only drafts can be discarded" };

	const result = await run(async () => {
		if (campaign.status === "scheduled" && !(await unschedule(migma, campaign))) {
			throw new Error("This campaign is already going out");
		}
		const { matchedCount } = await Campaign.updateOne(
			{ _id: campaign._id, accountId, status: "draft" },
			{ $set: { status: "canceled" }, $unset: { scheduledAt: 1 } }
		);
		if (!matchedCount) throw new Error("This campaign is already going out");
	});
	revalidateCampaign(id);
	return result;
}

// The page lives at /p/<slug> once the issue goes out. A draft without one gets the subject's slug then.
// Slugs are unique across newsletters: /p/<slug> on the app's own domain finds an issue by slug alone.
export async function updateArchiveSlug(id, value) {
	const { accountId, campaign } = await findCampaign(id);
	if (!campaign || campaign.status === "canceled") return { error: "Campaign not found" };

	const slug = String(value ?? "").trim().toLowerCase().replace(/-+$/, "");
	const isPublished = PUBLISHED_STATUSES.includes(campaign.status);
	if (!slug && isPublished) return { error: "A sent issue needs a URL" };
	if (slug && !ARCHIVE_SLUG_PATTERN.test(slug)) return { error: "Use lowercase letters, digits and hyphens" };
	if (slug === (campaign.archiveSlug ?? "")) return { ok: true, archiveSlug: slug };
	if (slug && (await Campaign.exists({ _id: { $ne: campaign._id }, archiveSlug: slug }))) {
		return { error: "Another issue uses this URL" };
	}

	try {
		await Campaign.updateOne(
			{ _id: campaign._id, accountId },
			slug ? { $set: { archiveSlug: slug } } : { $unset: { archiveSlug: 1 } }
		);
	} catch (error) {
		if (error?.code === 11000) return { error: "Another issue uses this URL" };
		throw error;
	}

	revalidatePath(`/campaigns/${id}`);
	if (isPublished) {
		revalidatePath("/campaigns");
		revalidateArchive();
	}
	return { ok: true, archiveSlug: slug };
}
