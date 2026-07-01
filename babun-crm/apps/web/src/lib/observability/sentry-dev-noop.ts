// Dev-only no-op stand-in for `@sentry/nextjs`.
//
// Turbopack dev under the **bun** runtime cannot load Sentry's
// `require-in-the-middle` external — it rewrites the specifier to a
// hashed name (`require-in-the-middle-<hash>`) that bun can't resolve,
// which 500s every SSR page. Sentry never runs locally anyway (no
// `NEXT_PUBLIC_SENTRY_DSN`), so when `NEXT_PUBLIC_DEV_NO_SENTRY=1` the
// Turbopack `resolveAlias` in next.config.ts swaps the real SDK for
// these no-ops. The flag lives only in `.env.local` (gitignored), so
// production builds never see this file — zero prod impact.

export function init(): void {}
export function captureException(): void {}
export function captureMessage(): void {}
export function setUser(): void {}
export function setTag(): void {}
export function setContext(): void {}
export function setTags(): void {}
export function withScope(): void {}
export function addBreadcrumb(): void {}

// Present so a token-bearing local build (unlikely) still type-checks.
export function withSentryConfig<T>(config: T): T {
  return config;
}
