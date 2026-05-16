# Observability — telemetry façade + Sentry hookup

Babun ships a telemetry façade at
`apps/web/src/lib/observability/telemetry.ts` that defaults to **no-op**
adapters. The app is wired to call the façade in three places:

1. **`lib/sync/sync-error-bus.reportSyncError`** — every Supabase write
   failure routed to the red «Ошибка синхронизации» pill is also
   forwarded to `captureException` with `subsystem: "sync"`.
2. **`lib/http/fetcher.fetchWithRetry`** (via the existing
   `reportFinalFailure: true` option) — exhausted retries against the
   wrapper land via the sync bus, which then forwards to telemetry.
3. **`app/global-error.tsx`** — top-level React error boundary calls
   `captureException` with `subsystem: "react"` + the Next.js digest.

Without an adapter installed, all of these are silent. The goal is: when
you're ready to enable real telemetry, **one file changes** — you swap
the no-op for a Sentry-backed adapter at boot time.

## Hooking Sentry

### 1. Install the SDK

```bash
cd babun-crm/apps/web
npm install @sentry/nextjs
```

This adds Sentry's Next.js wrapper. It also wants a build-time CLI
(`npx @sentry/wizard@latest -i nextjs`) but you can do the minimal
manual setup below if you prefer to avoid the wizard touching
`next.config.ts`.

### 2. Env vars

In `.env.local` (and Vercel project settings):

```
NEXT_PUBLIC_SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
SENTRY_AUTH_TOKEN=<token-for-source-maps>           # optional
SENTRY_ORG=<your-org>                                # optional
SENTRY_PROJECT=babun-web                             # optional
```

`NEXT_PUBLIC_SENTRY_DSN` is the only required one. The others enable
source-map upload + release tagging at build time.

### 3. Install the adapter

Create `apps/web/src/lib/observability/sentry-adapter.ts`:

```ts
import * as Sentry from "@sentry/nextjs";
import type { TelemetryAdapter } from "./telemetry";

export function buildSentryAdapter(): TelemetryAdapter {
  return {
    captureException: (error, ctx) => {
      Sentry.captureException(error, ctx ? { extra: ctx } : undefined);
    },
    captureMessage: (msg, level = "info", ctx) => {
      Sentry.captureMessage(msg, { level, extra: ctx });
    },
    setUser: ({ tenantId, userId, userEmail }) => {
      Sentry.setUser(
        userId
          ? {
              id: userId,
              ...(userEmail ? { email: userEmail } : {}),
              ...(tenantId ? { tenant_id: tenantId } : {}),
            }
          : null,
      );
    },
    setTag: (k, v) => Sentry.setTag(k, v),
  };
}
```

### 4. Initialise at boot

In `apps/web/src/app/layout.tsx` (above the `RootProvider`):

```tsx
"use client";

import { useEffect } from "react";
import { installTelemetry } from "@/lib/observability/telemetry";
import { BUILD_VERSION } from "@babun/shared/common/utils/version";
import * as Sentry from "@sentry/nextjs";

if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    release: BUILD_VERSION,
    tracesSampleRate: 0.1,        // adjust later
    replaysSessionSampleRate: 0,  // off by default; turn on after audit
    replaysOnErrorSampleRate: 1,  // capture replay only on error
  });

  // Lazy import to keep main bundle clean for users without Sentry.
  void import("@/lib/observability/sentry-adapter").then(({ buildSentryAdapter }) => {
    installTelemetry(buildSentryAdapter());
  });
}
```

For server-side errors, create `apps/web/sentry.server.config.ts` and
`apps/web/sentry.edge.config.ts` per the Sentry-Next.js docs.

### 5. Source maps + release tagging

If you set `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT`,
Sentry's webpack plugin uploads sourcemaps on every Vercel build and
tags the release as `BUILD_VERSION` (because we pass it above). After
the first deploy each error will deep-link to the exact line in the
PR.

## What lands in Sentry today (after install)

| Source                             | Tag(s)              | When |
|------------------------------------|---------------------|------|
| `reportSyncError(err)` callers     | `subsystem: sync`   | RLS / network / validation rejection on `tenant_state` backup, appointment upsert / delete |
| `fetchWithRetry` exhausted retries | (forwarded via bus) | 5xx / network blip past `retries` count |
| `global-error.tsx`                 | `subsystem: react`  | Any uncaught render error |
| Manual `captureException`          | depends on caller   | Future call sites |

To verify the install works end-to-end:

```ts
import { captureMessage } from "@/lib/observability/telemetry";
captureMessage("Sentry smoke test", "info");
```

Hit Sentry's «Issues» list. If you see «Sentry smoke test» — wired.

## When you DON'T want Sentry

Set `NEXT_PUBLIC_SENTRY_DSN` to empty / unset. The `if` guard in
`layout.tsx` skips `Sentry.init` entirely; `installTelemetry` is never
called; the façade stays on the no-op. No bundle impact since the
dynamic import won't fire either.

## Privacy

- `setUserContext` accepts optional `userEmail`. Don't pass it unless
  the user has opted in to product-analytics-style identification. The
  user `id` alone is enough to dedupe.
- Sentry's default scrubber covers tokens / cookies / Authorization
  headers. We don't ship any custom breadcrumbs that contain PII
  beyond what the user typed into a form right before the crash —
  that's a Sentry-side scrub configuration decision.

## Open follow-ups (not blocked by this scaffold)

- §5.4 Lighthouse audit + perf budget. Sentry can also do «Performance»
  spans; budget tuning is a separate sprint.
- §5.6 source-map uploads in CI. Set the env vars above and the
  webpack plugin handles it.
- Per-tenant rate-limiting + sample-rate downgrade for noisy ones.
