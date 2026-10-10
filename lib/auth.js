import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connectDb } from "@/lib/db";
import { identifyKey, migmaFor } from "@/lib/migma";
import { seal } from "@/lib/secret-box";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSessionToken, verifySessionToken } from "@/lib/session-token";
import Account from "@/models/Account";

// Browsers ignore a __Host- cookie, even an expired one, unless it's Secure with Path=/.
export const COOKIE_OPTIONS = {
	httpOnly: true,
	secure: process.env.NODE_ENV === "production",
	sameSite: "lax",
	path: "/",
};

async function startSession(accountId) {
	const store = await cookies();
	store.set(SESSION_COOKIE, await signSessionToken(accountId), { ...COOKIE_OPTIONS, maxAge: SESSION_MAX_AGE });
}

export async function endSession() {
	const store = await cookies();
	store.delete({ name: SESSION_COOKIE, ...COOKIE_OPTIONS });
}

export async function getSession() {
	const store = await cookies();
	return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

// A key from "Continue with Migma" or pasted by hand. The newest key replaces the stored one, so
// reconnecting fixes a revoked key without losing any newsletter.
export async function connectAccount(apiKey) {
	const key = String(apiKey ?? "").trim();
	const { accountId, name } = await identifyKey(key);
	await connectDb();
	await Account.updateOne(
		{ accountId },
		{ $set: { name, apiKey: seal(key), keyHint: key.slice(-4), connectedAt: new Date() } },
		{ upsert: true }
	);
	await startSession(accountId);
	return { accountId, name };
}

// A session only counts while its account is still connected.
export async function getAccount() {
	const session = await getSession();
	if (!session) return null;
	await connectDb();
	return Account.findOne({ accountId: session.accountId }).lean();
}

// Every page and server action calls this.
export async function requireAccount() {
	const account = await getAccount();
	if (!account) redirect("/login");
	return account;
}

export async function requireMigma() {
	const account = await requireAccount();
	return { account, accountId: account.accountId, migma: migmaFor(account) };
}

// Forgets the stored key, which ends every session for this account. The key itself stays valid in
// Migma until it's revoked there.
export async function disconnectAccount(accountId) {
	await connectDb();
	await Account.deleteOne({ accountId });
	await endSession();
}
