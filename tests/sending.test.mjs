import assert from "node:assert/strict";
import { test } from "node:test";
import { UNSUBSCRIBE_PLACEHOLDER } from "../lib/render-email.js";
import {
	buildIssueHtml,
	getIssueWebUrl,
	getSendProblem,
	toCampaignStats,
	toCampaignStatus,
} from "../lib/sending-rules.js";

process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-characters";
process.env.APP_URL = "https://mail.example.com";

const newsletter = {
	_id: "74f1a2b3c4d5e6f7a8b9c0d2",
	name: "Field notes",
	fromName: "Jane Doe",
	fromEmail: "jane@example.net",
	replyTo: "",
	postalAddress: "1 Main St, Paris",
};
const campaign = {
	format: "markdown",
	subject: "Issue 12",
	previewText: "This week",
	markdown: "# Hello\n\nRead [this](https://example.com).",
};

test("the HTML Migma gets keeps Migma's unsubscribe variable and the postal address", () => {
	const { html } = buildIssueHtml({ campaign, newsletter });
	assert.equal(UNSUBSCRIBE_PLACEHOLDER, "{{unsubscribe_url}}");
	assert.ok(html.includes(`href="${UNSUBSCRIBE_PLACEHOLDER}"`));
	assert.ok(html.includes("1 Main St, Paris"));
	assert.ok(html.includes("You're receiving this because you subscribed to Field notes."));
});

test("preview text goes on the Migma campaign, not in the body", () => {
	const { html } = buildIssueHtml({ campaign, newsletter });
	assert.ok(!html.includes("data-preheader"));
	assert.ok(!html.includes("This week"));
});

test("custom HTML with its own unsubscribe link gets no second footer", () => {
	const html = `<html><body><p>Issue</p><a href="${UNSUBSCRIBE_PLACEHOLDER}">Leave</a></body></html>`;
	const built = buildIssueHtml({ campaign: { format: "html", subject: "Issue", html }, newsletter }).html;
	assert.equal(built.split(UNSUBSCRIBE_PLACEHOLDER).length - 1, 1);
});

test("issues link to their archive page; drafts to the one their subject gives", () => {
	const archived = { ...newsletter, slug: "weekly", archiveEnabled: true };
	const issue = { ...campaign, _id: "84f1a2b3c4d5e6f7a8b9c0d3", archiveSlug: "issue-12-is-out" };
	assert.ok(buildIssueHtml({ campaign: issue, newsletter: archived }).html.includes('href="https://mail.example.com/archive/weekly/p/issue-12-is-out"'));
	assert.ok(
		buildIssueHtml({ campaign: { ...issue, archiveSlug: undefined }, newsletter: archived }).html.includes(
			'href="https://mail.example.com/archive/weekly/p/issue-12"'
		)
	);
	assert.equal(getIssueWebUrl({ campaign: issue, newsletter }), null, "archive off");
	assert.equal(getIssueWebUrl({ campaign: { ...issue, archiveListed: false }, newsletter: archived }), null);
});

test("send problems block incomplete or oversized emails", () => {
	assert.equal(getSendProblem({ campaign, newsletter }), null);
	assert.equal(getSendProblem({ campaign, newsletter: null }), "Newsletter not found");
	assert.equal(getSendProblem({ campaign, newsletter: { ...newsletter, fromEmail: "" } }), "Add a from email to the newsletter");
	assert.equal(
		getSendProblem({ campaign, newsletter: { ...newsletter, postalAddress: " " } }),
		"Add a postal address to the newsletter"
	);
	assert.equal(getSendProblem({ campaign: { ...campaign, subject: "  " }, newsletter }), "Add a subject");
	assert.equal(getSendProblem({ campaign: { ...campaign, markdown: "" }, newsletter }), "Add content");
	assert.equal(getSendProblem({ campaign: { ...campaign, format: "html", html: " " }, newsletter }), "Add content");

	const oversized = { ...campaign, markdown: "word ".repeat(30_000) };
	assert.match(getSendProblem({ campaign: oversized, newsletter }), /Gmail clips emails over 100 KB/);
});

test("Migma campaign statuses map to this app's, review included", () => {
	assert.equal(toCampaignStatus("pending_review"), "review");
	assert.equal(toCampaignStatus("throttled"), "sending");
	assert.equal(toCampaignStatus("sent"), "sent");
	assert.equal(toCampaignStatus("cancelled"), "canceled");
	assert.equal(toCampaignStatus("something-new"), null);
});

test("Migma stats map to the campaign's counters, missing ones as zero", () => {
	assert.deepEqual(
		toCampaignStats({ totalSent: 120, totalDelivered: 118, uniqueOpens: 60, uniqueClicks: 12, bounces: 2, unsubscribes: 1 }),
		{ recipients: 120, delivered: 118, opened: 60, clicked: 12, bounced: 2, unsubscribed: 1 }
	);
	assert.deepEqual(toCampaignStats(null), { recipients: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 });
});

test("a preparation is polled until it finishes, and given up on when the wait runs out", async () => {
	const { waitForPreparation } = await import("../lib/sending-rules.js");
	let clock = 0;
	const options = { waitMs: 10_000, intervalMs: 3000, now: () => clock, sleep: async (ms) => (clock += ms) };

	const steps = ["pending", "processing", "completed"];
	const done = await waitForPreparation(async () => ({ status: steps.shift() }), options);
	assert.equal(done.status, "completed");
	assert.equal(clock, 6000);

	clock = 0;
	const failed = await waitForPreparation(async () => ({ status: "failed", error: "Bad HTML" }), options);
	assert.equal(failed.error, "Bad HTML");

	clock = 0;
	let calls = 0;
	const slow = await waitForPreparation(async () => (calls++, { status: "processing" }), options);
	assert.equal(slow, null);
	// Asked at 0s, 3s, 6s and 9s; a check at 12s would be past the 10s wait.
	assert.equal(calls, 4);
});
