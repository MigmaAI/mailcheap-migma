import "server-only";
import { Migma } from "migma";
import { getMigmaApiUrl } from "@/lib/config";
import { open } from "@/lib/secret-box";

// Every Migma call goes through the connected account's own key, so Migma decides what each account
// can see and do. Nothing here holds a key of its own.
export function migmaWithKey(apiKey) {
	return new Migma(apiKey, { baseUrl: getMigmaApiUrl(), maxRetries: 2 });
}

export function migmaFor(account) {
	return migmaWithKey(open(account.apiKey));
}

export class MigmaRequestError extends Error {
	constructor(message, status) {
		super(message);
		this.name = "MigmaRequestError";
		this.status = status;
	}
}

function describe(error) {
	if (error.statusCode === 401) return "Migma didn't accept the API key. Connect Migma again with a new key.";
	if (error.statusCode === 403) return `Migma refused this: ${error.message}. Check the API key's permissions.`;
	if (error.statusCode === 429) return "Migma is rate limiting this account. Try again in a minute.";
	return error.message || "Migma didn't answer";
}

// The SDK returns { data, error } and never throws; callers here want the data or a readable error.
export async function call(request) {
	const { data, error } = await request;
	if (error) throw new MigmaRequestError(describe(error), error.statusCode);
	return data;
}

// The account behind a key: its personal Migma workspace is a stable id across new keys.
export async function identifyKey(apiKey) {
	const migma = migmaWithKey(apiKey);
	const { workspaces = [] } = await call(migma.workspaces.list());
	const workspace = workspaces.find(({ personal }) => personal) ?? workspaces.find(({ role }) => role === "owner") ?? workspaces[0];
	if (!workspace?.id) throw new MigmaRequestError("This key has no Migma workspace", 400);
	return { accountId: String(workspace.id), name: workspace.name || "Migma" };
}

export async function listBrands(migma) {
	const { projects = [] } = await call(migma.projects.list({ limit: 100 }));
	return projects
		.filter(({ status }) => status !== "error")
		.map(({ _id, name, domain, logoUrls }) => ({ id: String(_id), name, domain: domain ?? null, logoUrl: logoUrls?.favicon || logoUrls?.primary || null }))
		.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

function isVerified(domain) {
	return domain.status === "verified" || domain.isVerified === true;
}

// Custom domains and instant *.migma.email domains, verified first.
export async function listSendingDomains(migma) {
	const [custom, managed] = await Promise.all([call(migma.domains.list()), call(migma.domains.listManaged())]);
	const seen = new Set();
	return [...(custom ?? []), ...(managed ?? [])]
		.filter(({ domain }) => domain && !seen.has(domain) && seen.add(domain))
		.map((domain) => ({
			domain: domain.domain,
			status: domain.status,
			verified: isVerified(domain),
			managed: Boolean(domain.isManagedDomain) || /\.migma\.email$/.test(domain.domain),
			dkimStatus: domain.dkimStatus ?? null,
			mailFromDomain: domain.mailFromDomain ?? null,
			mailFromStatus: domain.mailFromStatus ?? null,
			connectUrl: domain.connectUrl ?? null,
			records: (domain.dnsRecords ?? []).map(({ type, name, value, priority, status }) => ({ type, name, value, priority, status })),
		}))
		.sort((a, b) => Number(b.verified) - Number(a.verified));
}

// Migma lists are tags. A newsletter gets its own, reused when one with the same name exists.
export async function ensureListTag(migma, { projectId, name }) {
	const { data: existing = [] } = await call(migma.tags.list({ projectId, search: name, limit: 100 }));
	const match = existing.find((tag) => tag.name.toLowerCase() === name.toLowerCase());
	if (match) return match;
	return call(migma.tags.create({ projectId, name, description: "Newsletter list (Mailcheap)" }));
}

// Subscribed people on the newsletter's list: the ones the next issue goes to.
export async function getListCount(migma, newsletter) {
	const result = await call(
		migma.contacts.list({ projectId: newsletter.migma.projectId, tags: newsletter.migma.tagId, status: "subscribed", limit: 1 })
	);
	return result?.count ?? 0;
}
