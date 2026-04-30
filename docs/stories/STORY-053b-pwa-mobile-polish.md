# STORY-053b — PWA mobile polish

**Status:** `todo` — planning + G0 inventory done, awaiting `ok` before G1.
**Estimate:** 3–4 days.
**Dependencies:** none. Builds on existing PWA + auth + RLS.
**Blocks:** STORY-054 (offline-first) — must close this story fully first per user order.
**Numbering note:** `053b` not `053` — `053` is reserved for the dashboard contrast cleanup parked in `docs/backlog.md`. Both surfaced from STORY-045 G6; this one is the bigger scope.

## Why

Babun is sold as a phone-first PWA but today it lacks the polish that makes a web app feel "installed":
- No push notifications → masters don't know a new appointment landed unless they open the app.
- No swipe gestures on lists → desktop ergonomics on a phone.
- Install prompt is a default `beforeinstallprompt` capture without iOS guidance — most users on iPhone never install.
- Hardware back button on Android dismisses the whole page instead of just closing modals.

This story closes that gap so opening Babun on a phone feels like opening Telegram, not a website.

## G0 — Inventory (done 2026-04-30)

| Concern | State | Verdict |
|---|---|---|
| Service worker scope | `apps/web/public/sw.js`, scope `/`, cache `babun-v363`, push + notificationclick handlers already scaffolded (lines 102–138) | Reuse — push handler shows notifications correctly, just unused today |
| Haptic feedback | `apps/web/src/lib/haptics.ts` with `haptic("tap"\|"warning"\|"success")` — Android `navigator.vibrate`, iOS no-op fallback documented | **Already done. Reuse.** |
| Swipe gestures | `apps/web/src/components/ui/SwipeableRow.tsx` exists | **Already done. Reuse — wire into list rows.** |
| Animation library | None. CSS transitions + Tailwind classes everywhere | **Don't add framer-motion** — existing patterns are enough for this story |
| Install prompt | `apps/web/src/components/pwa/InstallPrompt.tsx` — uses `beforeinstallprompt`, generic copy, no iOS path | Replace with the wider modal in G5 |
| iOS Safari version detection | None | Add small `lib/platform.ts` util (UA parse + safe-area inset detection) |
| `web-push` server lib | Not installed | Install in G1 |
| `framer-motion` | Not installed | Skip — out of scope |
| VAPID keys | None | Generate in G1 |

**Implication:** scope is meaningfully smaller than the original brief because haptics + swipe + SW push handler are already there. Real work concentrates on the push subscription pipeline (G1–G3), the install modal rewrite (G5), and the back-button history layer (G6). Gestures (G4) is mostly wiring.

## G1 — Push notifications: foundation

### Decisions
- **D1.** **VAPID keys generated locally**, public key in Vercel env (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`), private key in **Supabase Vault** (`VAPID_PRIVATE_KEY`) — not Vercel env, because the sender will be a Supabase Edge Function so the secret should live next to the runner. (User asked for "Supabase secret" — that's Supabase Vault.)
- **D2.** **Sender = Supabase Edge Function `send_push`**, not Next API route. Pg trigger → `pg_net.http_post` to the function → function loads private key from Vault → calls `web-push` against subscription endpoint. This keeps fan-out logic at the DB and lets a row insert reach 5 subscriptions in one trigger run without round-tripping through a Vercel cold start.
- **D3.** **iOS support: 16.4+ home-screen PWA only.** Plain Safari iOS doesn't support web push. Subscribe button gates on `'serviceWorker' in navigator && 'PushManager' in window && (window.matchMedia('(display-mode: standalone)').matches || iOS<16.4 fallback message)`. iOS users not in PWA get a "Сначала установи приложение на главный экран" message instead of a broken subscribe.

### Schema migration
```sql
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  keys jsonb not null,        -- { p256dh, auth }
  device_label text,           -- 'iPhone 15 (Safari)' parsed from UA
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)   -- one row per device
);

create index push_subscriptions_user_idx on push_subscriptions (user_id);
create index push_subscriptions_tenant_idx on push_subscriptions (tenant_id);

alter table push_subscriptions enable row level security;

-- User sees only their own subscriptions
create policy push_subscriptions_select_own on push_subscriptions
  for select using (user_id = auth.uid());
create policy push_subscriptions_insert_own on push_subscriptions
  for insert with check (user_id = auth.uid());
create policy push_subscriptions_delete_own on push_subscriptions
  for delete using (user_id = auth.uid());
-- No update policy — subscriptions are insert-or-delete only
```

Migration filename: `supabase/migrations/20260501_001_push_subscriptions.sql`.

### Server-side helper
- `apps/web/src/app/api/push/subscribe/route.ts` (POST) — auth check, parse `{ endpoint, keys, deviceLabel }`, INSERT (ON CONFLICT DO NOTHING).
- `apps/web/src/app/api/push/unsubscribe/route.ts` (POST) — DELETE WHERE endpoint matches.

### Edge function
- `supabase/functions/send_push/index.ts` — Deno runtime, uses `web-push` Deno port. Receives `{ user_ids: uuid[], title, body, url }`, queries subscriptions, fans out, logs failures (410 Gone → delete subscription).

## G2 — Subscription flow (UI)

- New file `apps/web/src/components/pwa/EnableNotificationsPrompt.tsx`.
- Trigger: shown once when `sessionCount >= 2` (track in localStorage `babun-session-count`, increment on each `DashboardClientLayout` mount). Persistent dismissal sets `babun-push-prompt-dismissed-at` for 7 days.
- Sheet (centered modal per `feedback_center_modals.md` memory):
  - Title: `Включить уведомления?`
  - Body: `Приходи в курсе новых записей и заявок без открытия приложения.`
  - Two buttons: `Включить` (primary `#1F66D7`) / `Не сейчас` (outline).
- On `Включить` → request permission → on grant, `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` → POST `/api/push/subscribe` → toast `Уведомления включены`.
- On `Не сейчас` → set localStorage flag, dismiss for 7 days.
- Settings page (`/dashboard/settings`) gets a row "Уведомления" with on/off toggle for users to revisit the choice.

## G3 — Notifications for core events

Triggers fire `pg_net.http_post` to the Edge Function. Edge Function does the actual push.

| Trigger | DB event | Recipient |
|---|---|---|
| `notify_master_new_appointment` | INSERT on `appointments` where `master_id IS NOT NULL AND master_id != auth.uid()` (avoid notifying the creator) | the master assigned |
| `notify_owner_new_member` | INSERT on `tenant_members` where `role != 'owner'` | the tenant's owner(s) |
| `notify_inviter_invite_accepted` | UPDATE on `invitations` where `accepted_at` IS NOT NULL OLD WAS NULL | `created_by` |

Notification copy is built server-side in the Edge Function:
- Master appointment: `Новая запись · ${date.toLocaleDateString('ru')}, ${time}` body: `${client_name || 'Без имени'} · ${service_name || 'Услуга не указана'}`
- New member: `${user_email} принял приглашение в ${tenant_name}` body: `Роль: ${role}`
- Invite accepted: same as new member but framed for the inviter

Click handler in `sw.js` (already present) opens `https://babun.app/<deep-link>` — for appointments `/dashboard/appointments/${id}`, for members `/dashboard/settings/team`, for invites `/dashboard/settings/team`.

**Privacy guard:** never include client phone, comment, or financial data in the notification text. Names + service names only.

## G4 — Gestures (mostly wiring)

- **Wire `SwipeableRow` into `ClientsList` and `AppointmentList`.** Action buttons on swipe-left:
  - Client row: `Архивировать` (haptic `tap`) + `Удалить` (haptic `warning`).
  - Appointment row: `Завершить` (success) + `Отменить` (warning).
- **Pull-to-refresh** wrapper component `apps/web/src/components/ui/PullToRefresh.tsx` (~80 lines, raw touch events — no library). Used on `/dashboard/clients`, `/dashboard/appointments` lists. Pull threshold 60px → spinner appears → release triggers refetch → spinner exits via CSS transition.
- Haptic feedback already wired via `lib/haptics.ts` — just call `haptic("tap")` on swipe-action commit, `haptic("success")` on pull-to-refresh complete.

No new dependencies. ~150 lines of new code total.

## G5 — Install prompt (rewrite)

Replace `apps/web/src/components/pwa/InstallPrompt.tsx` with `InstallPromptModal.tsx`:

- Trigger: `sessionCount >= 2` AND `localStorage['babun-install-prompt-dismissed-at']` either unset or > 7 days old. Hidden if already in standalone mode (`window.matchMedia('(display-mode: standalone)').matches`).
- Two paths inside the modal based on platform detection (`lib/platform.ts`):
  - **Android with `beforeinstallprompt` captured**: single button `Установить` → `event.prompt()`. On accept, dismiss permanently.
  - **iOS Safari**: 3 numbered steps with inline SVG icons (no real screenshots — keeps bundle small):
    1. Тапни ⤴ внизу экрана
    2. Найди «На главный экран»
    3. Нажми «Добавить»
  - **Other**: generic "Открой Babun в Safari (iOS) или Chrome (Android), чтобы установить" message.

Decline path: dismiss button sets the 7-day flag.

## G6 — Back button handling

New util `apps/web/src/lib/history-stack.ts`:
- `pushModalEntry(id, onClose)` — calls `history.pushState({ babunModal: id }, '')`, registers `onClose` for the matching popstate.
- Single global `popstate` listener resolves the most-recent registered handler.
- Each opened sheet/modal calls `pushModalEntry` on open and `history.back()` on programmatic close (so the stack stays balanced).

Wire into `SheetShell` and `ConfirmDialog` so every existing modal participates. Hardware back / iOS swipe-from-edge → popstate → modal closes without page navigation.

Edge case: if a user explicitly hits browser-back through cleared history, normal navigation behavior applies. Don't trap navigation, just stack modal closes ahead of it.

## G7 — Smoke (7/7)

Local prod build first, then prod after G8.

1. **Subscribe push** — log in twice, see prompt, accept → granted permission → row in `push_subscriptions` with correct `keys.p256dh` length 87 chars. Manually invoke send_push via Edge Function dashboard with the user's UUID → notification appears on the device.
2. **Swipe gesture** — open `/dashboard/clients`, swipe-left on a row → `Архивировать` + `Удалить` reveal, tap `Архивировать` → row removes, haptic fires (Android) or no-op (iOS). No layout shift.
3. **Pull-to-refresh** — pull down on clients list at top → spinner appears → release → list refetches and re-renders without flash.
4. **Install prompt mobile** — fresh localStorage, log in 3 times, prompt appears on the 3rd. iOS UA shows iOS instructions; Android shows the install button.
5. **Decline → 7-day skip** — dismiss the prompt, log in again immediately → no prompt. Mock-set `babun-install-prompt-dismissed-at` to 8 days ago → prompt reappears.
6. **Back button closes modal** — open AppointmentSheet, hit hardware back → sheet closes, page stays on `/dashboard/appointments`. Hit back again → page navigates back normally.
7. **iOS Safari < 16.4 graceful** — set UA to `iOS 16.0`, log in twice → prompt shows fallback "Сначала установи приложение на главный экран" instead of broken subscribe button. No console errors.

## G8 — Bump v364-pwa-polish + push

- `BUILD_VERSION = "v364-pwa-polish"`
- `CACHE_VERSION = "babun-v364"`

## G9 — Production verify

Repeat smoke 1, 4, 6 against prod (these are the user-visible features). 2, 3, 5 are local-friendly. 7 needs a real iPhone with old Safari (skip on prod, document as covered in local).

## Acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| 1 | Push subscribe + receive works end-to-end on Android Chrome PWA | G7 step 1 |
| 2 | Swipe gestures + pull-to-refresh wired on clients/appointments | G7 steps 2, 3 |
| 3 | Install prompt with iOS-specific instructions | G7 step 4 |
| 4 | 7-day re-prompt cooldown after decline | G7 step 5 |
| 5 | Hardware back closes modals, not pages | G7 step 6 |
| 6 | iOS < 16.4 graceful degradation | G7 step 7 |
| 7 | RLS works — user can't read other users' subscriptions | extra DB check during smoke |

## Out of scope

- Native-only features (vibration patterns beyond simple, ARKit, etc.)
- Cross-device push token sync (each device has its own subscription)
- Notification preferences UI (per-event mute) — defer, single global on/off in v1
- Rich notifications (action buttons in the notification card) — Chrome supports, iOS doesn't, deferred
- Notification history page in-app — deferred

## Risks

- **iOS push complexity**: requires PWA-installed-then-subscribe sequence. The flow has 3 prompt dialogs back-to-back (install → permission → success). Mitigated by sequencing: subscribe prompt won't show until `display-mode: standalone`, which forces install first.
- **Edge Function cold starts**: first push after idle period adds ~1s. Acceptable for non-realtime notifications.
- **VAPID rotation**: if private key leaks, all subscriptions become invalid (need re-subscribe). Document in runbook; not solving in v1.
- **Pg trigger latency** during bulk inserts (CSV import → many appointment notifications): mitigate with a `WHERE` clause that skips notifications during CSV import (set `pg_temp.skip_notifications = true` in the import path, trigger checks).
- **`history.pushState` interference with Next router**: Next 16 uses History API for client navigation. Risk that our modal entries collide. Mitigate by namespacing state with `{ babunModal: id }` and only handling popstate for events that match this shape.

## Owner one-shots (~10 min)

1. Generate VAPID keys: `npx web-push generate-vapid-keys` → save output, set:
   - Vercel env `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (Production+Preview+Development)
   - Supabase Vault `VAPID_PRIVATE_KEY` (Project settings → Vault)
2. Set Supabase Vault `VAPID_SUBJECT` = `mailto:support@babun.app`
3. Deploy the Edge Function via Supabase CLI: `supabase functions deploy send_push --no-verify-jwt`
4. Verify Edge Function URL works: `curl -X POST <fn-url> -H 'Content-Type: application/json' -d '{"user_ids":[],"title":"test","body":"test"}'` → 200 with `{ sent: 0 }`.

I'll generate the keys and write the migration + Edge Function code; you do the env+vault paste and the function deploy.
