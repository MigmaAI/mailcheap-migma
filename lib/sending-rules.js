import { getArchiveUrls } from "./archive-hosts.js";
import { LIMITS } from "./config.js";
import { hasContent, renderEmail } from "./render-email.js";
import { slugify } from "./slug.js";

// Issues link to their archive page. A draft has no slug yet, so its test email links to the one
// the subject gives when it goes out.
export function getIssueWebUrl({ campaign, newsletter }) {
	if (!newsletter?.archiveEnabled || !newsletter.slug || !campaign?._id || campaign.archiveListed === false) return null;
	const slug = campaign.archiveSlug || slugify(campaign.subject, 80);
	return slug ? getArchiveUrls(newsletter).absolutePost(slug) : null;
}

// The HTML Migma turns into the email it sends. Subject and preview text go on the Migma campaign
// itself, so the preheader stays out of the body. {{unsubscribe_url}} is Migma's own variable: Migma
// fills in each reader's link and adds the one-click List-Unsubscribe headers.
export function buildIssueHtml({ campaign, newsletter }) {
	return renderEmail({
		format: campaign.format,
		markdown: campaign.markdown,
		html: campaign.html,
		subject: campaign.subject,
		previewText: "",
		newsletter,
		webUrl: getIssueWebUrl({ campaign, newsletter }),
	});
}

export function getSendProblem({ campaign, newsletter }) {
	if (!newsletter) return "Newsletter not found";
	if (!newsletter.fromEmail) return "Add a from email to the newsletter";
	if (!newsletter.postalAddress?.trim()) return "Add a postal address to the newsletter";
	if (!campaign?.subject?.trim()) return "Add a subject";
	if (!hasContent(campaign.format === "markdown" ? campaign.markdown : campaign.html)) return "Add content";

	const { bytes } = buildIssueHtml({ campaign, newsletter });
	if (bytes > LIMITS.maxEmailBytes) {
		return `The email is ${Math.ceil(bytes / 1000)} KB. Gmail clips emails over 100 KB.`;
	}
	return null;
}

// Migma's campaign statuses in this app's terms. Migma checks first sends from new accounts and large
// sends before they go out: that's review.
const MIGMA_STATUSES = {
	draft: "draft",
	scheduled: "scheduled",
	pending_review: "review",
	sending: "sending",
	throttled: "sending",
	sent: "sent",
	failed: "failed",
	cancelled: "canceled",
};

export function toCampaignStatus(migmaStatus) {
	return MIGMA_STATUSES[migmaStatus] ?? null;
}

export function toCampaignStats(stats) {
	return {
		recipients: stats?.totalSent ?? 0,
		delivered: stats?.totalDelivered ?? 0,
		opened: stats?.uniqueOpens ?? 0,
		clicked: stats?.uniqueClicks ?? 0,
		bounced: stats?.bounces ?? 0,
		unsubscribed: stats?.unsubscribes ?? 0,
	};
}

// Polls a Migma preparation until it finishes or the wait runs out (then null), so one request never
// hangs for minutes. `getStatus` returns Migma's generation status.
export async function waitForPreparation(getStatus, { waitMs, intervalMs, now = Date.now, sleep }) {
	const deadline = now() + waitMs;
	for (;;) {
		const status = await getStatus();
		if (status?.status === "completed" || status?.status === "failed") return status;
		if (now() + intervalMs > deadline) return null;
		await sleep(intervalMs);
	}
}
