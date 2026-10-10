import assert from "node:assert/strict";
import { test } from "node:test";
import { groupDomains, toSendingDomain, toSendingDomains } from "../lib/sending-domains.js";

const verified = {
	domain: "mail.example.com",
	status: "verified",
	isVerified: true,
	regionName: "US East (N. Virginia)",
	verifiedAt: "2026-10-02T10:00:00.000Z",
	health: { status: "healthy", bounceRate: 1.2, complaintRate: 0, totalSent: 9702 },
	openTracking: true,
	clickTracking: false,
	dnsRecords: [{ type: "MX", name: "bounce.mail.example.com", value: "feedback-smtp.us-east-1.amazonses.com", priority: 10, status: "verified" }],
};

test("a sendable domain is ready, with its health, region and tracking", () => {
	const domain = toSendingDomain(verified);
	assert.equal(domain.state, "ready");
	assert.equal(domain.region, "US East (N. Virginia)");
	assert.deepEqual(domain.health, { status: "healthy", bounceRate: 1.2, complaintRate: 0, sent: 9702, minVolume: 100 });
	assert.equal(toSendingDomain({ ...verified, thresholds: { minVolume: 250 } }).health.minVolume, 250, "Migma's own threshold wins");
	assert.deepEqual(domain.tracking, { opens: true, clicks: false, branded: false });
	assert.equal(domain.records[0].priority, 10);
	assert.equal(toSendingDomain({ ...verified, status: "degraded", isVerified: undefined }).state, "ready");
});

test("domains that can't send say why", () => {
	const pending = toSendingDomain({ domain: "news.example.org", status: "verifying", dnsIssues: ["DKIM record not found", 42], dnsRecords: [] });
	assert.equal(pending.state, "dns");
	assert.deepEqual(pending.issues, ["DKIM record not found"]);
	assert.equal(toSendingDomain({ domain: "old.example.org", status: "failed" }).state, "failed");
	const suspended = toSendingDomain({ domain: "x.example.org", status: "suspended", isVerified: true, suspensionReason: "Bounce rate over 10%" });
	assert.equal(suspended.state, "suspended");
	assert.equal(suspended.suspensionReason, "Bounce rate over 10%");
});

test("custom and instant domains merge once, ready first and your own before instant ones", () => {
	const domains = toSendingDomains(
		[{ domain: "old.example.org", status: "failed" }, verified, { domain: "acme.migma.email", status: "verified", isManagedDomain: true }],
		[{ domain: "acme.migma.email", status: "verified", isManagedDomain: true }]
	);
	assert.deepEqual(
		domains.map(({ domain }) => domain),
		["mail.example.com", "acme.migma.email", "old.example.org"]
	);
	const groups = groupDomains(domains);
	assert.equal(groups.ready.length, 2);
	assert.equal(groups.failed.length, 1);
	assert.equal(groups.dns.length, 0);
});
