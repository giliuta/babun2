# STORY-044b — Product analytics + feedback button

**Status:** `parked` — plan approved on architecture; paused on sequencing. Unpark after STORY-052 (Stripe) closes, before internal alpha with Дима. See `docs/backlog.md`.
**Estimate:** 2.
**Dependencies:** none (drops in alongside existing dashboard).
**Blocks:** funnel/cohort dashboards (PostHog UI side, no story); session recordings (separate story with explicit consent).

## Why

We've shipped 14 stories and have zero visibility into how users actually use Babun. Are they bouncing after onboarding? Do they ever import CSV? How often do they invite a teammate? We're guessing. Add product analytics + a one-tap "Сообщить о проблеме" channel so the next iteration is informed by data, not vibes.

## G0 — Decisions (locked from your brief, with architect calls)

- **D1. Vendor: PostHog Cloud EU free tier.** 1M events/mo, EU data residency = GDPR-friendly without DPAs, no credit card. Plausible has no funnels; Umami needs us to run a server; custom analytics in Supabase doubles the work. PostHog wins on features-per-effort.
- **D2. Privacy stance: strict mode + in-app only.** No cookies, no `distinctId` localStorage, `persistence: 'memory'`. We track only authenticated dashboard sessions, never the marketing landing or `/login`. Logged-in users have already accepted ToS — analytics on tools they're using inside a paid (eventually) account falls under "legitimate interest / necessary for service improvement" per GDPR Art. 6(1)(f). **No cookie banner.** This is the same posture Linear, Cal.com, and Notion run.
- **D3. Identifier: `posthog.identify(user.id)`.** Supabase UUID, no email. Person properties: `tenant_id` (raw UUID — not personally identifying), `user_role`, `platform`, `app_version`. Never `email`, `name`, `phone`, or any text from `clients`/`appointments` tables.
- **D4. Abstraction layer: `apps/web/src/lib/analytics/track.ts`.** All call sites use `track('client.created', { ... })`. Swap PostHog later without grepping the whole repo. Server-only `import` boundary so it can't leak into RSC.
- **D5. Email infra: install `resend` SDK fresh.** Despite "Resend SMTP уже настроен" — only Supabase Auth's outbound SMTP is configured today. The `resend` npm pkg is not integrated. Add env var `RESEND_API_KEY`, single helper at `apps/web/src/lib/email/send.ts`. From: `Babun Feedback <noreply@babun.app>`, Reply-To: submitter's email, To: `support@babun.app`.
- **D6. SDK loading: dynamic + dashboard-only.** PostHog SDK initialised inside `DashboardClientLayout` (same place we just moved `ServiceWorkerRegister` for STORY-045). `next/dynamic` with `ssr: false`. Landing page LCP stays untouched at 2.4s.
- **D7. PostHog account: owner one-shot.** You spend 5 min creating the account at https://eu.posthog.com/signup with `airfix.cy@gmail.com` and copy the project API key into Vercel env vars. Agent-via-Playwright would burn 30+ min and need to handle 2FA / CAPTCHAs. Document in this STORY's setup steps.
- **D8. Feedback button placement: bottom-right above bottom tab bar.** Fixed `bottom: env(safe-area-inset-bottom) + 80px` on mobile (clears `BottomTabBar` z-40), `bottom: 24px` on desktop. Z-50 so it overlays everything. 56×56 circular FAB, accent fill, `MessageCircle` icon. Authenticated routes only.
- **D9. Feedback storage: email only, no DB.** Skip a `feedback` table. Resend → support@babun.app → Cloudflare → your inbox. No RLS, no cleanup job, no surface area to defend. If volume grows past ~5/day we revisit and add a Supabase table.
- **D10. Cookie banner: skip.** Direct consequence of D2. Privacy page text updated to mention PostHog as a sub-processor with EU hosting + how to opt-out via DevTools localStorage flag (advanced users).

## G1 — PostHog account setup (owner action, ~5 min)

1. Open https://eu.posthog.com/signup → sign up with `airfix.cy@gmail.com`.
2. Project name: `Babun`. Region: **EU** (Frankfurt). Use case: SaaS product.
3. Copy the **Project API Key** (starts with `phc_...`). This is public-safe (client-side).
4. In Vercel → Project `babun2` → Settings → Environment Variables, add:
   - `NEXT_PUBLIC_POSTHOG_KEY` = `phc_...` (Production + Preview + Development)
   - `NEXT_PUBLIC_POSTHOG_HOST` = `https://eu.i.posthog.com` (same scopes)
   - `RESEND_API_KEY` = your existing Resend key (Production only — server-side, not `NEXT_PUBLIC_*`)
5. Redeploy by triggering a new build on master (or just push the implementation commit — it'll redeploy automatically).
6. In PostHog UI → Project settings → toggle off "Autocapture" (we'll send explicit events). Toggle off "Capture pageview" (we'll instrument route changes manually). Toggle off "Session recording" (separate consent story).

## G2 — Provider integration

**Files:**
- `apps/web/src/lib/analytics/posthog.ts` — module-level singleton, lazy init, returns `posthog | null`.
- `apps/web/src/lib/analytics/track.ts` — public surface: `track(event, props)`, `identify(userId, traits)`, `reset()`.
- `apps/web/src/components/analytics/PostHogBoot.tsx` — `"use client"` component that calls init in `useEffect` and identifies the user from props.

**Wiring:**
- `DashboardClientLayout` mounts `<PostHogBoot userId={...} tenantId={...} role={...} />` near the `<ServiceWorkerRegister />` line we added in STORY-045. Same gating: anon visitors on landing/login/register never load PostHog.
- `LoginForm` / `RegisterForm` `onSuccess` → call `track('auth.login_completed' | 'auth.signup_completed')` then router.push (track fires before navigation; the next page mount picks up identify via PostHogBoot).

**Hard rules:**
- `track()` is a no-op if `window === undefined` or `posthog === null`. Calls from server components don't crash; they just don't fire.
- `posthog.opt_out_capturing()` if a user has set `localStorage['babun-analytics-opt-out'] = '1'` (advanced opt-out, no UI for now per D10).
- Default props on every event: `tenant_id`, `user_role`, `platform: 'mobile' | 'desktop'`, `app_version: BUILD_VERSION`. Computed once at boot, attached via `posthog.register(...)`.

## G3 — Event taxonomy

| Event | Where | Properties |
|---|---|---|
| `auth.signup_completed` | `OnboardingWizard` step 4 finish | `tenant_type` |
| `auth.login_completed` | `LoginForm` onSuccess | — |
| `client.created` | `lib/clients.ts` createClient | `source: 'manual' \| 'csv' \| 'appointment_sheet'` |
| `client.deleted` | `lib/clients.ts` deleteClient | — |
| `client.imported_csv` | CSV wizard finish | `count`, `duplicates_skipped` |
| `appointment.created` | AppointmentSheet save (new) | `has_client`, `has_location` |
| `appointment.completed` | Status change to "completed" | `had_payment` |
| `appointment.cancelled` | Status change to "cancelled" | `reason_provided` |
| `invite.sent` | `/api/invite` route success | `role` |
| `invite.accepted` | `/invite/[token]` accept flow | `role` |
| `realtime.connected` | `useRealtimeTenantSync` channel SUBSCRIBED | `latency_ms` |
| `realtime.disconnected` | Channel CLOSED unexpectedly | `code` |
| `error.boundary` | New top-level `<ErrorBoundary>` | `message`, `component_stack_first_line` |
| `feedback.submitted` | After feedback POST 200 | `has_screenshot` |

`feature.used` is intentionally **dropped from v1** — it's a footgun. Every `<Button>` getting an event makes the dataset noisy. Add specific events when we actually need them.

**Property hygiene:** never pass through `client.name`, `client.phone`, `appointment.comment`, or any free-text the user typed. PR review checklist: grep for `track(.*name|.*email|.*phone|.*comment)`.

## G4 — Feedback FAB + modal

**Files:**
- `apps/web/src/components/feedback/FeedbackFab.tsx` — the floating button.
- `apps/web/src/components/feedback/FeedbackDialog.tsx` — the modal (use existing `SheetShell` for consistency).
- `apps/web/src/app/api/feedback/route.ts` — POST handler.
- `apps/web/src/lib/email/send.ts` — Resend wrapper.

**FAB:**
- Mounted inside `DashboardClientLayout` next to `<InstallPrompt />` and `<ServiceWorkerRegister />`.
- Position: `fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+96px)] lg:bottom-6 z-50` (96px clears `BottomTabBar` on iPhone with home-indicator safe area).
- 56×56 circle, `bg-[#1F66D7]` (the WCAG-clean blue we settled on in STORY-045 G6), white `MessageCircle` icon, `shadow-lg`.
- Hidden on the AppointmentSheet open state (would overlap save button) — listen to existing sheet-open context, or add a simple z-stacking rule.

**Dialog:**
- `SheetShell` centered modal (per your global `feedback_center_modals.md` memory).
- Title: `Сообщить о проблеме`.
- Subtext: `Что-то сломалось или работает не так? Опишите, что вы делали — мы прочитаем и ответим.`
- `<textarea>` `Что произошло?` (required, 6–500 chars, `placeholder="Например: при сохранении встречи приложение зависло."`).
- `<input type="file" accept="image/*">` `Прикрепить скриншот (необязательно)`. Read via `FileReader.readAsDataURL`, validate `≤ 5 MB`, show 60×60 preview thumb + remove button.
- Submit button `Отправить` (primary, disabled while submitting), Cancel button `Отмена`.
- On submit success → toast `Спасибо! Мы получили ваше сообщение.` (use existing `UndoToast` style, or add a tiny passive toast helper).
- On error → inline error `Не удалось отправить. Попробуйте ещё раз через минуту.`

**API route `POST /api/feedback`:**
- Auth: `getSupabaseServer().auth.getUser()` — reject anonymous with 401.
- Body schema: `{ message: string, screenshotBase64?: string, screenshotMime?: string, currentUrl: string, userAgent: string }`. Validate with zod (already a dep? if not, hand-rolled — message length 6-500, base64 ≤ 7MB raw → ~5MB binary).
- Resolve `tenant_id` and `user_role` server-side (don't trust client-supplied values).
- Send via `lib/email/send.ts`:
  - `from: 'Babun Feedback <noreply@babun.app>'`
  - `to: 'support@babun.app'`
  - `replyTo: user.email`
  - `subject: '[Babun feedback] ' + message.slice(0, 60)`
  - `text` body: full message + meta block (user_id, tenant_id, role, app_version, current_url, user_agent, timestamp).
  - `attachments`: if screenshot → `[{ filename: 'screenshot.png', content: <base64-decoded buffer> }]`.
- Track `feedback.submitted` server-side via PostHog server-side capture? **No** — keep PostHog client-only for v1, fire `track()` on the client after the 200 response. Simpler.
- Return `{ ok: true }` on success.

**Resend helper `lib/email/send.ts`:**
```ts
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY!);
export async function sendEmail(opts: { to, from, replyTo, subject, text, attachments? }) { ... }
```
Throws on missing `RESEND_API_KEY`. Logs send_id on success. No retry — Resend handles transient failures internally.

## G5 — Privacy page update

`apps/web/src/app/privacy/page.tsx` — add a paragraph after the existing "Данные размещены в дата-центрах Supabase…" block:

> Для понимания того, как пользователи работают с Babun, мы используем PostHog Cloud EU — независимый сервис продуктовой аналитики с дата-центрами в Германии. Мы передаём в PostHog обезличенные события (например, "клиент создан", "встреча сохранена") и не передаём персональные данные клиентов: имена, телефоны, заметки и финансовые данные остаются только в нашей базе.

Add a short "Как отключить аналитику" paragraph: open DevTools console, run `localStorage.setItem('babun-analytics-opt-out', '1')`, reload.

No new ToS clauses needed.

## G6 — Smoke (7/7 mandatory)

Run on local prod build first, then again on Vercel prod after G7.

1. **Anon load** — open `babun.app/`, network tab: zero requests to `eu.i.posthog.com`. Landing performance unchanged.
2. **Login fires identify** — log in, network tab: one POST to `eu.i.posthog.com/i/v0/e/` with `event: '$identify'`, `distinct_id: <uuid>`, properties include `tenant_id` and `role`. No `email` field anywhere in the payload.
3. **Create client fires event** — add a client. Network: POST `e/` with `event: 'client.created'`, `properties.source: 'manual'`. PostHog UI → Live Events → row appears within 5 seconds.
4. **Logout resets** — log out. Network: POST `e/` with `event: '$reset'`. localStorage has no PostHog keys.
5. **Feedback flow** — open FAB → type "Тестовое сообщение" → no screenshot → submit. Toast appears. Within 30s an email lands at `support@babun.app` (your inbox via Cloudflare routing). Reply-To is your account email.
6. **Feedback with screenshot** — repeat with a 200KB screenshot. Email arrives with PNG attached, attachment opens cleanly.
7. **Opt-out works** — `localStorage.setItem('babun-analytics-opt-out', '1')` + reload. Create another client. Network: zero PostHog requests. Existing distinct_id still resets cleanly on next login.

## G7 — Bump v364-analytics + push

- `BUILD_VERSION = "v364-analytics"`
- `CACHE_VERSION = "babun-v364"`
- One commit. Don't bundle anything else into this push.

## G8 — Production verify

- Repeat smoke 1–7 against `https://babun.app/dashboard/clients` (logged-in flow on prod).
- Screenshot PostHog dashboard showing the 6 events from the smoke (Live Events list).
- Confirm Resend dashboard shows the 2 sent emails for steps 5+6.

## Acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| 1 | PostHog integrated, events flowing | G6 step 3 + G8 dashboard screenshot |
| 2 | Feedback button works, emails arrive | G6 steps 5+6 |
| 3 | Privacy compliance (no cookies, no PII, opt-out works) | G6 steps 1, 7 + privacy page update |
| 4 | Doesn't break existing flows | typecheck + manual smoke through clients/appointments/calendar |
| 5 | Smoke 7/7 passed | this doc updated with results |

## Out of scope (parked for follow-ups)

- Heatmaps (PostHog supports, no code)
- Session recordings (needs explicit consent UI — separate story)
- Funnels / cohorts (PostHog UI work, no code)
- A/B tests (separate story)
- Marketing landing analytics (would need cookie banner — defer until we add a sales pipeline)
- `feature.used` generic event (footgun — add specific events on demand)

## Risks

- **PostHog SDK weight (~30 KB gz)** — mitigated by D6 (dashboard-only, dynamic import).
- **PII leak via free-text** — mitigated by hard rule in D3 + grep checklist + no `comment`/`name`/`phone` properties anywhere in G3 taxonomy.
- **Email deliverability** — Resend has known issues with Gmail's spam filtering for new domains. We've already proven `noreply@babun.app` works for Supabase Auth, so DKIM/SPF/DMARC are correctly set. Should be fine; verify in G6 step 5.
- **Vendor lock-in** — mitigated by D4 abstraction layer.
- **Feedback FAB hides UI** — mitigated by D8 z-stacking rule (hidden on AppointmentSheet open).
- **`error.boundary` event spam during a real outage** — mitigate with a 1/min throttle in the boundary handler. Implement in G3.

## Why this is `044b` and not `054`

We numbered analytics as `STORY-044` originally in early planning but the slot was reused for `STORY-044-schedule-supabase`. `044b` keeps the analytics-related stories grouped if we add `044c` (recordings) later, while not pretending it's a continuation of schedule-supabase.
