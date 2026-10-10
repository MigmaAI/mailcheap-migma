import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// No script-src: Next.js's inline scripts would need per-request nonces, which archive pages can't have
// while they're cached (ISR). script-src-attr still blocks inline event handlers everywhere.
const CONTENT_SECURITY_POLICY = [
	"frame-ancestors 'none'",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"script-src-attr 'none'",
].join("; ");

const SECURITY_HEADERS = [
	{ key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
	{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
	poweredByHeader: false,
	images: {
		remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
	},
	async headers() {
		return [{ source: "/:path*", headers: SECURITY_HEADERS }];
	},
};

// `next dev` gets the Cloudflare bindings (the local D1 database in .wrangler/) from wrangler.jsonc.
export default function config(phase) {
	if (phase === PHASE_DEVELOPMENT_SERVER) initOpenNextCloudflareForDev();
	return nextConfig;
}
