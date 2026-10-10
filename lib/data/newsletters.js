import "server-only";
import { changes, getDb, newId, nowIso, orUndefined, setClause, toDate } from "@/lib/db";

const COLUMNS = new Set([
	"name",
	"slug",
	"image_url",
	"from_name",
	"from_email",
	"reply_to",
	"postal_address",
	"archive_enabled",
	"description",
	"social_links",
	"author_bio",
	"author_image_url",
	"readers_count",
	"readers_counted_at",
]);

function toNewsletter(row) {
	if (!row) return null;
	return {
		_id: row.id,
		accountId: row.account_id,
		name: row.name,
		slug: row.slug,
		imageUrl: orUndefined(row.image_url),
		fromName: orUndefined(row.from_name),
		fromEmail: row.from_email,
		replyTo: orUndefined(row.reply_to),
		postalAddress: orUndefined(row.postal_address),
		archiveEnabled: Boolean(row.archive_enabled),
		description: orUndefined(row.description),
		socialLinks: JSON.parse(row.social_links || "[]"),
		author: { bio: orUndefined(row.author_bio), imageUrl: orUndefined(row.author_image_url) },
		migma: { projectId: row.migma_project_id, tagId: row.migma_tag_id },
		readersCount: orUndefined(row.readers_count),
		readersCountedAt: toDate(row.readers_counted_at),
		createdAt: toDate(row.created_at),
		updatedAt: toDate(row.updated_at),
	};
}

// The form's nested author fields as columns.
function toFields({ author, ...values }) {
	return { ...values, ...(author && { authorBio: author.bio || null, authorImageUrl: author.imageUrl || null }) };
}

export async function listNewsletters(accountId) {
	const db = await getDb();
	const { results } = await db.prepare("SELECT * FROM newsletters WHERE account_id = ? ORDER BY created_at").bind(accountId).all();
	return results.map(toNewsletter);
}

export async function getNewsletter(accountId, id) {
	const db = await getDb();
	return toNewsletter(await db.prepare("SELECT * FROM newsletters WHERE id = ? AND account_id = ?").bind(id, accountId).first());
}

// Public pages: the archive, its signup form and /p/ links find a newsletter by slug or id alone.
export async function getArchiveNewsletter(slug) {
	const db = await getDb();
	return toNewsletter(await db.prepare("SELECT * FROM newsletters WHERE slug = ? AND archive_enabled = 1").bind(slug).first());
}

export async function getPublicNewsletter(id) {
	const db = await getDb();
	return toNewsletter(await db.prepare("SELECT * FROM newsletters WHERE id = ? AND archive_enabled = 1").bind(id).first());
}

export async function isSlugTaken(slug) {
	const db = await getDb();
	return Boolean(await db.prepare("SELECT 1 FROM newsletters WHERE slug = ?").bind(slug).first());
}

export async function createNewsletter({ accountId, migma, ...values }) {
	const db = await getDb();
	const id = newId();
	const now = nowIso();
	const { sql, params } = setClause(toFields(values), COLUMNS);
	const columns = sql.split(", ").map((part) => part.replace(" = ?", ""));
	await db
		.prepare(
			`INSERT INTO newsletters (id, account_id, migma_project_id, migma_tag_id, created_at, updated_at, ${columns.join(", ")})
			VALUES (?, ?, ?, ?, ?, ?, ${columns.map(() => "?").join(", ")})`
		)
		.bind(id, accountId, migma.projectId, migma.tagId, now, now, ...params)
		.run();
	return id;
}

export async function updateNewsletter(accountId, id, values) {
	const db = await getDb();
	const { sql, params } = setClause(toFields(values), COLUMNS);
	return changes(
		db.prepare(`UPDATE newsletters SET ${sql}, updated_at = ? WHERE id = ? AND account_id = ?`).bind(...params, nowIso(), id, accountId)
	);
}

export async function saveReadersCount(id, count) {
	const db = await getDb();
	await db.prepare("UPDATE newsletters SET readers_count = ?, readers_counted_at = ? WHERE id = ?").bind(count, nowIso(), id).run();
}
