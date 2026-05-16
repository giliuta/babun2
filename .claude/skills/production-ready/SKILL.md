---
name: production-ready
description: Final pre-ship gate. Runs the full four-level checklist and outputs a go / no-go with red items. Disabled from autoinvoke.
allowed-tools: Read, Grep, Glob, Bash
disable-model-invocation: true
---

Run the production-readiness checklist:

- All pages under `babun-crm/apps/web/src/app/` have green CI on master (last 24h) — check via `gh run list --branch master --limit 10`.
- Sentry P0 / P1 issues count = 0 in the last 24h.
- Lighthouse mobile ≥ 90 on all priority routes (`/dashboard`, `/clients`, `/appointments`, `/finances`, `/calendar`).
- Cross-tenant RLS probes pass on every table that has a `tenant_id` column.
- Russian copy 100 % (no untranslated keys; no hard-coded English in JSX).
- PWA installable; offline page renders.
- Stripe / Resend / Twilio webhooks have idempotency keys and signature verification.
- `BUILD_TAG` and `CACHE_VERSION` are bumped on the latest deploy.
- No `any` or `as unknown as` left under `babun-crm/apps/web/src/`.

Output a Markdown report. Exit code 0 only if all green. Otherwise exit 2 (which any wrapping CI job will treat as a failure).

The dispatcher should pin the report into `docs/PRODUCTION_READY.md` and include a Telegram summary if `TG_BOT_TOKEN` is set.
