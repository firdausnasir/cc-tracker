import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Prisma out of the Next bundle so OpenNext can patch the client for
  // the Workers (workerd) runtime. Required for @prisma/adapter-d1.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],

  // Baseline security headers (PWA hardening). No service-worker route here —
  // this build is install-only, with no sw.js to special-case.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;

// Makes the Cloudflare bindings (D1, etc.) available via getCloudflareContext()
// during `next dev`. No-op in the production Workers build.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();
