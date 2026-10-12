import { findBrandForSite, toSiteHost } from "./brands.js";

// Subdomains people send from; their site is the domain above them (mail.acme.com sends for acme.com).
const SENDING_SUBDOMAINS = new Set(["mail", "mails", "email", "send", "news", "newsletter", "updates", "hello", "mg", "em", "m"]);

function siteFromSendingDomain(domain) {
	const labels = domain.split(".");
	return labels.length > 2 && SENDING_SUBDOMAINS.has(labels[0]) ? labels.slice(1).join(".") : domain;
}

function titleCase(label) {
	return label.charAt(0).toUpperCase() + label.slice(1);
}

// What a new newsletter's form starts with, from what the account already has: its last newsletter's
// sender details, or for a first newsletter its own sending domain and brands. Everything is editable;
// nothing here is saved until the person creates the newsletter.
export function suggestNewsletter({ newsletters = [], brands = [], sendingDomains = [] }) {
	const last = newsletters.at(-1);
	if (last) {
		const brand = brands.find(({ id }) => id === last.migma?.projectId);
		return {
			fromName: last.fromName || "",
			fromEmail: last.fromEmail || "",
			replyTo: last.replyTo || "",
			postalAddress: last.postalAddress || "",
			projectId: brand && !brand.failed ? brand.id : null,
			website: brand?.domain ? (toSiteHost(brand.domain) ?? "") : "",
			source: "newsletter",
		};
	}

	const domain =
		sendingDomains.find(({ verified, managed }) => verified && !managed) ?? sendingDomains.find(({ verified }) => verified);
	const site = domain && !domain.managed ? siteFromSendingDomain(domain.domain) : null;
	const brand = (site && findBrandForSite(brands, site)) || null;
	const company = brand?.name ?? (site ? titleCase(site.split(".")[0]) : null);
	if (!domain && !brand) return null;
	return {
		name: company ? `${company} Newsletter` : "",
		fromName: company ?? "",
		fromEmail: domain ? `hi@${domain.domain}` : "",
		replyTo: "",
		postalAddress: "",
		projectId: brand?.id ?? null,
		website: site ?? "",
		source: "account",
	};
}
