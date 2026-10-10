export const APP_NAME = "Mailcheap";
export const MIN_SESSION_SECRET_LENGTH = 32;

// SESSION_SECRET signs sessions and encrypts each account's Migma key, so a short one keeps the server
// from starting and the dashboard from logging in.
export function getConfigProblems(env = process.env) {
	const problems = [];
	if ((env.SESSION_SECRET ?? "").length < MIN_SESSION_SECRET_LENGTH) {
		problems.push(
			`SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters (generate one with: openssl rand -base64 48).`
		);
	}
	return problems;
}

// Kill switch for local development: nothing reaches a real inbox unless this is "true".
export function isSendingEnabled() {
	return process.env.SENDING_ENABLED === "true";
}

// On Vercel, the project's production domain stands in until APP_URL is set.
export function getAppUrl() {
	const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
	return (process.env.APP_URL || (vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000")).replace(/\/$/, "");
}

export function getMigmaApiUrl() {
	return (process.env.MIGMA_API_URL || "https://api.migma.ai/v1").replace(/\/$/, "");
}

export const MIGMA_APP_URL = "https://migma.ai";
export const MIGMA_API_KEYS_URL = `${MIGMA_APP_URL}/settings/api-keys`;

export const LIMITS = {
	maxEmailBytes: 100_000,
	// Where the bounce rate turns amber: Migma warns at 2% on instant domains, 5% on custom ones.
	bounceRate: 0.02,
};
