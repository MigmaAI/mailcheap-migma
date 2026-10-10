// Migma's sending domain records, shaped for the Domains page and the overview. Pure: no Migma calls.

// ready: can send. dns: waiting for its DNS records. failed: Migma gave up checking until asked again.
// suspended: Migma stopped it for bounces or complaints.
export const DOMAIN_STATES = ["ready", "dns", "failed", "suspended"];

function toDate(value) {
	return value ? new Date(value).toISOString() : null;
}

function rate(value) {
	const number = Number(value);
	return Number.isFinite(number) ? number : null;
}

export function toSendingDomain(raw) {
	const managed = Boolean(raw.isManagedDomain) || /\.migma\.email$/.test(raw.domain);
	const verified = raw.isVerified === true || raw.status === "verified" || raw.status === "degraded";
	const state = raw.status === "suspended" ? "suspended" : verified ? "ready" : raw.status === "failed" ? "failed" : "dns";
	const health = raw.health && typeof raw.health === "object" ? raw.health : null;
	return {
		domain: raw.domain,
		status: raw.status,
		state,
		verified,
		managed,
		region: raw.regionName || raw.region || null,
		dkimStatus: raw.dkimStatus ?? null,
		mailFromDomain: raw.mailFromDomain ?? null,
		mailFromStatus: raw.mailFromStatus ?? null,
		connectUrl: raw.connectUrl ?? null,
		verifiedAt: toDate(raw.verifiedAt),
		checkedAt: toDate(raw.lastDnsCheckAt),
		suspensionReason: raw.suspensionReason ?? null,
		issues: Array.isArray(raw.dnsIssues) ? raw.dnsIssues.filter((issue) => typeof issue === "string") : [],
		tracking: { opens: raw.openTracking !== false, clicks: raw.clickTracking !== false, branded: raw.brandedTracking === true },
		health: health && {
			status: health.status ?? null,
			bounceRate: rate(health.bounceRate),
			complaintRate: rate(health.complaintRate),
			sent: Number(health.totalSent) || 0,
			// Migma only judges a domain's rates after this many sends.
			minVolume: Number(raw.thresholds?.minVolume) || (managed ? 50 : 100),
		},
		records: (raw.dnsRecords ?? []).map(({ type, name, value, priority, status }) => ({
			type,
			name,
			value,
			priority: priority ?? null,
			status: status ?? null,
		})),
	};
}

const STATE_ORDER = { ready: 0, dns: 1, suspended: 2, failed: 3 };

// Custom and instant domains in one list, without repeats: ready ones first (your own before instant
// ones), then the ones waiting for DNS.
export function toSendingDomains(custom = [], managed = []) {
	const seen = new Set();
	return [...custom, ...managed]
		.filter((raw) => raw?.domain && !seen.has(raw.domain) && seen.add(raw.domain))
		.map(toSendingDomain)
		.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || Number(a.managed) - Number(b.managed));
}

export function groupDomains(domains) {
	return Object.fromEntries(DOMAIN_STATES.map((state) => [state, domains.filter((domain) => domain.state === state)]));
}
