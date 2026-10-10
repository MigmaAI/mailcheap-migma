import crypto from "node:crypto";

// Each account's Migma key is stored encrypted (AES-256-GCM) with a key derived from SESSION_SECRET.
// Rotating SESSION_SECRET means every account connects Migma again.
const VERSION = "v1";

function getKey() {
	const secret = process.env.SESSION_SECRET;
	if (!secret) throw new Error("SESSION_SECRET is required to store Migma keys");
	return Buffer.from(crypto.hkdfSync("sha256", secret, "", "mailcheap-migma-key-v1", 32));
}

export function seal(plaintext) {
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
	const body = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
	return [VERSION, iv, cipher.getAuthTag(), body].map((part) => (typeof part === "string" ? part : part.toString("base64url"))).join(".");
}

export function open(sealed) {
	const [version, iv, tag, body] = String(sealed ?? "").split(".");
	if (version !== VERSION || !iv || !tag || !body) throw new Error("Stored Migma key is unreadable");
	const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64url"));
	decipher.setAuthTag(Buffer.from(tag, "base64url"));
	return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}
