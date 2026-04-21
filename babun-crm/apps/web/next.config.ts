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
  // Bookmarks, history search, copy-paste — every short URL the
  // dispatcher might type or remember points to /dashboard/<x>. Without
  // these aliases the user lands on a 404 (Sprint 024 STORY-008/C5).
  async redirects() {
    return [
      { source: "/clients", destination: "/dashboard/clients", permanent: false },
      { source: "/finances", destination: "/dashboard/finances", permanent: false },
      { source: "/expenses", destination: "/dashboard/expenses", permanent: false },
      { source: "/payroll", destination: "/dashboard/payroll", permanent: false },
      { source: "/reports", destination: "/dashboard/reports", permanent: false },
      { source: "/chats", destination: "/dashboard/chats", permanent: false },
      { source: "/route", destination: "/dashboard/route", permanent: false },
      { source: "/waitlist", destination: "/dashboard/waitlist", permanent: false },
      { source: "/recurring", destination: "/dashboard/recurring", permanent: false },
      { source: "/reminders", destination: "/dashboard/recurring", permanent: false },
      { source: "/settings", destination: "/dashboard/settings", permanent: false },
      { source: "/services", destination: "/dashboard/services", permanent: false },
      { source: "/teams", destination: "/dashboard/teams", permanent: false },
      { source: "/masters", destination: "/dashboard/masters", permanent: false },
      { source: "/brigades", destination: "/dashboard/brigades", permanent: false },
      { source: "/schedule", destination: "/dashboard/schedule", permanent: false },
      { source: "/sms", destination: "/dashboard/sms-templates", permanent: false },
      { source: "/today", destination: "/dashboard", permanent: false },
      { source: "/calendar", destination: "/dashboard", permanent: false },
    ];
  },
};

export default nextConfig;
