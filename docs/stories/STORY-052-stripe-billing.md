# STORY-052 — Stripe billing (Free / Pro / Business / Lifetime)

Status: G0 done, decisions locked. G1 SQL drafting.

## Locked decisions

1. **SMS quota override stays.** `tenant_sms_config.free_quota_per_month`
   remains a per-tenant override. The helper resolves
   `coalesce(override, tier_default(plan))`. Override is rare by design
   — use for support extensions, promo grants, debug situations.
2. **`plan_override` is NOT shielded** the way `twilio_auth_token` was.
   Owners can read their own override via standard SELECT. Not a
   security boundary; settings UI hides the field by default
   (operational convenience, no separate RPC).
3. **Quota enforcement = server-side repo wrappers for v1.**
   `createClient` / `createAppointment` / `/api/invite` check
   `tenant_quota_*` before INSERT and return typed RU error on
   over-limit. Trade-off acknowledged: a direct PostgREST hit could
   theoretically bypass — defended by RLS but not by quota. Logged as
   STORY-052b backlog: add Postgres BEFORE INSERT triggers for
   defense-in-depth.
4. **`billing_events` retention = forever.** Stripe handles permanent
   event retention server-side; ours is for our app audit + idempotency
   dedup. A 7-year janitor can land later if the table grows past ~1M
   rows.

## Surprises confirmed

- Webhook receiver is a Next API route (Node runtime), NOT a Supabase
  Edge Function. Stripe SDK is Node-only and signature verification
  needs raw body bytes from `req.text()`.
- `@stripe/stripe-js` (browser SDK) is NOT installed. Stripe Checkout
  is a server-built redirect URL — `window.location.href = url` is
  the entire client integration. Saves ~50 KB.
- `STRIPE_SECRET_KEY` lives in Vercel env, not Edge Function Secrets.
  Routes that need Stripe are in `apps/web/src/app/api/stripe/*`.
- Plan changes propagate to `tenants.plan` via webhook, not via the
  server action that creates the Checkout session. Stripe is the
  single source of truth — webhook reconciles state.

## Goal

Multi-tenant SaaS billing through Stripe for the four tiers below.
14-day free trial on every Pro / Business upgrade.

## Pricing (locked)

| Tier | Price | Clients | Appointments / mo | SMS / mo (Babun) | Team | Notes |
|---|---|---|---|---|---|---|
| Free | €0 | 100 | 50 | 10 | 1 | default for new tenants |
| Pro | €15 | 1,000 | unlimited | 200 | 5 | 14-day trial |
| Business | €40 | unlimited | unlimited | BYOK | unlimited | branded SMS, priority support |
| Lifetime | €0 | unlimited | unlimited | BYOK | unlimited | manual `plan_override`, not public |

## Checkpoint flow

- G0 Discovery — read-only inventory + halt for spec lock
- G1 DB schema migration — review BEFORE apply
- G2 Stripe Customer + Checkout / Portal server actions — review BEFORE deploy
- G3 `/api/stripe/webhook` route + offline Vitest cases — review BEFORE deploy
- G4 Quota enforcement (clients / appointments / team / SMS reuse) — review BEFORE deploy
- G5 Settings UI: current plan, comparison, usage, billing history — review BEFORE commit
- G6 Free-tier quota integration in existing pages (disabled CTAs + tooltips)
- G7 Smoke (mostly automated; deferred bits: real Stripe Checkout, real subscription cycle)
- G8 Bump `v368-stripe` + push
- G9 Production verify + AirFix lifetime grant SQL

## G5 Settings UI — query-string handling spec (locked for implementation)

After Stripe Checkout redirects back, the Settings page receives
either `?session_id={...}` (success) or `?canceled=1` (cancel).
The webhook is the single source of truth for `tenants.plan`, so
the page reads the current `plan` field and decides the toast:

- `?session_id=…` AND `tenants.plan === 'free'` → toast
  «Платёж обрабатывается. Если изменения не появились через
  минуту — обнови страницу.» (webhook hasn't landed yet — Stripe
  callback typically arrives within seconds, but we don't block on
  it).
- `?session_id=…` AND `tenants.plan !== 'free'` → toast
  «Подписка {plan_ru} активирована» (success; webhook already
  reconciled).
- `?canceled=1` → toast «Оплата отменена. Можно попробовать снова.»

After surfacing the toast, the page should `router.replace()` to
strip the query params so a refresh doesn't re-fire the toast.

## Owner Stripe one-shot checklist (lock-in)

1. Register Stripe account on `support@babun.app`.
2. **Enable Stripe Tax** — `Settings → Tax → Enable Stripe Tax`.
   Register Cyprus VAT MOSS. Without this, every Checkout session
   creation fails with `tax_not_configured` (caught + surfaced as
   «Налоговая настройка не завершена…» in the UI).
3. Create products + prices in the Dashboard.
4. Set Vercel env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`.
5. Configure webhook endpoint `https://babun.app/api/stripe/webhook`
   — events listed in G3.

## Lessons applied from previous stories

- **Webhook idempotency via unique constraint** — same as `sms_messages.twilio_sid UNIQUE` from STORY-047.
- **Two-stage signature verification** — Stripe SDK's `constructEvent()` is the canonical path; we still gate on the presence of `Stripe-Signature` before reading the body.
- **Service-role bypass** — `billing_events` writes from the webhook need explicit `grant + service_role_all` policy (STORY-053b lesson).
- **Vitest offline test suite** — same shape as the Twilio webhook G6 (9 cases).
- **Edge Function Secrets pattern** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`. Webhook receiver is a Next API route (uses `process.env`), not an Edge Function.
- **Schema changes outside agreed scope = STOP + ask.**
