# REMAINING-WORK-2026-05-17 — Story plans for the remaining ~26 items

Companion to `docs/sprints/SPRINT-FINAL-2026-05-17.md`. That scoreboard
listed what's done; this doc gives the next session/agent ready-to-go
mini-plans for what's left. Each section is sized so it can be picked
up as a focused 1-day → multi-day work item.

Pick one, do `/plan STORY-NNN`, ship it. Do not try to do them all in
one session — the volume is real, and the parallel-agent coordination
overhead this multi-session push exposed means batching small items
across days is the right cadence.

---

## STORY-046 — CSV Client Import (Brief 3 #5 / #15, Brief 2 #27)

**Status:** Parked stub at `/dashboard/clients/import` shows «Импорт скоро».
The honest banner copy shipped in v558. Real importer is this story.

**Size:** 1-2 days focused work.

**AC:**
1. Accept .csv upload (max 5 MB, max 10 000 rows).
2. Detect column delimiters (`,` / `;` / `\t`) and quote chars.
3. Header row preview: dropdowns map source columns → tenant client
   fields (full_name, phone, email, address, notes, tags).
4. Per-row validation: phone format normalised (+357…), duplicate
   detection by (phone OR email).
5. Conflict preview: «X новых, Y дубль (skip/update), Z с ошибками».
6. Bulk insert via Supabase RPC with one round-trip per 500 rows.
7. Progress bar; on cancel — rollback whatever batches haven't
   committed yet.
8. Final summary screen with «Открыть импортированных» CTA.

**Files to touch:**
- `app/dashboard/clients/import/page.tsx` (replace stub)
- new shared util `packages/shared/src/common/utils/csv.ts` (parser)
- new Supabase RPC `bulk_insert_clients` migration
- existing `clients` repo for dedup query

---

## STORY-052 — Stripe Tariff Grid + Checkout (Brief 2 #15)

**Status:** Settings/billing route exists but rendering tariffs is
placeholder. Stripe SDK is wired (see `lib/stripe/`) and quota
infrastructure exists (`useTenantQuota`).

**Size:** 1 day.

**AC:**
1. `PricingTable.tsx` component renders 3 plans: Free / Pro / Business
   with feature checkmarks + monthly EUR.
2. Current plan highlighted; upgrade buttons hide for current.
3. Click "Pro" → `stripe.checkout.sessions.create()` via existing
   server action, redirect to Stripe-hosted page.
4. Success URL → `/dashboard/settings/billing?upgraded=1` shows toast
   «Подписка Pro активирована», refreshes quota.
5. Cancel URL → returns to billing page silently.
6. Webhook handler `app/api/stripe/webhook/route.ts` updates
   `tenants.plan` on `checkout.session.completed`.

**Files to touch:**
- `app/dashboard/settings/billing/page.tsx` (~222 lines today, mostly placeholder)
- new `components/settings/billing/PricingTable.tsx`
- `app/api/stripe/webhook/route.ts` (new or extend existing)

**Env needed:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, plus
three `STRIPE_PRICE_ID_*` env vars for the plans.

---

## STORY-085+ — Online Booking Full Form (Brief 2 #16, Brief 3 #6 follow-up)

**Status:** Public `/book/[slug]` MVP shipped in v564 — renders brand
+ contact buttons + «форма скоро» placeholder.

**Size:** 1-2 days.

**AC:**
1. Form on the public page: name, phone, message, service picker
   (dropdown of tenant's `services.public_bookable = true` services),
   slot picker (date + time, snapped to team's `default_slot_minutes`).
2. Working-hours override: per-tenant fields `online_booking_start`,
   `online_booking_end`, `online_booking_weekdays[]` — fall back to
   `calendar_settings.workStartHour/EndHour`.
3. Slot availability: server query checks the tenant's appointments
   against requested slot, excludes already-booked + buffer.
4. Submission inserts row with `is_online_booking=true,
   status='pending_review'`. Tenant sees it as a pending banner on
   /dashboard.
5. Prepay toggle (per-service): `prepay_percent` or `prepay_fixed`
   field. When set, after form submit redirect to Stripe Checkout for
   the prepay amount; on success, appointment goes to
   `status='scheduled', prepaid_amount=X`.
6. Anti-spam: hCaptcha widget + per-IP rate-limit (3 submissions / hour).
7. Confirmation message: customizable per-tenant string with `{name}`
   `{date}` `{time}` `{address}` tokens.

**Files to touch:**
- `app/book/[slug]/page.tsx` (extend MVP)
- new `app/book/[slug]/submit/route.ts`
- migration: add booking fields to `tenants` + `services` tables
- new Supabase RPC `is_slot_available(tenant_id, date, start, end)`

---

## STORY-090 — Multi-Team Multi-Select Calendar (Brief 2 #5)

**Status:** Today the calendar has `activeTeamId: string` — one team
at a time, plus the personal-tab pinned at index 0.

**Size:** 2-3 days (architectural).

**AC:**
1. Header tab strip allows multi-select via long-press (touch) /
   Ctrl-click (desktop). Selected tabs get a checked indicator.
2. State: `activeTeamIds: string[]` (always ≥ 1).
3. Calendar grid merges appointments from all selected teams; each
   AppointmentBlock keeps its team-tinted left-edge stripe so the
   user can tell whose visit is whose.
4. Conflict detection runs per-team-pair (a Sat 14:00 visit on
   «Север» and «Юг» is two different teams, not a conflict).
5. Filter UI in headers: «Все · Север · Юг · Только моё».
6. Personal-tab toggle stays separate (it's not a team).

**Files to touch:**
- `app/dashboard/page.tsx` — `activeTeamId` → `activeTeamIds[]`, many places
- `components/calendar/DayColumn.tsx` — accept multi-team appointments
- `components/calendar/AppointmentBlock.tsx` — already uses teamColor prop, no change
- `components/layout/Header.tsx` — long-press / Ctrl-click selection logic

**Risk:** This is the biggest refactor in the remaining list — every
place that reads `activeTeamId` needs review. Budget time for QA.

---

## STORY-091 — Recurrence Engine + Custom Pattern UI (Brief 2 #18)

**Status:** `PersonalEventRepeat` type has 7 `kind`s but ONLY the
type exists — no expansion engine that turns a rule into actual
calendar occurrences. v585 verified this.

**Size:** 1 day.

**AC:**
1. Extend type with `{ kind: "custom_weekdays"; days: number[];
   until?: string; count?: number }` plus a `count?: number` field
   on existing kinds (terminate after N occurrences).
2. New pure helper `expandRepeat(seed: Appointment, horizonEnd: Date):
   Appointment[]` that returns the virtual occurrences in a window.
   Hard cap at 365 occurrences regardless of rule to bound memory.
3. `dashboard/page.tsx` calls the helper when building
   `visibleAppointments` for the week/month being rendered. Virtual
   occurrences carry a `virtualParentId` field — clicking opens the
   parent for editing.
4. `RepeatPickerRow` in PersonalEventBlocks: add «Дни недели» chip
   that opens a 7-checkbox row (Пн Вт Ср Чт Пт Сб Вс) and a «N раз»
   numeric input alongside the existing «Завершить» date picker.
5. Save persists the new shape unchanged.

**Files to touch:**
- `packages/shared/src/local/appointments.ts` (extend union)
- new `packages/shared/src/common/utils/expand-repeat.ts`
- `app/dashboard/page.tsx` (call expander)
- `components/calendar/PersonalEventBlocks.tsx` (extend picker UI)

---

## STORY-092 — Drag-Resize Appointment Bottom Edge (Brief 1 #18)

**Status:** dnd-kit currently moves whole blocks (start time, day).
Resize is a separate gesture not yet implemented.

**Size:** half-day.

**AC:**
1. `AppointmentBlock.tsx` gets a 6-px-tall handle div absolute-
   positioned at the bottom edge, cursor `row-resize` on hover.
2. Handle has its own `onPointerDown` that calls
   `event.stopPropagation()` so dnd-kit's draggable doesn't fire.
3. On pointer-down: capture pointer, record initial Y + initial
   `time_end` in minutes.
4. On pointer-move: compute `deltaMinutes` from `clientY` delta /
   `hourHeightRef.current * 60`, snap to 15 min. Show preview
   height live (CSS only, no setState — use a CSS variable on the
   block element).
5. On pointer-up: clamp `newEnd >= time_start + 15 min`, call
   `onResize?(apt, newEndHHMM)` which in dashboard/page.tsx calls
   `upsertAppointment` with the new `time_end`.
6. Conflict check via the existing `findOverlap` helper — toast
   warning, don't block.

**Files to touch:**
- `components/calendar/AppointmentBlock.tsx`
- `app/dashboard/page.tsx` (add `onResize` callback)

---

## STORY-093 — Google Calendar 2-Way Sync (Brief 2 #25)

**Status:** Webcal one-way feed shipped in v590. True 2-way sync is
a different beast.

**Size:** 3-5 days.

**AC:**
1. Settings page: «Подключить Google Calendar» button →
   `https://accounts.google.com/o/oauth2/v2/auth` with
   `https://www.googleapis.com/auth/calendar` scope. Save refresh
   token to new `google_calendar_links` table.
2. Initial pull: fetch user's primary calendar events from 30 days
   back, materialize them as Babun appointments with
   `source='google_calendar'` and a `gcal_event_id` field.
3. Push: every Babun appointment upsert publishes to Google via
   Calendar API. Conflict resolution: last-write-wins by
   `updated_at`.
4. Webhook: register a Google Calendar push notification channel
   (renewable every 7 days via a cron). On receive, fetch the
   delta and reconcile.
5. Unlink button: revoke token, delete `gcal_event_id` references,
   stop sync.

**Env needed:** `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`.

---

## STORY-094 — Webhooks for Developers (Brief 2 #30)

**Status:** Settings has no webhook UI; no infrastructure to fire
HTTP POSTs on domain events.

**Size:** 1 day.

**AC:**
1. New table `webhooks(id, tenant_id, url, events[], secret, active,
   created_at)`.
2. Settings page `/dashboard/settings/webhooks`: list webhooks +
   «Создать» modal (URL + events checklist + auto-generated secret).
3. Domain events fired: `appointment.created`, `appointment.updated`,
   `appointment.completed`, `appointment.cancelled`, `client.created`.
4. Server-side dispatcher: on event, fan out HTTP POST to every
   active webhook subscribed to that event. JSON body + HMAC-SHA256
   `X-Babun-Signature` header using the webhook's secret.
5. Retry: exponential backoff up to 5 attempts; on permanent failure
   mark `last_failure_at` + ping owner via in-app banner.

**Files to touch:**
- new migration for `webhooks` table
- new `app/dashboard/settings/webhooks/page.tsx`
- new `lib/webhooks/dispatch.ts`
- existing `upsertAppointment` / etc — emit events

---

## STORY-095 — i18n Base Scaffold (Brief 2 #29)

**Status:** Codebase is RU-only. Tailwind v4. Next 16.

**Size:** 1-2 days.

**AC:**
1. Install `next-intl` (`npm install next-intl`).
2. New `messages/` folder at app root with `ru.json` / `en.json` /
   `el.json`. Seed with ~200 most-common strings (nav, common
   buttons, calendar views, settings labels).
3. Locale segment in route: `/[locale]/dashboard/...` with middleware
   that redirects bare `/dashboard` → user's preferred locale or
   `ru` default.
4. Replace `~50` highest-traffic strings in code with
   `useTranslations('...')` calls. Don't translate everything in one
   shot — set up the infrastructure and let follow-ups expand.
5. Language picker in Settings → Аккаунт → Язык.

**Files to touch:**
- `package.json` (add next-intl)
- `messages/{ru,en,el}.json` (new)
- `app/[locale]/...` (route restructure)
- `app/middleware.ts` (locale routing)

---

## STORY-096 — Dark Theme (Brief 2 #28)

**Status:** Codebase says «Dark theme intentionally parked — explicit
user ask.» Light-only today.

**Size:** 2 days.

**AC:**
1. `app/globals.css` add a `[data-theme="dark"]` selector block
   overriding all ~60 `--surface-*`, `--label-*`, `--fill-*`,
   `--separator-*` tokens to dark equivalents.
2. New hook `useTheme()` reads/writes `localStorage["babun-theme"]`
   and writes the attribute on `<html>`. Respects
   `prefers-color-scheme: dark` when no explicit preference.
3. Settings → Аккаунт → Тема: 3-way toggle Light / Dark / System.
4. Per-component dark sanity pass: any component using a hex literal
   not from the token system gets caught in a follow-up sweep.
5. ServiceWorker cache bump so the new CSS lands.

**Files to touch:**
- `app/globals.css` (token overrides)
- new `hooks/useTheme.ts`
- `app/dashboard/settings/account/personal/page.tsx` (toggle UI)

---

## STORY-097 — Login History with GeoIP (Brief 2 #20)

**Status:** Placeholder card removed... or planned to be. Today shows
«Скоро».

**Size:** 1 day.

**AC:**
1. Server-side RPC `get_my_login_history(limit)` that reads
   `auth.audit_log_entries` (Supabase's private schema) for the
   caller's user_id and returns last N rows with timestamp + IP +
   user-agent string.
2. New GeoIP lookup function (use ipinfo.io free tier or
   ipapi.com) on the server, cached per-IP for 30 days.
3. `LoginHistorySection.tsx` becomes real — table with date, device
   icon (parsed from UA), city/country.
4. Suspicious-activity heuristic: flag rows where the country
   changed within < 2 hours.

**Env needed:** `IPINFO_TOKEN` or equivalent.

---

## STORY-098 — Email-OTP 2FA Factor (Brief 2 #21)

**Status:** Placeholder. Supabase MFA has TOTP working; email is
custom plumbing.

**Size:** 1 day.

**AC:**
1. New table `email_otp_factors(id, user_id, email, secret, created_at)`.
2. Enrollment: user enables → server sends 6-digit code to email,
   user types it back, factor activates.
3. Login: after password, if email factor active, send code, gate on
   verification.
4. Templates: reuse the existing Supabase email template system OR
   send via Resend/SendGrid if Supabase email is not configured.

---

## STORY-099 — Maps Embed + Auto-Buffer (Brief 1 #21 / #22)

**Status:** Address field has "Открыть в Картах" link. No embed, no
auto-buffer.

**Size:** 1-2 days.

**AC:**
1. Address field, when populated, renders a 160×120 px static map
   preview below using Google Static Maps API.
2. New «Маршрут» chip alongside the existing «Открыть» — opens
   Google Maps directions from previous appointment's address.
3. Auto-buffer: on save, server computes Distance Matrix between
   previous appointment's address and this one, suggests
   `time_start` = previous.time_end + travel_time + 5 min slack.
4. Toast if the new appointment would conflict because of buffer:
   «Ехать 35 мин, не успеть до 14:00 — сдвинуть на 14:35?» [Да /
   Оставить].

**Env needed:** `GOOGLE_MAPS_API_KEY` with Static Maps + Distance
Matrix products enabled.

---

## STORY-100 — Form Builder Split-View (Brief 1 #8)

**Status:** Appointment form is a single-column sheet today.

**Size:** 1 day.

**AC:**
1. New `/dashboard/settings/appointment-form/page.tsx` page.
2. Left half: list of available fields with toggle to enable/disable
   per the tenant's preference (some fields are mandatory and locked
   on).
3. Right half: live preview of the sheet as a real user would see it,
   updating as the user toggles fields.
4. Persist in `tenants.appointment_form_config jsonb`.
5. AppointmentSheet reads the config and renders accordingly (most
   blocks already gate on a flag).

---

## How to use this doc

For each story:

1. Copy the section into `docs/stories/STORY-NNN.md`.
2. Run `/plan STORY-NNN` to refine ACs with the user.
3. Implement in a dedicated branch `feature/STORY-NNN`.
4. PR / merge back to master per CLAUDE.md.

Don't try to do them all at once. The session-level coordination
overhead with parallel agents in this repo means batching small items
across days is the right cadence. Each story above is a clean, scoped
1-day to multi-day deliverable.
