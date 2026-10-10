import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No page cache to configure: archive pages render on each visit from D1.
export default defineCloudflareConfig({});
