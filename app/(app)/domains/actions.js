"use server";

import { revalidatePath } from "next/cache";
import { requireMigma } from "@/lib/auth";
import { call } from "@/lib/migma";

const PREFIX_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/;
const DOMAIN_PATTERN = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function revalidateDomains() {
	revalidatePath("/domains");
	revalidatePath("/");
}

// "https://Mail.Example.com/" is mail.example.com.
function readDomain(value) {
	return String(value ?? "")
		.trim()
		.toLowerCase()
		.replace(/^[a-z]+:\/\//, "")
		.replace(/[/?#].*$/, "")
		.replace(/\.$/, "");
}

// Your own domain, added to Migma. Migma answers with the DNS records to add, and a page that adds them
// for you on supported DNS providers.
export async function addDomain(_state, formData) {
	const { migma } = await requireMigma();
	const domain = readDomain(formData.get("domain"));
	if (!DOMAIN_PATTERN.test(domain)) return { error: "Enter a domain, like mail.example.com" };
	if (domain.endsWith(".migma.email")) return { error: "Instant domains are created below" };

	try {
		await call(migma.domains.create({ domain }));
	} catch (error) {
		return { error: error.message || "Migma didn't add the domain" };
	}
	revalidateDomains();
	return { ok: true, domain };
}

// Asks Migma to look up the DNS records now, instead of waiting for its next check.
export async function checkDomain(domain) {
	const { migma } = await requireMigma();
	const name = readDomain(domain);
	if (!DOMAIN_PATTERN.test(name)) return { error: "Domain not found" };

	try {
		const result = await call(migma.domains.verify(name));
		revalidateDomains();
		const isVerified = result?.allVerified === true || result?.status === "verified";
		const issues = Array.isArray(result?.dnsIssues) ? result.dnsIssues.filter((issue) => typeof issue === "string") : [];
		return { ok: true, isVerified, issues: issues.slice(0, 3) };
	} catch (error) {
		return { error: error.message || "Migma couldn't check the domain" };
	}
}

// An instant <prefix>.migma.email domain: verified at once, no DNS. Migma caps it at 50 recipients a
// day, enough to try things before adding your own domain.
export async function createInstantDomain(_state, formData) {
	const { migma } = await requireMigma();
	const prefix = String(formData.get("prefix") ?? "").trim().toLowerCase();
	if (!PREFIX_PATTERN.test(prefix)) return { error: "Use 3 to 63 lowercase letters, digits and hyphens" };

	try {
		const domain = await call(migma.domains.createManaged({ prefix }));
		revalidateDomains();
		return { ok: true, domain: domain?.domain ?? `${prefix}.migma.email` };
	} catch (error) {
		return { error: error.message || "Migma didn't create the domain" };
	}
}
