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

**Status as of v592: SDK installed, adapter wired, bootstrap mounted.**
The only step left is dropping a DSN into the deployment env — see §2
below. The rest of this section documents what the v592 commit did
and where to extend it.

### 1. Install the SDK

Already done in v592 — `@sentry/nextjs` is in `apps/web/package.json`.
For reference: the install was a plain `npm i @sentry/nextjs` (no
wizard, no `next.config.ts` rewrites — the wizard's macros aren't
needed because we route everything through the façade).

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

### 3. Adapter — already wired

Lives at `apps/web/src/lib/observability/sentry-adapter.ts`. Shape:

- `buildSentryAdapter()` returns a `TelemetryAdapter` when
  `NEXT_PUBLIC_SENTRY_DSN` is set; returns `null` otherwise.
- On first call (with DSN), runs `Sentry.init({...})` with:
  - `release = BUILD_VERSION` — issues group per commit slug
  - `tracesSampleRate: 0.1`
  - `sendDefaultPii: false`
  - `replaysSessionSampleRate: 0` / `replaysOnErrorSampleRate: 0`
  - `beforeSend` filter that drops «sync queue drained» noise
- `setUser` deliberately omits email — opt-in PII channel is a
  later commit.

### 4. Bootstrap — already wired

`apps/web/src/components/system/TelemetryBootstrap.tsx` mounts
once at the root layout (next to `AuthClearListener`). On mount it
calls `installTelemetry(buildSentryAdapter())`. Logs a one-time
`[telemetry] Sentry active · …` console line when the DSN is wired
so the team notices when it's missing locally.

For server-side errors you can additionally drop
`apps/web/sentry.server.config.ts` + `apps/web/sentry.edge.config.ts`
per the Sentry-Next.js docs — the façade pattern doesn't preclude
them, but isn't currently using them.

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
