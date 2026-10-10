import assert from "node:assert/strict";
import { test } from "node:test";
import { getConfigProblems, getMigmaApiUrl } from "../lib/config.js";
import { register } from "../instrumentation.js";

const STRONG = { SESSION_SECRET: "s".repeat(32) };

test("SESSION_SECRET needs 32 characters", () => {
	assert.deepEqual(getConfigProblems(STRONG), []);
	assert.match(getConfigProblems({ SESSION_SECRET: "s".repeat(31) }).join(), /SESSION_SECRET must be at least 32/);
	assert.equal(getConfigProblems({}).length, 1, "missing counts as too short");
});

test("the server doesn't start with a short secret", () => {
	const previous = { ...process.env };
	try {
		Object.assign(process.env, STRONG);
		assert.doesNotThrow(register);
		process.env.SESSION_SECRET = "short";
		assert.throws(register, /Mailcheap can't start\. SESSION_SECRET must be at least 32 characters/);
	} finally {
		process.env = previous;
	}
});

test("the Migma API defaults to production and can point elsewhere", () => {
	const previous = process.env.MIGMA_API_URL;
	try {
		delete process.env.MIGMA_API_URL;
		assert.equal(getMigmaApiUrl(), "https://api.migma.ai/v1");
		process.env.MIGMA_API_URL = "http://localhost:3002/v1/";
		assert.equal(getMigmaApiUrl(), "http://localhost:3002/v1");
	} finally {
		if (previous === undefined) delete process.env.MIGMA_API_URL;
		else process.env.MIGMA_API_URL = previous;
	}
});
