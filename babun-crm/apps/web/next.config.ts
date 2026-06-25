import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import path from "path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "url";

// Resolve this file's directory in ESM the safe way (tsconfig sets
// module: "esnext", so `__dirname` isn't a bound global at the type
// level, and `import.meta.dirname` wasn't picked up by Next's config
// loader). Root is the monorepo directory — two levels up from
// apps/web — because that's where node_modules/next is hoisted.
const here = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(here, "..", "..");

const nextConfig: NextConfig = {
  // STORY-035 G0 — workspace package compiled by SWC, not pre-bundled.
  // @babun/shared lives in packages/shared/src/, ships TypeScript
  // sources, and uses subpath exports.  Without transpilePackages,
  // Next 16 emits "Module not found" for `@babun/shared/common/...`
  // because it treats workspace packages as pre-built node_modules
  // and skips the SWC type-stripping pass.
  transpilePackages: ["@babun/shared"],
  // Pin Turbopack's workspace root to the monorepo so it can find
  // next/package.json. Without this, `next dev --turbopack` walks up
  // from src/app, stops at apps/web (no local node_modules/next), and
  // errors with "inferred your workspace root". See
  // node_modules/next/dist/docs/.../turbopack.md § Root directory.
  turbopack: {
    root: monorepoRoot,
    // Local dev under bun: Turbopack can't load Sentry's
    // `require-in-the-middle` external (hashed specifier bun can't
    // resolve → 500 on every SSR page). Swap the SDK for a no-op shim
    // when the .env.local-only flag is set. No-op in prod (flag unset).
    ...(process.env.NEXT_PUBLIC_DEV_NO_SENTRY === "1"
      ? {
          resolveAlias: {
            "@sentry/nextjs": "./src/lib/observability/sentry-dev-noop.ts",
          },
        }
      : {}),
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
      // Routes that have a real /dashboard/<slug> page — pass-through
      // aliases for bookmarks and history search.
      { source: "/clients", destination: "/dashboard/clients", permanent: false },
      { source: "/finances", destination: "/dashboard/finances", permanent: false },
      { source: "/chats", destination: "/dashboard/chats", permanent: false },
      { source: "/recurring", destination: "/dashboard/recurring", permanent: false },
      { source: "/reminders", destination: "/dashboard/recurring", permanent: false },
      { source: "/settings", destination: "/dashboard/settings", permanent: false },
      { source: "/services", destination: "/dashboard/services", permanent: false },
      { source: "/teams", destination: "/dashboard/teams", permanent: false },
      { source: "/masters", destination: "/dashboard/masters", permanent: false },
      { source: "/sms", destination: "/dashboard/sms-templates", permanent: false },
      { source: "/today", destination: "/dashboard", permanent: false },
      { source: "/calendar", destination: "/dashboard", permanent: false },

      // v512 — these short URLs used to redirect to /dashboard/<slug>
      // pages that physically don't exist (finance got merged into
      // /dashboard/finances as a tabbed UI; «бригады» was renamed to
      // /dashboard/teams in v510; «расписание» lives on the calendar
      // home). Without these rewrites the dispatcher's bookmarks hit
      // a white 404. Point them at the live screens instead.
      { source: "/expenses", destination: "/dashboard/finances?tab=expenses", permanent: false },
      { source: "/payroll", destination: "/dashboard/finances?tab=payroll", permanent: false },
      { source: "/reports", destination: "/dashboard/finances?tab=summary", permanent: false },
      { source: "/brigades", destination: "/dashboard/teams", permanent: false },
      { source: "/schedule", destination: "/dashboard", permanent: false },
      // /route and /waitlist never had a real destination; route them
      // to the calendar home — a sane default rather than a 404.
      { source: "/route", destination: "/dashboard", permanent: false },
      { source: "/waitlist", destination: "/dashboard", permanent: false },

      // Old separate /dashboard/appointment/new route was replaced by
      // an in-page AppointmentSheet — catch bookmarks and share links
      // with a ?new=1 flag the dashboard picks up at mount.
      { source: "/dashboard/appointment/new", destination: "/dashboard?new=1", permanent: false },
      { source: "/dashboard/appointment", destination: "/dashboard", permanent: false },
    ];
  },
};

// STORY-060b — bundle analyzer wired behind ANALYZE env var so
// `ANALYZE=true npm run build` produces per-route bundle sheets.
// No-op for normal dev/prod builds. Useful when chasing First Load JS
// budgets or hunting an unexpected dependency that landed in the
// client chunk.
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const analyzed = withBundleAnalyzer(nextConfig);

// ── Sentry source maps → readable prod stack traces ───────────────
// Wrap with withSentryConfig ONLY when SENTRY_AUTH_TOKEN is present
// (set it in the Vercel Production env). This keeps token-less builds —
// local dev, any build without the secret — byte-identical to before,
// so adding this can't break the live build until the token is
// deliberately set.
//
// Turbopack-safe upload: `useRunAfterProductionCompileHook` uploads the
// maps in one pass AFTER `next build` finishes instead of hooking the
// (non-existent under Turbopack) webpack compilation — the supported
// path for Next 15.4.1+. The upload release MUST equal the SDK release
// (`BUILD_VERSION`, set in sentry-adapter.ts) or Sentry won't apply the
// maps to events; we read it from version.ts at config-eval time.
const sentryRelease = (() => {
  try {
    const src = readFileSync(
      path.resolve(monorepoRoot, "packages/shared/src/common/utils/version.ts"),
      "utf8",
    );
    return src.match(/BUILD_VERSION\s*=\s*["']([^"']+)["']/)?.[1];
  } catch {
    return undefined;
  }
})();

export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(analyzed, {
      org: "babun",
      project: "babun-web",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      useRunAfterProductionCompileHook: true,
      widenClientFileUpload: true,
      silent: !process.env.CI,
      ...(sentryRelease ? { release: { name: sentryRelease } } : {}),
    })
  : analyzed;
