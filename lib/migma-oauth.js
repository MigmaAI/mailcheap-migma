import "server-only";
import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { APP_NAME, getAppUrl, getMigmaApiUrl } from "@/lib/config";
import { getOAuthClientId, saveOAuthClientId } from "@/lib/data/oauth-clients";

// "Continue with Migma": OAuth authorization code with PKCE against Migma's own authorization server.
// The token Migma returns is a scoped Migma API key; lib/auth.js stores it like a pasted one.
export const OAUTH_COOKIE = "mailcheap_oauth";
export const SCOPES = [
	"audience:read",
	"audience:write",
	"email:read",
	"email:write",
	"email:send",
	"campaign:read",
	"campaign:write",
	"domain:read",
	"domain:write",
	"project:write",
];
const PENDING_MAX_AGE = 10 * 60;
const encoder = new TextEncoder();

function getIssuer() {
	return new URL(getMigmaApiUrl()).origin;
}

export function getRedirectUri() {
	return `${getAppUrl()}/auth/migma/callback`;
}

function getPendingKey() {
	return crypto.hkdfSync("sha256", process.env.SESSION_SECRET ?? "", "", "mailcheap-oauth-pending-v1", 32);
}

async function getClientId(redirectUri) {
	if (process.env.MIGMA_OAUTH_CLIENT_ID) return process.env.MIGMA_OAUTH_CLIENT_ID;
	const saved = await getOAuthClientId(redirectUri);
	if (saved) return saved;

	const response = await fetch(`${getIssuer()}/oauth2/register`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			client_name: APP_NAME,
			redirect_uris: [redirectUri],
			grant_types: ["authorization_code"],
			response_types: ["code"],
			token_endpoint_auth_method: "none",
		}),
	});
	const body = await response.json().catch(() => ({}));
	if (!response.ok || !body.client_id) {
		throw new Error(body.error_description || body.error || `Migma didn't register the app (${response.status})`);
	}
	return saveOAuthClientId(redirectUri, body.client_id);
}

// The verifier and state ride in a short-lived signed cookie, so nothing is stored per attempt.
export async function startAuthorization(next) {
	const redirectUri = getRedirectUri();
	const clientId = await getClientId(redirectUri);
	const state = crypto.randomBytes(24).toString("base64url");
	const verifier = crypto.randomBytes(48).toString("base64url");
	const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");

	const url = new URL(`${getIssuer()}/oauth2/authorize`);
	url.search = new URLSearchParams({
		response_type: "code",
		client_id: clientId,
		redirect_uri: redirectUri,
		scope: SCOPES.join(" "),
		state,
		code_challenge: challenge,
		code_challenge_method: "S256",
	}).toString();

	const pending = await new SignJWT({ state, verifier, clientId, next })
		.setProtectedHeader({ alg: "HS256" })
		.setExpirationTime(`${PENDING_MAX_AGE}s`)
		.sign(new Uint8Array(getPendingKey()));
	return { url: url.toString(), pending, maxAge: PENDING_MAX_AGE };
}

export async function readPending(token) {
	if (!token) return null;
	try {
		const { payload } = await jwtVerify(token, new Uint8Array(getPendingKey()), { algorithms: ["HS256"] });
		return payload;
	} catch {
		return null;
	}
}

export async function exchangeCode({ code, pending }) {
	const response = await fetch(`${getIssuer()}/oauth2/token`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			grant_type: "authorization_code",
			code,
			client_id: pending.clientId,
			redirect_uri: getRedirectUri(),
			code_verifier: pending.verifier,
		}),
	});
	const body = await response.json().catch(() => ({}));
	if (!response.ok || !body.access_token) {
		throw new Error(body.error_description || body.error || `Migma didn't finish signing in (${response.status})`);
	}
	return body.access_token;
}

export function isSameState(a, b) {
	const left = encoder.encode(String(a ?? ""));
	const right = encoder.encode(String(b ?? ""));
	return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}
