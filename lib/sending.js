import "server-only";
import crypto from "node:crypto";
import { assignArchiveSlug } from "@/lib/archive-slugs";
import { isSendingEnabled } from "@/lib/config";
import { call } from "@/lib/migma";
import { buildIssueHtml, getSendProblem, toCampaignStats, toCampaignStatus, waitForPreparation } from "@/lib/sending-rules";
import { claimCampaign, getCampaign, listStaleCampaigns, updateCampaign } from "@/lib/data/campaigns";

// Migma sends emails it made itself, so an issue becomes a Migma email first. Migma rewrites the HTML
// in its own format; this asks it to keep everything as written.
const KEEP_AS_WRITTEN =
	"Keep this newsletter issue exactly as written: the same words, links, images, order and footer. Keep the {{unsubscribe_url}} link and the postal address in the footer. Don't add, remove or restyle sections.";
// Preparing usually takes Migma under a minute. One request waits this long; the next attempt picks the
// same preparation up instead of starting another.
const PREPARE_WAIT = { waitMs: 75_000, intervalMs: 3000, sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) };
const STILL_PREPARING = "Migma is still preparing this email. It can take a minute or two; try again shortly.";
const LIVE_STATUSES = ["scheduled", "review", "sending", "sent"];
const STATS_MAX_AGE_MS = 5 * 60 * 1000;

function assertSendingEnabled() {
	if (!isSendingEnabled()) throw new Error("Sending is off");
}

function hashOf(value) {
	return crypto.createHash("sha256").update(value).digest("hex");
}

function scope(campaign) {
	return { id: campaign._id, accountId: campaign.accountId };
}

// One key per attempt: the SDK reuses it across its own retries, so a retried request can't run twice.
// Repeat clicks are stopped by the status claims below, not by the key: a key reused across attempts
// would replay a failed import or a campaign since cancelled.
function attemptKey(kind, campaign) {
	return `mailcheap-${kind}-${campaign._id}-${crypto.randomUUID()}`;
}

// An issue Migma designed (startDesign) is already a Migma email while its HTML is untouched.
function isUntouchedDesign(campaign) {
	return campaign.format === "html" && Boolean(campaign.migma?.emailId) && campaign.html === campaign.migma.html;
}

function pickEmail(status) {
	return status.result?.emails?.find(({ emailId, status: emailStatus }) => emailId && emailStatus !== "failed") ?? null;
}

// The Migma email for the issue as it is now, made once per version of its content.
export async function prepareIssue(migma, campaign, newsletter) {
	const problem = getSendProblem({ campaign, newsletter });
	if (problem) throw new Error(problem);
	if (isUntouchedDesign(campaign) && /unsubscribe/i.test(campaign.migma.html)) return campaign.migma;

	const { html } = buildIssueHtml({ campaign, newsletter });
	const contentHash = hashOf(html);
	if (campaign.migma?.emailId && campaign.migma.contentHash === contentHash) return campaign.migma;

	// No email id but this version's hash: an earlier attempt started preparing it. Wait for that one.
	let conversationId =
		!campaign.migma?.emailId && campaign.migma?.contentHash === contentHash ? campaign.migma.conversationId : null;
	if (!conversationId) {
		const started = await call(
			migma.emails.importHtml(
				{
					projectId: newsletter.migma.projectId,
					html,
					name: `${newsletter.slug}.html`,
					instruction: KEEP_AS_WRITTEN,
					generateMedia: false,
				},
				{ idempotencyKey: attemptKey("import", campaign) }
			)
		);
		conversationId = started.conversationId;
		await updateCampaign(scope(campaign), {
			"migma.conversationId": conversationId,
			"migma.contentHash": contentHash,
			"migma.emailId": null,
		});
	}

	const status = await waitForPreparation(() => call(migma.emails.getGenerationStatus(conversationId)), PREPARE_WAIT);
	if (!status) throw new Error(STILL_PREPARING);
	const email = status.status === "completed" ? pickEmail(status) : null;
	const prepared = email && { contentHash, conversationId, emailId: email.emailId, html: email.html || status.result?.html };
	// Migma fills in each reader's unsubscribe link, but only where the email still has one.
	const failure = !email
		? status.error || "Migma couldn't prepare the email. Try again."
		: !/unsubscribe/i.test(prepared.html ?? "")
			? "Migma's version of the email lost its unsubscribe link. Try again, or simplify the footer."
			: null;
	if (failure) {
		// A preparation that didn't work isn't picked up again: the next attempt starts a new one.
		await updateCampaign(scope(campaign), { "migma.conversationId": null, "migma.contentHash": null });
		throw new Error(failure);
	}

	await updateCampaign(scope(campaign), {
		"migma.contentHash": prepared.contentHash,
		"migma.conversationId": prepared.conversationId,
		"migma.emailId": prepared.emailId,
		"migma.html": prepared.html,
		"migma.error": null,
	});
	return prepared;
}

export async function sendTestEmail(migma, { campaign, newsletter, to }) {
	assertSendingEnabled();
	const prepared = await prepareIssue(migma, campaign, newsletter);
	await call(migma.emails.sendTest({ emailId: prepared.emailId, to }));
	await updateCampaign(scope(campaign), { testSentAt: new Date() });
}

// The archive slug comes first: the email's "Read online" link points at it.
async function readyToSend(migma, campaign, newsletter) {
	const problem = getSendProblem({ campaign, newsletter });
	if (problem) throw new Error(problem);
	await assignArchiveSlug({ campaign, newsletter });
	const current = await getCampaign(campaign.accountId, campaign._id);
	return { current, prepared: await prepareIssue(migma, current, newsletter) };
}

// A Migma campaign is reused only while it sends the current email: a draft edited after a failed send
// gets a new one.
async function ensureMigmaCampaign(migma, { campaign, newsletter, prepared }) {
	if (campaign.migma?.campaignId && campaign.migma.campaignEmailId === prepared.emailId) return campaign.migma.campaignId;
	const created = await call(
		migma.campaigns.create(
			{
				projectId: newsletter.migma.projectId,
				name: `${newsletter.name}: ${campaign.subject}`.slice(0, 200),
				conversationId: prepared.conversationId,
				emailId: prepared.emailId,
				subject: campaign.subject,
				...(campaign.previewText && { preheaderText: campaign.previewText }),
				from: newsletter.fromEmail,
				fromName: newsletter.fromName || newsletter.name,
				...(newsletter.replyTo && { replyTo: newsletter.replyTo }),
				recipientType: "tag",
				recipientId: newsletter.migma.tagId,
			},
			{ idempotencyKey: attemptKey("campaign", campaign) }
		)
	);
	await updateCampaign(scope(campaign), { "migma.campaignId": created.id, "migma.campaignEmailId": prepared.emailId });
	return created.id;
}

// A failed hand-off puts the campaign back as it was, with Migma's reason.
async function restore(campaign, previous, error) {
	await updateCampaign(
		{ ...scope(campaign), status: ["sending", "scheduled"] },
		{ status: previous.status, scheduledAt: previous.scheduledAt ?? null, "migma.error": String(error?.message ?? error).slice(0, 300) }
	);
}

export async function sendNow(migma, { campaign, newsletter }) {
	assertSendingEnabled();
	const { current, prepared } = await readyToSend(migma, campaign, newsletter);
	// Only a draft or a scheduled issue goes out, and only once.
	const previous = await claimCampaign(
		{ ...scope(current), from: ["draft", "scheduled"] },
		{ status: "sending", scheduledAt: null, "migma.error": null }
	);
	if (!previous) throw new Error("This campaign changed, refresh and try again");

	try {
		const campaignId = await ensureMigmaCampaign(migma, { campaign: previous, newsletter, prepared });
		const sent = await call(migma.campaigns.send(campaignId, { idempotencyKey: attemptKey("send", current) }));
		const status = toCampaignStatus(sent?.status) ?? "sending";
		await updateCampaign(scope(current), {
			status: status === "draft" ? "sending" : status,
			startedAt: new Date(),
			...(status === "sent" && { sentAt: new Date() }),
		});
		return { status };
	} catch (error) {
		await restore(current, previous, error);
		throw error;
	}
}

export async function scheduleSend(migma, { campaign, newsletter, scheduledAt }) {
	assertSendingEnabled();
	const { current, prepared } = await readyToSend(migma, campaign, newsletter);
	const previous = await claimCampaign(
		{ ...scope(current), from: ["draft", "scheduled"] },
		{ status: "scheduled", scheduledAt, "migma.error": null }
	);
	if (!previous) throw new Error("This campaign changed, refresh and try again");

	try {
		const campaignId = await ensureMigmaCampaign(migma, { campaign: previous, newsletter, prepared });
		await call(migma.campaigns.schedule(campaignId, { scheduledAt: scheduledAt.toISOString() }));
	} catch (error) {
		await restore(current, previous, error);
		throw error;
	}
}

// Back to a draft. Migma can't reuse a cancelled campaign, so the next send makes a new one.
export async function unschedule(migma, campaign) {
	if (campaign.migma?.campaignId) await call(migma.campaigns.cancel(campaign.migma.campaignId));
	const changed = await updateCampaign(
		{ ...scope(campaign), status: "scheduled" },
		{ status: "draft", scheduledAt: null, "migma.campaignId": null, "migma.campaignEmailId": null }
	);
	return changed > 0;
}

// Saves what Migma reports for a campaign: its status, send time and numbers. Stats can be briefly
// unavailable; the last ones stay until then.
async function saveRemote(campaign, remote, remoteStats) {
	const remoteStatus = toCampaignStatus(remote?.status);
	const status = remoteStatus && remoteStatus !== "draft" ? remoteStatus : campaign.status;
	const update = { status, ...(remote?.sentAt && { sentAt: new Date(remote.sentAt) }) };
	const stats = remoteStats && ["sending", "sent"].includes(status) ? { ...toCampaignStats(remoteStats), updatedAt: new Date() } : null;
	const statsFields = stats ? Object.fromEntries(Object.entries(stats).map(([key, value]) => [`stats.${key}`, value])) : {};
	await updateCampaign(scope(campaign), { ...update, ...statsFields });
	return { ...campaign, ...update, ...(stats && { stats }) };
}

export async function syncCampaign(migma, campaign) {
	if (!campaign.migma?.campaignId || !LIVE_STATUSES.includes(campaign.status)) return campaign;
	const remote = await call(migma.campaigns.get(campaign.migma.campaignId));
	const needsStats = ["sending", "sent"].includes(toCampaignStatus(remote?.status) ?? campaign.status);
	const { data: remoteStats } = needsStats ? await migma.campaigns.stats(campaign.migma.campaignId) : { data: null };
	return saveRemote(campaign, remote, remoteStats);
}

export const RECIPIENT_FILTERS = ["delivered", "opened", "clicked", "bounced"];

// Everything the report shows, in one round of requests: Migma's campaign (timing, failure reason), its
// full stats (bots, Apple Mail privacy opens, revenue, freshness) and a page of recipients.
export async function getCampaignReport(migma, campaign, { filter, cursor } = {}) {
	if (!campaign.migma?.campaignId) return { campaign, remote: null, stats: null, recipients: null };
	const id = campaign.migma.campaignId;
	const [remoteResult, statsResult, logsResult] = await Promise.all([
		migma.campaigns.get(id),
		migma.campaigns.stats(id),
		migma.campaigns.logs(id, {
			limit: 25,
			...(RECIPIENT_FILTERS.includes(filter) && { status: filter }),
			...(cursor && { cursor }),
		}),
	]);
	const remote = remoteResult.data;
	const updated = remote ? await saveRemote(campaign, remote, statsResult.data) : campaign;
	return {
		campaign: updated,
		remote,
		stats: statsResult.data,
		statsError: statsResult.error?.message ?? null,
		recipients: logsResult.data,
		recipientsError: logsResult.error?.message ?? null,
	};
}

// Keeps lists and the overview current without a request per campaign on every view.
export async function syncStaleCampaigns(migma, accountId, { limit = 10 } = {}) {
	const stale = await listStaleCampaigns({ accountId, before: new Date(Date.now() - STATS_MAX_AGE_MS), limit });
	await Promise.allSettled(stale.map((campaign) => syncCampaign(migma, campaign)));
}

// "Design with Migma": Migma writes and designs the issue on the brand from a short brief.
export async function startDesign(migma, { newsletter, prompt }) {
	const brief = [
		prompt.trim(),
		"",
		`This is one issue of the newsletter "${newsletter.name}", sent to its subscribers.`,
		`End with a footer that has an unsubscribe link using {{unsubscribe_url}} and this postal address: ${newsletter.postalAddress || "(add the postal address)"}.`,
	].join("\n");
	const started = await call(migma.emails.generate({ projectId: newsletter.migma.projectId, prompt: brief, count: 1 }));
	return started.conversationId;
}

// Fills the draft in once Migma has finished. Returns the generation status.
export async function checkDesign(migma, campaign) {
	const conversationId = campaign.migma?.designing;
	if (!conversationId) return { status: "completed" };
	const status = await call(migma.emails.getGenerationStatus(conversationId));
	if (status?.status === "failed") {
		await updateCampaign(scope(campaign), { "migma.error": status.error || "Migma couldn't design this issue", "migma.designing": null });
		return { status: "failed", error: status.error };
	}
	if (status?.status !== "completed") return { status: status?.status ?? "pending" };

	const email = pickEmail(status);
	if (!email?.html) return { status: "failed", error: "Migma's design came back empty" };
	await updateCampaign(
		{ ...scope(campaign), status: "draft" },
		{
			format: "html",
			html: email.html,
			...(!campaign.subject && email.subject && { subject: email.subject.slice(0, 200) }),
			...(!campaign.previewText && email.preheader && { previewText: email.preheader.slice(0, 300) }),
			"migma.conversationId": conversationId,
			"migma.emailId": email.emailId,
			"migma.html": email.html,
			// Migma's screenshot of the design: the issue's card in lists and on the archive.
			...((email.screenshotUrl || email.thumbnailUrl) && { thumbnailUrl: email.screenshotUrl || email.thumbnailUrl }),
			"migma.designing": null,
			"migma.contentHash": null,
			"migma.error": null,
		}
	);
	return { status: "completed" };
}
