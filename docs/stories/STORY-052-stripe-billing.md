# STORY-052 — Stripe billing (Free / Pro / Business / Lifetime)

Status: **CLOSED** — pipeline live in production behind lazy-fail
(STRIPE_* env vars not yet set). Awaiting Owner Stripe one-shots
before flipping the system fully on.

## Final shipped contents

| Gate | Commit | What |
|---|---|---|
| G1 | `444fe17` | tenant billing columns + billing_events + 6 quota helpers |
| G2 | `9c975ea` | Stripe SDK lazy-singleton + 3 server actions (Customer/Checkout/Portal) |
| G3 | `627ef99` | /api/stripe/webhook + 10 Vitest cases (signature + idempotency + status mapping) |
| G4 | `87472d7` | quota gates at 4 write paths + 8 Vitest cases + offline replayer pre-gate |
| G5+G5b | `4dc68e6` | Settings billing UI (page + 5 components) + reusable Toast infrastructure |
| G6 | `ec77498` | quota nudges (banner + disabled CTAs + tooltips) at clients/calendar/team pages |

## Production state

- `https://babun.app/sw.js` → `CACHE_VERSION = "babun-v368"`
- `BUILD_VERSION = "v368-stripe"` (sidebar footer)
- `/api/stripe/webhook` returns 503 `stripe_not_configured` until env is set (lazy-fail confirmed live)
- `/dashboard/settings/billing` accessible to Owners (verified 307 unauthenticated)
- Quota gates: G4 server-side (createClient/createAppointment/invite/replayer), G6 UI (banners + disabled CTAs)
- Master switch: Stripe pipeline is inert by env presence, not by `app_settings` flag

## G7 smoke summary

Active Vitest suites: **36/36 pass**.
- 9 sync/format (RU pluralization + relative time + op labelling)
- 9 sms/twilio-webhook (signature + status mapping + idempotency)
- 10 billing/stripe-webhook (signature + idempotency + 6 events + 2 lookup paths)
- 8 billing/quota (under/at/over limits + lifetime + team_members + UTC month boundary)

Deferred to user verification (require real Stripe test mode):
- Real Checkout completion with test card `4242 4242 4242 4242`
- Real subscription billing cycle (renew, fail, recover)
- Real webhook signature from Stripe Dashboard

## Awaiting Owner one-shots

1. Register Stripe account on `support@babun.app`.
2. **Enable Stripe Tax** (`Settings → Tax → Enable`). Register Cyprus VAT MOSS.
3. Create products + prices: "Babun Pro" €15/mo + "Babun Business" €40/mo.
4. Set Vercel env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`.
5. Configure webhook endpoint `https://babun.app/api/stripe/webhook` with these events:
   - `customer.subscription.created` / `.updated` / `.deleted`
   - `invoice.payment_succeeded` / `.payment_failed`
   - `customer.subscription.trial_will_end`
6. Test Checkout with card 4242 → verify webhook → flip a real tenant to Pro → verify UI.
7. Once verified end-to-end → register AirFix tenant → manual `UPDATE tenants SET plan_override='lifetime' WHERE id=...`.

## Tech debt logged for STORY-052b

- `npm run db:types` regen → replace `supabase as any` casts at five call sites (twilio webhook, billing actions, billing quota-action, stripe webhook, quota helper, billing settings page).
- Postgres BEFORE INSERT triggers on clients/appointments/invitations as defense-in-depth quota backstop (Path C — covers any PostgREST writer not just app code).
- Audit `public` schema service_role grants for consistent default (read-only opt-in writes).

## Tech debt logged for STORY-052c

- Admin panel for cross-tenant billing event audit (v1 = SQL Editor sufficient for solo founder).

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

## Backlog logged for STORY-052c

- **Admin panel for billing event audit.** When a multi-person
  support team eventually appears, a UI for searching across
  tenants' billing_events history would beat raw SQL access. v1 =
  solo founder + SQL Editor is acceptable.

## Backlog logged for STORY-052b

- **Path C — Postgres BEFORE INSERT triggers** on clients,
  appointments, invitations calling the `tenant_quota_*` SQL
  helpers. Defense-in-depth covering ANY PostgREST writer (not
  just our app code). v1 ships Path B (replayer pre-check inside
  the offline drain loop), which closes the offline-replay
  loophole specifically; the trigger backstop covers the rest.
- **DB types regen** (`npm run db:types`) + replace `supabase as any`
  casts at the four call sites (twilio webhook, billing actions,
  stripe webhook, quota helper).
- **Structured logging for unknown-MessageSid + orphan billing
  events** — currently `console.warn`. Future move to a structured
  log sink for security-review hygiene.

## Sprint A scope context (locked)

Architecture pattern locked for the foreseeable future:
- `babun.app` (Next.js web) — primary surface for desktop owners.
- iOS / Android — React Native, after Mac hardware arrives (~6-8 weeks).
- Desktop — Tauri wraps the same web app (~1-2 weeks after RN).
- Supabase backend shared forever.

Sprint A (now → Mac arrival) finishes the web backend for production.
After Sprint A: register AirFix tenant, run the manual lifetime grant
SQL, then pause Babun web work. Sprint B (React Native) starts when
the Mac is on the desk.

Out-of-scope-for-this-sprint (RN era):
- Sidebar / splash micro-feedback (deferred to RN polish).
- iPhone push acceptance test (web Push works; native push lands in RN).
- STORY-053c pull-to-refresh wiring (native gesture in RN).

## Lessons applied from previous stories

- **Webhook idempotency via unique constraint** — same as `sms_messages.twilio_sid UNIQUE` from STORY-047.
- **Two-stage signature verification** — Stripe SDK's `constructEvent()` is the canonical path; we still gate on the presence of `Stripe-Signature` before reading the body.
- **Service-role bypass** — `billing_events` writes from the webhook need explicit `grant + service_role_all` policy (STORY-053b lesson).
- **Vitest offline test suite** — same shape as the Twilio webhook G6 (9 cases).
- **Edge Function Secrets pattern** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`. Webhook receiver is a Next API route (uses `process.env`), not an Edge Function.
- **Schema changes outside agreed scope = STOP + ask.**
