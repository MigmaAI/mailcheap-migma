import "server-only";
import { call, getListCount } from "@/lib/migma";
import { listNewsletters } from "@/lib/data/newsletters";

// Contacts live in Migma, on the newsletter's brand, tagged with its list. Migma keeps every opt-out:
// adding someone who unsubscribed or bounced only adds the tag, it never subscribes them again.
export const CONTACT_STATUSES = ["subscribed", "non-subscribed", "unsubscribed", "bounced"];
export const CONTACT_STATUS_LABELS = {
	subscribed: "Subscribed",
	"non-subscribed": "Not subscribed",
	unsubscribed: "Unsubscribed",
	bounced: "Bounced",
};

// CSV statuses (lib/csv-import.js) in Migma's terms. Dormant and pending people don't get issues.
const IMPORT_STATUSES = {
	active: "subscribed",
	dormant: "non-subscribed",
	unsubscribed: "unsubscribed",
	bounced: "bounced",
	complained: "bounced",
};

export async function listContacts(migma, newsletter, { status, search, page = 1, limit = 50 } = {}) {
	const result = await call(
		migma.contacts.list({
			projectId: newsletter.migma.projectId,
			tags: newsletter.migma.tagId,
			page,
			limit,
			...(status && { status }),
			...(search && { search }),
		})
	);
	return { contacts: result?.data ?? [], total: result?.count ?? 0 };
}

export async function subscribe(migma, newsletter, email) {
	return call(migma.contacts.create({ email, projectId: newsletter.migma.projectId, tags: [newsletter.migma.tagId] }));
}

export async function importRows(migma, newsletter, rows) {
	const subscribers = rows.map(({ email, status }) => ({
		email,
		status: IMPORT_STATUSES[status] ?? "non-subscribed",
		tags: [newsletter.migma.tagId],
	}));
	const result = await call(migma.contacts.bulkImport({ projectId: newsletter.migma.projectId, subscribers }));
	if (result?.jobId) return { created: 0, existing: 0, invalid: 0, queued: subscribers.length };
	return { created: result?.success ?? 0, existing: result?.updated ?? 0, invalid: result?.failed ?? 0, queued: 0 };
}

// Migma applies an unsubscribe to the whole account, the same as the link in an email.
export async function unsubscribe(migma, newsletter, email) {
	await call(migma.contacts.changeStatus({ email, status: "unsubscribed", projectId: newsletter.migma.projectId }));
}

// The account's newsletters in creation order, each with its subscriber count from Migma (null when
// Migma didn't answer).
export async function listNewslettersWithCounts(migma, accountId) {
	const newsletters = await listNewsletters(accountId);
	const counts = await Promise.all(newsletters.map((newsletter) => getListCount(migma, newsletter).catch(() => null)));
	return newsletters.map((newsletter, index) => ({ ...newsletter, activeCount: counts[index] }));
}
