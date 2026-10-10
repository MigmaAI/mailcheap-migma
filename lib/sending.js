import "server-only";
import crypto from "node:crypto";
import { assignArchiveSlug } from "@/lib/archive-slugs";
import { isSendingEnabled } from "@/lib/config";
import { call } from "@/lib/migma";
import { buildIssueHtml, getSendProblem, toCampaignStats, toCampaignStatus } from "@/lib/sending-rules";
import Campaign from "@/models/Campaign";

// Migma sends emails it made itself, so an issue becomes a Migma email first. Migma rewrites the HTML
// in its own format; this asks it to keep everything as written.
const KEEP_AS_WRITTEN =
	"Keep this newsletter issue exactly as written: the same words, links, images, order and footer. Keep the {{unsubscribe_url}} link and the postal address in the footer. Don't add, remove or restyle sections.";
// Preparing takes Migma up to a minute or two; give up after five.
const PREPARE_POLLING = { interval: 3000, maxAttempts: 100 };
const LIVE_STATUSES = ["scheduled", "review", "sending", "sent"];
const STATS_MAX_AGE_MS = 5 * 60 * 1000;

function assertSendingEnabled() {
	if (!isSendingEnabled()) throw new Error("Sending is off");
}

function hashOf(value) {
	return crypto.createHash("sha256").update(value).digest("hex");
}

function scope(campaign) {
	return { _id: campaign._id, accountId: campaign.accountId };
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

	const status = await call(
		migma.emails.importHtmlAndWait(
			{
				projectId: newsletter.migma.projectId,
				html,
				name: `${newsletter.slug}.html`,
				instruction: KEEP_AS_WRITTEN,
				generateMedia: false,
			},
			PREPARE_POLLING,
			{ idempotencyKey: attemptKey("import", campaign) }
		)
	);
	const email = status?.status === "completed" ? pickEmail(status) : null;
	if (!email) throw new Error(status?.error || "Migma couldn't prepare the email. Try again.");
	const prepared = { contentHash, conversationId: status.conversationId, emailId: email.emailId, html: email.html || status.result.html };
	// Migma fills in each reader's unsubscribe link, but only where the email still has one.
	if (!/unsubscribe/i.test(prepared.html ?? "")) {
		throw new Error("Migma's version of the email lost its unsubscribe link. Try again, or simplify the footer.");
	}

	await Campaign.updateOne(scope(campaign), {
		$set: {
			"migma.contentHash": prepared.contentHash,
			"migma.conversationId": prepared.conversationId,
			"migma.emailId": prepared.emailId,
			"migma.html": prepared.html,
		},
		$unset: { "migma.error": 1 },
	});
	return prepared;
}

export async function sendTestEmail(migma, { campaign, newsletter, to }) {
	assertSendingEnabled();
	const prepared = await prepareIssue(migma, campaign, newsletter);
	await call(migma.emails.sendTest({ emailId: prepared.emailId, to }));
	await Campaign.updateOne(scope(campaign), { $set: { testSentAt: new Date() } });
}

// The archive slug comes first: the email's "Read online" link points at it.
async function readyToSend(migma, campaign, newsletter) {
	const problem = getSendProblem({ campaign, newsletter });
	if (problem) throw new Error(problem);
	await assignArchiveSlug({ campaign, newsletter });
	const current = await Campaign.findOne(scope(campaign)).lean();
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
	await Campaign.updateOne(scope(campaign), { $set: { "migma.campaignId": created.id, "migma.campaignEmailId": prepared.emailId } });
	return created.id;
}

// A failed hand-off puts the campaign back as it was, with Migma's reason.
async function restore(campaign, previous, error) {
	const reason = String(error?.message ?? error).slice(0, 300);
	await Campaign.updateOne(
		{ ...scope(campaign), status: { $in: ["sending", "scheduled"] } },
		previous.scheduledAt
			? { $set: { status: previous.status, scheduledAt: previous.scheduledAt, "migma.error": reason } }
			: { $set: { status: previous.status, "migma.error": reason }, $unset: { scheduledAt: 1 } }
	);
}

export async function sendNow(migma, { campaign, newsletter }) {
	assertSendingEnabled();
	const { current, prepared } = await readyToSend(migma, campaign, newsletter);
	// Only a draft or a scheduled issue goes out, and only once.
	const previous = await Campaign.findOneAndUpdate(
		{ ...scope(current), status: { $in: ["draft", "scheduled"] } },
		{ $set: { status: "sending" }, $unset: { scheduledAt: 1, "migma.error": 1 } },
		{ returnDocument: "before" }
	).lean();
	if (!previous) throw new Error("This campaign changed, refresh and try again");

	try {
		const campaignId = await ensureMigmaCampaign(migma, { campaign: previous, newsletter, prepared });
		const sent = await call(migma.campaigns.send(campaignId, { idempotencyKey: attemptKey("send", current) }));
		const status = toCampaignStatus(sent?.status) ?? "sending";
		await Campaign.updateOne(scope(current), {
			$set: { status: status === "draft" ? "sending" : status, startedAt: new Date(), ...(status === "sent" && { sentAt: new Date() }) },
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
	const previous = await Campaign.findOneAndUpdate(
		{ ...scope(current), status: { $in: ["draft", "scheduled"] } },
		{ $set: { status: "scheduled", scheduledAt }, $unset: { "migma.error": 1 } },
		{ returnDocument: "before" }
	).lean();
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
	const { matchedCount } = await Campaign.updateOne(
		{ ...scope(campaign), status: "scheduled" },
		{ $set: { status: "draft" }, $unset: { scheduledAt: 1, "migma.campaignId": 1, "migma.campaignEmailId": 1 } }
	);
	return matchedCount > 0;
}

// Status and numbers from Migma. Stats can be briefly unavailable; the last ones stay until then.
export async function syncCampaign(migma, campaign) {
	if (!campaign.migma?.campaignId || !LIVE_STATUSES.includes(campaign.status)) return campaign;
	const remote = await call(migma.campaigns.get(campaign.migma.campaignId));
	const remoteStatus = toCampaignStatus(remote?.status);
	const status = remoteStatus && remoteStatus !== "draft" ? remoteStatus : campaign.status;
	const update = { status, ...(remote?.sentAt && { sentAt: new Date(remote.sentAt) }) };
	if (["sending", "sent"].includes(status)) {
		const { data } = await migma.campaigns.stats(campaign.migma.campaignId);
		if (data) update.stats = { ...toCampaignStats(data), updatedAt: new Date() };
	}
	await Campaign.updateOne(scope(campaign), { $set: update });
	return { ...campaign, ...update };
}

// Keeps lists and the overview current without a request per campaign on every view.
export async function syncStaleCampaigns(migma, accountId, { limit = 10 } = {}) {
	const stale = await Campaign.find({
		accountId,
		status: { $in: LIVE_STATUSES },
		"migma.campaignId": { $type: "string" },
		$or: [{ "stats.updatedAt": { $exists: false } }, { "stats.updatedAt": { $lt: new Date(Date.now() - STATS_MAX_AGE_MS) } }],
	})
		.sort({ startedAt: -1 })
		.limit(limit)
		.lean();
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
		await Campaign.updateOne(scope(campaign), {
			$set: { "migma.error": status.error || "Migma couldn't design this issue" },
			$unset: { "migma.designing": 1 },
		});
		return { status: "failed", error: status.error };
	}
	if (status?.status !== "completed") return { status: status?.status ?? "pending" };

	const email = pickEmail(status);
	if (!email?.html) return { status: "failed", error: "Migma's design came back empty" };
	await Campaign.updateOne(
		{ ...scope(campaign), status: "draft" },
		{
			$set: {
				format: "html",
				html: email.html,
				...(!campaign.subject && email.subject && { subject: email.subject.slice(0, 200) }),
				...(!campaign.previewText && email.preheader && { previewText: email.preheader.slice(0, 300) }),
				"migma.conversationId": conversationId,
				"migma.emailId": email.emailId,
				"migma.html": email.html,
			},
			$unset: { "migma.designing": 1, "migma.contentHash": 1, "migma.error": 1 },
		}
	);
	return { status: "completed" };
}
