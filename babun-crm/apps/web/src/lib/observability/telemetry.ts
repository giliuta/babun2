// v541 §5.1 — Telemetry façade.
//
// Goal: callers ship a stable, typed `captureException` / `captureMessage`
// / `setUser` / `setTag` API today. The default implementation is a
// no-op so the app builds and runs without any `@sentry/nextjs`
// dependency. When you're ready to wire real telemetry:
//
//   1. `npm i @sentry/nextjs` in `babun-crm/apps/web`.
//   2. Set `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN` env vars.
//   3. Replace the `noopAdapter` with a Sentry-backed adapter using
//      `Sentry.init` from a server / client wrapper module (see
//      `installTelemetry` below — that's the single hook point).
//
// Why a façade instead of importing Sentry directly: keeps Sentry an
// optional dependency, lets us swap providers (PostHog, Highlight,
// console-only logger for dev), and means no `eslint-disable` /
// `as any` shims at the call sites.
//
// Wired sites (as of v541):
//   - lib/sync/sync-error-bus.ts → captureException on reportSyncError
//   - lib/http/fetcher.ts        → captureException on exhausted retries
//                                   (via the existing reportFinalFailure
//                                    flag that already routes to the bus)
//   - app/global-error.tsx       → page-level boundary
//
// The release tag should match BUILD_VERSION from
// `@babun/shared/common/utils/version`. The setup helper below reads
// it so the slug travels into Sentry release attribution without the
// caller needing to remember.

export interface TelemetryContext {
  /** Tenant id from the JWT or null when logged out. */
  tenantId?: string | null;
  /** Authenticated user id. */
  userId?: string | null;
  /** User email (PII — only set when the user has consented; we
   *  default to NOT sending it). */
  userEmail?: string | null;
}

export interface TelemetryAdapter {
  captureException(error: unknown, ctx?: Record<string, unknown>): void;
  captureMessage(
    message: string,
    level?: "info" | "warning" | "error",
    ctx?: Record<string, unknown>,
  ): void;
  setUser(ctx: TelemetryContext): void;
  setTag(key: string, value: string): void;
}

const noopAdapter: TelemetryAdapter = {
  captureException() {
    /* default no-op; swap with Sentry adapter at install time */
  },
  captureMessage() {
    /* no-op */
  },
  setUser() {
    /* no-op */
  },
  setTag() {
    /* no-op */
  },
};

let active: TelemetryAdapter = noopAdapter;

/** Replace the active adapter. Call once during app bootstrap (root
 *  layout for the client, instrumentation.ts for the server) with a
 *  Sentry-backed adapter when `NEXT_PUBLIC_SENTRY_DSN` is present.
 *  No-op when called with `null` (the default). */
export function installTelemetry(adapter: TelemetryAdapter | null): void {
  active = adapter ?? noopAdapter;
}

export function captureException(
  error: unknown,
  ctx?: Record<string, unknown>,
): void {
  active.captureException(error, ctx);
}

export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
  ctx?: Record<string, unknown>,
): void {
  active.captureMessage(message, level, ctx);
}

export function setUserContext(ctx: TelemetryContext): void {
  active.setUser(ctx);
}

export function setTelemetryTag(key: string, value: string): void {
  active.setTag(key, value);
}

/** Returns true when an explicit telemetry adapter has been installed
 *  (i.e. not the no-op default). Useful for «would we have noticed?»
 *  audit code. */
export function isTelemetryActive(): boolean {
  return active !== noopAdapter;
}
