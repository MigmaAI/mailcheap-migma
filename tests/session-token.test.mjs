import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT, decodeJwt } from "jose";

process.env.SESSION_SECRET = "s".repeat(40);

const { SESSION_COOKIE, SESSION_MAX_AGE, signSessionToken, verifySessionToken } = await import("../lib/session-token.js");
const { open, seal } = await import("../lib/secret-box.js");

async function withEnv(values, run) {
	const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
	Object.assign(process.env, values);
	try {
		await run();
	} finally {
		for (const [key, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	}
}

test("a session names the Migma account and lasts 30 days", async () => {
	const token = await signSessionToken("64f1a2b3c4d5e6f7a8b9c0d1");
	const { iat, exp, sub } = decodeJwt(token);
	assert.equal(SESSION_MAX_AGE, 30 * 24 * 60 * 60);
	assert.equal(exp - iat, SESSION_MAX_AGE);
	assert.equal(sub, "64f1a2b3c4d5e6f7a8b9c0d1");
	assert.deepEqual(await verifySessionToken(token), { accountId: "64f1a2b3c4d5e6f7a8b9c0d1" });
});

test("sessions are signed with their own key, not SESSION_SECRET itself", async () => {
	const rawKey = new TextEncoder().encode(process.env.SESSION_SECRET);
	const forged = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("someone-else").setExpirationTime("1h").sign(rawKey);
	assert.equal(await verifySessionToken(forged), null);

	const token = await signSessionToken("account-1");
	await withEnv({ SESSION_SECRET: "t".repeat(40) }, async () => {
		assert.equal(await verifySessionToken(token), null);
	});
	await withEnv({ SESSION_SECRET: "s".repeat(31) }, async () => {
		assert.equal(await verifySessionToken(token), null);
		await assert.rejects(signSessionToken("account-1"), /at least 32 characters/);
	});
	assert.equal(await verifySessionToken(`${token}x`), null);
	assert.equal(await verifySessionToken(""), null);
});

test("a stored Migma key opens only with the same secret, and tampering is caught", async () => {
	const sealed = seal("mgma_sk_test_example_key");
	assert.ok(!sealed.includes("mgma_sk_test_example_key"));
	assert.notEqual(seal("mgma_sk_test_example_key"), sealed, "a fresh IV each time");
	assert.equal(open(sealed), "mgma_sk_test_example_key");

	const [version, iv, tag, body] = sealed.split(".");
	const flipped = `${body.at(0) === "A" ? "B" : "A"}${body.slice(1)}`;
	assert.throws(() => open([version, iv, tag, flipped].join(".")));
	assert.throws(() => open("not-a-sealed-key"), /unreadable/);
	await withEnv({ SESSION_SECRET: "t".repeat(40) }, async () => {
		assert.throws(() => open(sealed));
	});
});

test("production keeps the session in a __Host- cookie", async () => {
	assert.equal(SESSION_COOKIE, "mailcheap_session");
	await withEnv({ NODE_ENV: "production" }, async () => {
		const production = await import("../lib/session-token.js?production");
		assert.equal(production.SESSION_COOKIE, "__Host-mailcheap_session");
	});
});
