import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

// Resolve this file's directory in ESM the safe way (tsconfig sets
// module: "esnext", so `__dirname` isn't a bound global at the type
// level, and `import.meta.dirname` wasn't picked up by Next's config
// loader). Root is the monorepo directory — two levels up from
// apps/web — because that's where node_modules/next is hoisted.
const here = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(here, "..", "..");

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root to the monorepo so it can find
  // next/package.json. Without this, `next dev --turbopack` walks up
  // from src/app, stops at apps/web (no local node_modules/next), and
  // errors with "inferred your workspace root". See
  // node_modules/next/dist/docs/.../turbopack.md § Root directory.
  turbopack: {
    root: monorepoRoot,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
      {
        source: "/icon.svg",
        headers: [
          { key: "Content-Type", value: "image/svg+xml" },
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
      {
        source: "/icon-maskable.svg",
        headers: [
          { key: "Content-Type", value: "image/svg+xml" },
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
