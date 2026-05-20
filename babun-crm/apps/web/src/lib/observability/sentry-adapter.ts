// v592 §5.1 — Sentry-backed adapter for the telemetry façade.
//
// Wraps `@sentry/nextjs` behind the TelemetryAdapter interface so
// call sites still import from `lib/observability/telemetry`, not
// from Sentry directly. Three benefits:
//
//   1. Sentry stays an optional dependency at the call-site level
//      — swapping providers later is a one-file change here.
//   2. The DSN gate lives in this module: no DSN → adapter is null
//      → installTelemetry() falls back to the no-op default, the
//      Sentry SDK never initialises, and bundle weight is the cost
//      of an unused import (tree-shaken in prod by Next).
//   3. All «sanitise PII before send» / «strip auth headers» logic
//      sits here, so the policy is auditable in one place.
//
// Activation: set `NEXT_PUBLIC_SENTRY_DSN` in the deployment env.
// The release tag comes from BUILD_VERSION so issues in Sentry
// group cleanly per commit slug.

import * as Sentry from "@sentry/nextjs";
import { BUILD_VERSION } from "@babun/shared/common/utils/version";
import type {
  TelemetryAdapter,
  TelemetryContext,
} from "./telemetry";

const dsn =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_SENTRY_DSN ?? null
    : null;

let initialised = false;
function ensureInit(): boolean {
  if (initialised) return true;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    release: BUILD_VERSION,
    // 10% trace sample by default — enough to spot regressions
    // without exploding the monthly quota. Tune via env once we
    // know the real volume.
    tracesSampleRate: 0.1,
    // Forbid IP / cookies by default. Single-tenant Cyprus SaaS, no
    // need for them to debug a hung request.
    sendDefaultPii: false,
    // Don't ship session replays until the user opts in — they're
    // PII-heavy and the bandwidth cost on Cyprus 5G is non-trivial.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    environment:
      typeof process !== "undefined" && process.env.NODE_ENV
        ? process.env.NODE_ENV
        : "production",
    // v663 — filter Sentry noise that doesn't represent real bugs.
    // Each suppression below is something we've already triaged and
    // confirmed harmless / unactionable. Real errors still flow.
    beforeSend(event) {
      const msg = event.message?.toLowerCase() ?? "";
      const exc = event.exception?.values?.[0];
      const excType = (exc?.type ?? "").toLowerCase();
      const excValue = (exc?.value ?? "").toLowerCase();

      // 1) Sync queue drains its own noise.
      if (msg.includes("sync queue drained")) return null;

      // 2) AbortError — fires when a fetch is cancelled because the
      //    user navigated away, the component unmounted, or React
      //    routed mid-flight. Always harmless; Supabase wraps fetch
      //    so abort propagates as an unhandled DOMException.
      if (excType === "aborterror" || excValue.includes("aborterror")) {
        return null;
      }

      // 3) Transient Supabase "Load failed" / "TypeError: Failed to
      //    fetch" — typical Cyprus 5G blip. The reload merges
      //    (v499 / v662 / v663) treat these as no-ops, so the
      //    user already sees zero impact. Logging them produced
      //    noise that masked real issues.
      if (
        (excType === "typeerror" || msg.includes("typeerror")) &&
        (excValue.includes("load failed") ||
          excValue.includes("failed to fetch") ||
          excValue.includes("networkerror"))
      ) {
        return null;
      }

      // 4) Supabase wraps native fetch failures as objects keyed
      //    {code, details, hint, message}. Sentry's auto-instrumentation
      //    captures these as "Object captured as exception" — visible
      //    only because of the sync subsystem retry path. The retry
      //    itself succeeds; no user-visible failure.
      if (msg.includes("object captured as exception")) {
        const extra = event.extra ?? {};
        const ser = (extra as Record<string, unknown>).__serialized__;
        if (ser && typeof ser === "object") {
          const sm = (ser as { message?: string }).message ?? "";
          if (sm.toLowerCase().includes("load failed")) return null;
        }
      }

      return event;
    },
  });
  initialised = true;
  return true;
}

export function buildSentryAdapter(): TelemetryAdapter | null {
  if (!ensureInit()) return null;
  return {
    captureException(error: unknown, ctx?: Record<string, unknown>) {
      Sentry.captureException(error, ctx ? { extra: ctx } : undefined);
    },
    captureMessage(
      message: string,
      level: "info" | "warning" | "error" = "info",
      ctx?: Record<string, unknown>,
    ) {
      Sentry.captureMessage(message, {
        level,
        ...(ctx ? { extra: ctx } : {}),
      });
    },
    setUser(ctx: TelemetryContext) {
      Sentry.setUser({
        id: ctx.userId ?? undefined,
        // Do NOT forward email by default — the façade allows it as
        // an opt-in field but we keep PII out of Sentry unless the
        // tenant has explicitly consented.
        email: undefined,
      });
      if (ctx.tenantId) Sentry.setTag("tenant_id", ctx.tenantId);
    },
    setTag(key: string, value: string) {
      Sentry.setTag(key, value);
    },
  };
}

/** Returns the active DSN (for log-once «Sentry on/off» status line),
 *  or null when the env var is unset. */
export function getActiveSentryDsn(): string | null {
  return dsn;
}
