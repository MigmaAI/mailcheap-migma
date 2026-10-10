import "server-only";
import crypto from "node:crypto";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// The app's own state lives in Cloudflare D1 (binding DB, schema in migrations/). Locally, `next dev`
// uses wrangler's local copy (next.config.mjs).
export async function getDb() {
	const { env } = await getCloudflareContext({ async: true });
	if (!env.DB) throw new Error("The D1 database (binding DB) isn't set up");
	return env.DB;
}

// 24 hex characters, the same shape as the ids in existing URLs.
export function newId() {
	return crypto.randomBytes(12).toString("hex");
}

export function nowIso() {
	return new Date().toISOString();
}

// "migma.emailId" -> "migma_email_id", "previewText" -> "preview_text".
export function toColumn(key) {
	return key.replaceAll(".", "_").replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toSqlValue(value) {
	if (value === undefined || value === null) return null;
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "boolean") return value ? 1 : 0;
	if (typeof value === "object") return JSON.stringify(value);
	return value;
}

// A SET clause from { field: value }: dotted keys name nested fields, null clears one, undefined is
// skipped. Only the table's own columns are accepted.
export function setClause(set, columns) {
	const parts = [];
	const params = [];
	for (const [key, value] of Object.entries(set)) {
		if (value === undefined) continue;
		const column = toColumn(key);
		if (!columns.has(column)) throw new Error(`Unknown column ${column}`);
		parts.push(`${column} = ?`);
		params.push(toSqlValue(value));
	}
	return { sql: parts.join(", "), params };
}

export function placeholders(values) {
	return values.map(() => "?").join(", ");
}

export function toDate(value) {
	return value ? new Date(value) : undefined;
}

// NULL columns come back as undefined, like fields a document never had.
export function orUndefined(value) {
	return value === null ? undefined : value;
}

export async function changes(statement) {
	const result = await statement.run();
	return result.meta?.changes ?? 0;
}
