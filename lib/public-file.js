import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// A file from public/. Workers have no disk, so a deployed app reads it through the Cloudflare assets
// binding; `next dev` reads it from disk.
export async function readPublicFile(path, origin) {
	const { env } = await getCloudflareContext({ async: true }).catch(() => ({ env: {} }));
	if (env.ASSETS) {
		const response = await env.ASSETS.fetch(new URL(path, origin));
		return response.ok ? Buffer.from(await response.arrayBuffer()) : null;
	}
	return readFile(join(process.cwd(), "public", path)).catch(() => null);
}
