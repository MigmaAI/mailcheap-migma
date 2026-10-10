import assert from "node:assert/strict";
import { test } from "node:test";
import { toBrand, toBrandWebsite, toBrands } from "../lib/brands.js";

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

test("brands mid-import are marked, failed imports are left out, A to Z", () => {
	const brands = toBrands([
		{ _id: "b", name: "zeta", status: "active", domain: "zeta.com", logoUrls: { primary: "https://cdn/z.png" } },
		{ _id: "a", name: "Acme", status: "processing", domain: "acme.com" },
		{ _id: "c", name: "Broken", status: "error" },
	]);
	assert.deepEqual(
		brands.map(({ id, importing }) => [id, importing]),
		[
			["a", true],
			["b", false],
		]
	);
	assert.equal(brands[1].logoUrl, "https://cdn/z.png");
});

test("a brand without a name yet shows its domain", () => {
	assert.equal(toBrand({ _id: 1, status: "pending", domain: "acme.com" }).name, "acme.com");
	assert.equal(toBrand({ _id: 1, status: "pending" }).name, "Untitled brand");
});
