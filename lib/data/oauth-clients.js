import "server-only";
import { getDb, nowIso } from "@/lib/db";

export async function getOAuthClientId(redirectUri) {
	const db = await getDb();
	const row = await db.prepare("SELECT client_id FROM oauth_clients WHERE redirect_uri = ?").bind(redirectUri).first();
	return row?.client_id ?? null;
}

// Two first sign-ins at once both register; the first one saved wins and both use it.
export async function saveOAuthClientId(redirectUri, clientId) {
	const db = await getDb();
	await db
		.prepare("INSERT INTO oauth_clients (redirect_uri, client_id, created_at) VALUES (?, ?, ?) ON CONFLICT (redirect_uri) DO NOTHING")
		.bind(redirectUri, clientId, nowIso())
		.run();
	return getOAuthClientId(redirectUri);
}
