import assert from "node:assert/strict";
import { test } from "node:test";
import { toBrands } from "../lib/brands.js";
import { suggestNewsletter } from "../lib/newsletter-suggestions.js";

const domains = (...items) => items.map(([domain, verified, managed = false]) => ({ domain, verified, managed }));

test("a first newsletter starts from the account's verified sending domain", () => {
	const suggested = suggestNewsletter({ sendingDomains: domains(["acme.migma.email", true, true], ["mail.acme.com", true]) });
	assert.deepEqual(suggested, {
		name: "Acme Newsletter",
		fromName: "Acme",
		fromEmail: "hi@mail.acme.com",
		replyTo: "",
		postalAddress: "",
		projectId: null,
		website: "acme.com",
		source: "account",
	});
});

test("a brand for that site names the newsletter and is picked", () => {
	const brands = toBrands([{ _id: "b1", name: "Acme Studio", status: "active", domain: "www.acme.com" }]);
	const suggested = suggestNewsletter({ brands, sendingDomains: domains(["acme.com", true]) });
	assert.equal(suggested.name, "Acme Studio Newsletter");
	assert.equal(suggested.projectId, "b1");
	assert.equal(suggested.website, "acme.com");
});

test("an instant domain gives a sender but no website, and nothing verified gives nothing", () => {
	const instant = suggestNewsletter({ sendingDomains: domains(["acme.migma.email", true, true], ["acme.com", false]) });
	assert.equal(instant.fromEmail, "hi@acme.migma.email");
	assert.equal(instant.website, "");
	assert.equal(instant.name, "");
	assert.equal(suggestNewsletter({ sendingDomains: domains(["acme.com", false]) }), null);
	assert.equal(suggestNewsletter({}), null);
});

test("a later newsletter reuses the last one's sender details and brand", () => {
	const brands = toBrands([{ _id: "b1", name: "Acme", status: "active", domain: "acme.com" }]);
	const newsletters = [
		{ fromName: "Old", fromEmail: "old@acme.com", migma: { projectId: "b0" } },
		{ fromName: "Jane", fromEmail: "jane@acme.com", replyTo: "reply@acme.com", postalAddress: "1 Main St", migma: { projectId: "b1" } },
	];
	const suggested = suggestNewsletter({ newsletters, brands, sendingDomains: domains(["news.acme.com", true]) });
	assert.equal(suggested.source, "newsletter");
	assert.equal(suggested.fromEmail, "jane@acme.com");
	assert.equal(suggested.postalAddress, "1 Main St");
	assert.equal(suggested.projectId, "b1");
	assert.equal(suggested.website, "acme.com");
	assert.equal(suggested.name, undefined);
});
