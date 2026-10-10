import "server-only";
import { changes, getDb, newId, nowIso, orUndefined, placeholders, setClause, toDate } from "@/lib/db";

export const PUBLISHED_STATUSES = ["sending", "sent"];
const SENT_OR_SCHEDULED = ["scheduled", "review", "sending", "sent"];
const LIVE_STATUSES = ["scheduled", "review", "sending", "sent"];
// On the archive: published, with a page, and not unlisted.
const LISTED = `archive_slug IS NOT NULL AND archive_listed = 1 AND status IN (${placeholders(PUBLISHED_STATUSES)})`;

const COLUMNS = new Set([
	"subject",
	"preview_text",
	"format",
	"markdown",
	"html",
	"status",
	"source",
	"scheduled_at",
	"started_at",
	"sent_at",
	"test_sent_at",
	"archive_slug",
	"thumbnail_url",
	"archive_listed",
	"archive_pinned",
	"migma_content_hash",
	"migma_conversation_id",
	"migma_email_id",
	"migma_html",
	"migma_campaign_id",
	"migma_campaign_email_id",
	"migma_designing",
	"migma_error",
	"stats_recipients",
	"stats_delivered",
	"stats_opened",
	"stats_clicked",
	"stats_bounced",
	"stats_unsubscribed",
	"stats_updated_at",
]);

// Lists and cards skip the bodies: an issue carries its HTML twice (draft and Migma's), up to 200 KB each.
const SUMMARY = `id, account_id, newsletter_id, subject, preview_text, status, scheduled_at, started_at, sent_at,
	archive_slug, archive_listed, archive_pinned, thumbnail_url, web_views, created_at, updated_at,
	stats_recipients, stats_delivered, stats_opened, stats_clicked, stats_bounced, stats_unsubscribed, stats_updated_at`;

function toCampaign(row) {
	if (!row) return null;
	return {
		_id: row.id,
		accountId: row.account_id,
		newsletterId: row.newsletter_id,
		subject: row.subject,
		previewText: row.preview_text,
		format: orUndefined(row.format),
		markdown: orUndefined(row.markdown),
		html: orUndefined(row.html),
		status: row.status,
		source: orUndefined(row.source),
		scheduledAt: toDate(row.scheduled_at),
		startedAt: toDate(row.started_at),
		sentAt: toDate(row.sent_at),
		testSentAt: toDate(row.test_sent_at),
		archiveSlug: orUndefined(row.archive_slug),
		thumbnailUrl: orUndefined(row.thumbnail_url),
		archiveListed: row.archive_listed !== 0,
		archivePinned: Boolean(row.archive_pinned),
		webViews: row.web_views ?? 0,
		migma: {
			contentHash: orUndefined(row.migma_content_hash),
			conversationId: orUndefined(row.migma_conversation_id),
			emailId: orUndefined(row.migma_email_id),
			html: orUndefined(row.migma_html),
			campaignId: orUndefined(row.migma_campaign_id),
			campaignEmailId: orUndefined(row.migma_campaign_email_id),
			designing: orUndefined(row.migma_designing),
			error: orUndefined(row.migma_error),
		},
		stats: {
			recipients: row.stats_recipients ?? 0,
			delivered: row.stats_delivered ?? 0,
			opened: row.stats_opened ?? 0,
			clicked: row.stats_clicked ?? 0,
			bounced: row.stats_bounced ?? 0,
			unsubscribed: row.stats_unsubscribed ?? 0,
			updatedAt: toDate(row.stats_updated_at),
		},
		createdAt: toDate(row.created_at),
		updatedAt: toDate(row.updated_at),
	};
}

export async function getCampaign(accountId, id) {
	const db = await getDb();
	return toCampaign(await db.prepare("SELECT * FROM campaigns WHERE id = ? AND account_id = ?").bind(id, accountId).first());
}

export async function createCampaign({ accountId, newsletterId, ...values }) {
	const db = await getDb();
	const id = newId();
	const now = nowIso();
	const { sql, params } = setClause(values, COLUMNS);
	const columns = sql ? sql.split(", ").map((part) => part.replace(" = ?", "")) : [];
	await db
		.prepare(
			`INSERT INTO campaigns (id, account_id, newsletter_id, created_at, updated_at${columns.map((column) => `, ${column}`).join("")})
			VALUES (?, ?, ?, ?, ?${columns.map(() => ", ?").join("")})`
		)
		.bind(id, accountId, newsletterId, now, now, ...params)
		.run();
	return id;
}

// One write, scoped to the account, optionally only from some statuses: the status check is part of
// the write, so two requests can't both move the same campaign. Returns how many rows changed.
export async function updateCampaign({ id, accountId, status }, values) {
	const db = await getDb();
	const { sql, params } = setClause(values, COLUMNS);
	const statuses = status === undefined ? [] : [status].flat();
	const statusSql = statuses.length ? ` AND status IN (${placeholders(statuses)})` : "";
	return changes(
		db
			.prepare(`UPDATE campaigns SET ${sql}, updated_at = ? WHERE id = ? AND account_id = ?${statusSql}`)
			.bind(...params, nowIso(), id, accountId, ...statuses)
	);
}

// Moves a campaign out of one of `from` and returns it as it was before, or null when it had already
// moved: compare-and-set on the status it was read with.
export async function claimCampaign({ id, accountId, from }, values) {
	const before = await getCampaign(accountId, id);
	if (!before || !from.includes(before.status)) return null;
	const changed = await updateCampaign({ id, accountId, status: before.status }, values);
	return changed ? before : null;
}

export async function isArchiveSlugTaken(slug, exceptId) {
	const db = await getDb();
	return Boolean(await db.prepare("SELECT 1 FROM campaigns WHERE archive_slug = ? AND id != ?").bind(slug, exceptId ?? "").first());
}

// Sent issues sort by send date, scheduled ones by the time they go out and drafts by their last edit.
export async function listRecentCampaigns({ accountId, newsletterId, limit }) {
	const db = await getDb();
	const { results } = await db
		.prepare(
			`SELECT ${SUMMARY} FROM campaigns
			WHERE account_id = ? AND status != 'canceled'${newsletterId ? " AND newsletter_id = ?" : ""}
			ORDER BY COALESCE(sent_at, started_at, scheduled_at, updated_at) DESC, id DESC LIMIT ?`
		)
		.bind(accountId, ...(newsletterId ? [newsletterId] : []), limit)
		.all();
	return results.map(toCampaign);
}

// When the account's other issues went out (or will), newest first, for send time suggestions.
export async function listSendTimes({ accountId, newsletterId, excludeId, limit = 20 }) {
	const db = await getDb();
	const { results } = await db
		.prepare(
			`SELECT status, COALESCE(scheduled_at, started_at, sent_at) AS at FROM campaigns
			WHERE account_id = ? AND id != ? AND status IN (${placeholders(SENT_OR_SCHEDULED)})${newsletterId ? " AND newsletter_id = ?" : ""}
			AND COALESCE(scheduled_at, started_at, sent_at) IS NOT NULL
			ORDER BY at DESC LIMIT ?`
		)
		.bind(accountId, excludeId, ...SENT_OR_SCHEDULED, ...(newsletterId ? [newsletterId] : []), limit)
		.all();
	return results.map(({ status, at }) => ({ status, at: new Date(at) }));
}

// Campaigns in Migma whose numbers are older than `before`, most recent sends first.
export async function listStaleCampaigns({ accountId, before, limit }) {
	const db = await getDb();
	const { results } = await db
		.prepare(
			`SELECT * FROM campaigns WHERE account_id = ? AND status IN (${placeholders(LIVE_STATUSES)})
			AND migma_campaign_id IS NOT NULL AND (stats_updated_at IS NULL OR stats_updated_at < ?)
			ORDER BY started_at DESC LIMIT ?`
		)
		.bind(accountId, ...LIVE_STATUSES, before.toISOString(), limit)
		.all();
	return results.map(toCampaign);
}

// Totals of the issues that went out since `previousStart`, split at `periodStart`.
export async function sumStats({ accountId, newsletterId, periodStart, previousStart }) {
	const db = await getDb();
	const { results } = await db
		.prepare(
			`SELECT CASE WHEN started_at >= ? THEN 'current' ELSE 'previous' END AS period,
				SUM(stats_recipients) AS sent, SUM(stats_delivered) AS delivered, SUM(stats_opened) AS opened,
				SUM(stats_clicked) AS clicked, SUM(stats_bounced) AS bounced, SUM(stats_unsubscribed) AS unsubscribed
			FROM campaigns WHERE account_id = ? AND newsletter_id = ? AND status IN (${placeholders(PUBLISHED_STATUSES)}) AND started_at >= ?
			GROUP BY period`
		)
		.bind(periodStart.toISOString(), accountId, newsletterId, ...PUBLISHED_STATUSES, previousStart.toISOString())
		.all();
	return Object.fromEntries(results.map(({ period, ...totals }) => [period, totals]));
}

// ─── The public archive ───────────────────────────────────────────────────────

export async function listArchiveIssues(newsletterId, { limit, excludeId } = {}) {
	const db = await getDb();
	const { results } = await db
		.prepare(
			`SELECT ${SUMMARY} FROM campaigns WHERE newsletter_id = ? AND ${LISTED}${excludeId ? " AND id != ?" : ""}
			ORDER BY COALESCE(sent_at, started_at) DESC${limit ? " LIMIT ?" : ""}`
		)
		.bind(newsletterId, ...PUBLISHED_STATUSES, ...(excludeId ? [excludeId] : []), ...(limit ? [limit] : []))
		.all();
	return results.map(toCampaign);
}

export async function getArchiveIssue(newsletterId, archiveSlug) {
	const db = await getDb();
	const row = await db
		.prepare(`SELECT * FROM campaigns WHERE newsletter_id = ? AND archive_slug = ? AND status IN (${placeholders(PUBLISHED_STATUSES)})`)
		.bind(newsletterId, archiveSlug, ...PUBLISHED_STATUSES)
		.first();
	return toCampaign(row);
}

// Pictures several listed issues share: the newsletter's banner, not one issue's own.
export async function listSharedThumbnails(newsletterId) {
	const db = await getDb();
	const { results } = await db
		.prepare(
			`SELECT thumbnail_url FROM campaigns WHERE newsletter_id = ? AND thumbnail_url IS NOT NULL AND ${LISTED}
			GROUP BY thumbnail_url HAVING COUNT(*) > 1`
		)
		.bind(newsletterId, ...PUBLISHED_STATUSES)
		.all();
	return new Set(results.map(({ thumbnail_url: url }) => url));
}

export async function getNewsletterIdForSlug(archiveSlug) {
	const db = await getDb();
	const row = await db.prepare("SELECT newsletter_id FROM campaigns WHERE archive_slug = ?").bind(archiveSlug).first();
	return row?.newsletter_id ?? null;
}

export async function countWebView(id) {
	const db = await getDb();
	await db
		.prepare(
			`UPDATE campaigns SET web_views = web_views + 1
			WHERE id = ? AND archive_slug IS NOT NULL AND status IN (${placeholders(PUBLISHED_STATUSES)})`
		)
		.bind(id, ...PUBLISHED_STATUSES)
		.run();
}
