// A Migma brand (a "project" in Migma's API) as the newsletter form shows it.
const IMPORTING = new Set(["pending", "processing"]);
const HOSTNAME_PATTERN = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function toBrand({ _id, name, domain, logoUrls, status }) {
	return {
		id: String(_id),
		name: name || domain || "Untitled brand",
		domain: domain || null,
		// The favicon is square, so it also works as a newsletter's image.
		logoUrl: logoUrls?.favicon || logoUrls?.primary || null,
		// Migma is still reading the brand's website: no logo or colors yet.
		importing: IMPORTING.has(status),
	};
}

// Brands people can pick, A to Z. A failed import isn't a brand yet.
export function toBrands(projects) {
	return projects
		.filter(({ status }) => status !== "error")
		.map(toBrand)
		.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
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
