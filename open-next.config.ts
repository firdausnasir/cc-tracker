import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Auth-gated, fully dynamic app — no ISR, so no incremental-cache override needed.
export default defineCloudflareConfig({});
