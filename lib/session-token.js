import { SignJWT, jwtVerify } from "jose";
import { MIN_SESSION_SECRET_LENGTH } from "./config.js";

// __Host- cookies need HTTPS, which local dev doesn't have.
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-mailcheap_session" : "mailcheap_session";
// Each "Continue with Migma" mints a new Migma key, so sessions last long enough that people rarely repeat it.
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();
const ACCOUNT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
let cachedKey = null;

async function getKey() {
	const secret = process.env.SESSION_SECRET;
	if (!secret || secret.length < MIN_SESSION_SECRET_LENGTH) {
		throw new Error(`SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters`);
	}
	if (cachedKey?.secret !== secret) {
		const material = await crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveBits"]);
		const bits = await crypto.subtle.deriveBits(
			{ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(), info: encoder.encode("mailcheap-session-v2") },
			material,
			256
		);
		cachedKey = { secret, key: new Uint8Array(bits) };
	}
	return cachedKey.key;
}

// The token only names the Migma account. Disconnecting deletes the account's stored key, which
// ends every session for it (lib/auth.js checks the account on each request).
export async function signSessionToken(accountId) {
	return new SignJWT({})
		.setProtectedHeader({ alg: "HS256" })
		.setSubject(String(accountId))
		.setIssuedAt()
		.setExpirationTime(`${SESSION_MAX_AGE}s`)
		.sign(await getKey());
}

export async function verifySessionToken(token) {
	if (!token) return null;
	try {
		const { payload } = await jwtVerify(token, await getKey(), { algorithms: ["HS256"] });
		return typeof payload.sub === "string" && ACCOUNT_ID_PATTERN.test(payload.sub) ? { accountId: payload.sub } : null;
	} catch {
		return null;
	}
}
