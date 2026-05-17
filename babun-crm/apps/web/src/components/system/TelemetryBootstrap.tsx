"use client";

import { useEffect } from "react";
import { installTelemetry } from "@/lib/observability/telemetry";
import {
  buildSentryAdapter,
  getActiveSentryDsn,
} from "@/lib/observability/sentry-adapter";

// v592 §5.1 — Mounts once at the root layout to wire the telemetry
// façade to its Sentry-backed adapter. No-ops cleanly when
// `NEXT_PUBLIC_SENTRY_DSN` isn't set (buildSentryAdapter returns
// null → installTelemetry falls back to the no-op default).
//
// Why a client component instead of `instrumentation-client.ts`:
// keeps the bootstrap visible in the component tree alongside
// AuthClearListener, which is the existing «mount-once side-effects»
// pattern in this codebase. One less convention to remember.
//
// Side-effects-only — renders nothing.

export function TelemetryBootstrap(): null {
  useEffect(() => {
    const adapter = buildSentryAdapter();
    if (adapter) {
      installTelemetry(adapter);
      // One-time console line so the dispatcher knows error
      // capture is on; lives in dev too so the team notices when
      // the DSN is missing locally.
      const dsn = getActiveSentryDsn();
      // eslint-disable-next-line no-console
      console.info(
        `[telemetry] Sentry active · release=BUILD_VERSION · dsn=${dsn?.slice(0, 36)}…`,
      );
    }
  }, []);
  return null;
}
