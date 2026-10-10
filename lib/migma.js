import "server-only";
import { Migma } from "migma";
import { getMigmaApiUrl } from "@/lib/config";
import { toBrands } from "@/lib/brands";
import { open } from "@/lib/secret-box";
import { toSendingDomains } from "@/lib/sending-domains";

// Every Migma call goes through the connected account's own key, so Migma decides what each account
// can see and do. Nothing here holds a key of its own.
export function migmaWithKey(apiKey) {
	return new Migma(apiKey, { baseUrl: getMigmaApiUrl(), maxRetries: 2 });
}

export function migmaFor(account) {
	return migmaWithKey(open(account.apiKey));
}

export class MigmaRequestError extends Error {
	constructor(message, status, reason = message) {
		super(message);
		this.name = "MigmaRequestError";
		this.status = status;
		// Migma's own words, for refusals that aren't about the key (a plan limit, say).
		this.reason = reason;
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
	if (error) throw new MigmaRequestError(describe(error), error.statusCode, error.message);
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
	return toBrands(projects);
}

// Migma reads the website for the brand's name, logo, colors and fonts. The brand shows up in the
// account right away and is ready when its import is "active", usually within a minute.
export async function startBrandImport(migma, website) {
	const { projectId } = await call(migma.projects.import({ urls: [website] }));
	return String(projectId);
}

export async function getBrandImport(migma, projectId) {
	const { status, name, domain, error } = await call(migma.projects.getImportStatus(projectId));
	return { status, name: name || null, domain: domain || null, error: error || null };
}

export async function retryBrandImport(migma, projectId) {
	await call(migma.projects.retryImport(projectId));
}

// Custom domains and instant *.migma.email domains (lib/sending-domains.js).
export async function listSendingDomains(migma) {
	const [custom, managed] = await Promise.all([call(migma.domains.list()), call(migma.domains.listManaged())]);
	return toSendingDomains(custom ?? [], managed ?? []);
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
