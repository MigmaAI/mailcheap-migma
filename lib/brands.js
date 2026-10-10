// A Migma brand (a "project" in Migma's API). Contacts, lists and sends all belong to one, so every
// newsletter has a brand; people just don't have to pick it.
const IMPORTING = new Set(["pending", "processing"]);
const HOSTNAME_PATTERN = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function toBrand({ _id, name, domain, logoUrls, status }) {
	return {
		id: String(_id),
		name: name || domain || "Untitled brand",
		domain: domain || null,
		// The favicon is square, so it also works as a newsletter's image.
		logoUrl: logoUrls?.favicon || logoUrls?.primary || null,
		// Migma is still reading the brand's website: no logo or colors yet, and it can't send or design.
		importing: IMPORTING.has(status),
		// Migma couldn't read the website. The brand exists but can't send until a retry works.
		failed: status === "error",
	};
}

// A to Z. Failed brands stay in the list so a newsletter on one can say so; pickers leave them out.
export function toBrands(projects) {
	return projects.map(toBrand).sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

// "acme.com", "www.acme.com/about" or a full link, as the https:// address Migma reads a brand from.
export function toBrandWebsite(value) {
	const text = String(value ?? "").trim();
	if (!text || /\s/.test(text)) return null;
	let url;
	try {
		url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
	} catch {
		return null;
	}
	if (url.username || url.password || url.port) return null;
	if (!HOSTNAME_PATTERN.test(url.hostname)) return null;
	url.protocol = "https:";
	url.hash = "";
	return url.href;
}

// The site a website or a brand's domain points at, so "https://www.acme.com/" and "acme.com" match.
export function toSiteHost(value) {
	const website = toBrandWebsite(value);
	return website ? new URL(website).hostname.replace(/^www\./, "") : null;
}

// The account's brand for a website, if it already has one Migma could read (or is still reading).
export function findBrandForSite(brands, website) {
	const host = toSiteHost(website);
	return (host && brands.find((brand) => !brand.failed && toSiteHost(brand.domain) === host)) || null;
}
