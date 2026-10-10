import assert from "node:assert/strict";
import { test } from "node:test";
import { findBrandForSite, toBrand, toBrandWebsite, toBrands, toSiteHost } from "../lib/brands.js";

test("a website becomes the https address Migma reads", () => {
	const accepted = [
		["acme.com", "https://acme.com/"],
		[" www.Acme.com/about ", "https://www.acme.com/about"],
		["http://shop.acme.co.uk", "https://shop.acme.co.uk/"],
		["https://acme.com/#top", "https://acme.com/"],
	];
	for (const [input, expected] of accepted) assert.equal(toBrandWebsite(input), expected, input);
});

test("anything that isn't a public website is refused", () => {
	for (const input of ["", "   ", "acme", "localhost", "http://localhost:3000", "127.0.0.1", "acme .com", "https://user:pw@acme.com", "acme.com:8080", "javascript:alert(1)", null]) {
		assert.equal(toBrandWebsite(input), null, String(input));
	}
});

test("brands are marked importing or failed, A to Z", () => {
	const brands = toBrands([
		{ _id: "b", name: "zeta", status: "active", domain: "zeta.com", logoUrls: { primary: "https://cdn/z.png" } },
		{ _id: "a", name: "Acme", status: "processing", domain: "acme.com" },
		{ _id: "c", name: "Broken", status: "error" },
	]);
	assert.deepEqual(
		brands.map(({ id, importing, failed }) => [id, importing, failed]),
		[
			["a", true, false],
			["c", false, true],
			["b", false, false],
		]
	);
	assert.equal(brands[2].logoUrl, "https://cdn/z.png");
});

test("a brand without a name yet shows its domain", () => {
	assert.equal(toBrand({ _id: 1, status: "pending", domain: "acme.com" }).name, "acme.com");
	assert.equal(toBrand({ _id: 1, status: "pending" }).name, "Untitled brand");
});

test("a website finds the account's brand for the same site", () => {
	assert.equal(toSiteHost("https://www.Acme.com/about"), "acme.com");
	assert.equal(toSiteHost("nope"), null);
	const brands = toBrands([
		{ _id: "ok", name: "Acme", status: "active", domain: "www.acme.com" },
		{ _id: "bad", name: "Shop", status: "error", domain: "shop.acme.com" },
		{ _id: "new", name: "Zeta", status: "pending", domain: "https://zeta.io" },
	]);
	assert.equal(findBrandForSite(brands, "acme.com")?.id, "ok");
	assert.equal(findBrandForSite(brands, "zeta.io/blog")?.id, "new");
	// A brand Migma couldn't read isn't reused; a new import gets another try.
	assert.equal(findBrandForSite(brands, "shop.acme.com"), null);
	assert.equal(findBrandForSite(brands, "other.com"), null);
});
