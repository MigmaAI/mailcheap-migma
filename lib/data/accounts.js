import "server-only";
import { getDb, nowIso, orUndefined, toDate } from "@/lib/db";

function toAccount(row) {
	if (!row) return null;
	return {
		accountId: row.account_id,
		name: orUndefined(row.name),
		apiKey: row.api_key,
		keyHint: orUndefined(row.key_hint),
		testEmail: orUndefined(row.test_email),
		connectedAt: toDate(row.connected_at),
	};
}

export async function getAccount(accountId) {
	const db = await getDb();
	return toAccount(await db.prepare("SELECT * FROM accounts WHERE account_id = ?").bind(accountId).first());
}

// Connecting again with a new key keeps the account's newsletters.
export async function saveAccount({ accountId, name, apiKey, keyHint }) {
	const db = await getDb();
	const now = nowIso();
	await db
		.prepare(
			`INSERT INTO accounts (account_id, name, api_key, key_hint, connected_at, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (account_id) DO UPDATE SET
				name = excluded.name, api_key = excluded.api_key, key_hint = excluded.key_hint,
				connected_at = excluded.connected_at, updated_at = excluded.updated_at`
		)
		.bind(accountId, name ?? null, apiKey, keyHint ?? null, now, now, now)
		.run();
}

export async function deleteAccount(accountId) {
	const db = await getDb();
	await db.prepare("DELETE FROM accounts WHERE account_id = ?").bind(accountId).run();
}

export async function setTestEmail(accountId, email) {
	const db = await getDb();
	await db.prepare("UPDATE accounts SET test_email = ?, updated_at = ? WHERE account_id = ?").bind(email, nowIso(), accountId).run();
}
