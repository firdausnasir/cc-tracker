import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server output (`.next/standalone`): node-file-trace copies
  // only the node_modules the server actually needs, keeping the Docker image
  // small (drops next/swc, icon/date libs, and other build-only deps).
  output: "standalone",

  // Keep Prisma out of the Next bundle; the client + its query engine are loaded
  // from node_modules at runtime (traced into standalone), not webpacked.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],

  // Statement-PDF import rides in a Server Action body; the default 1 MB cap
  // rejects real statements before the action's own 8 MB check runs. Lift to
  // 10 MB — headroom over the 8 MB file cap for multipart encoding overhead.
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },

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
