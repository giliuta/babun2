# SPRINT-CRM-QA-RECOVERY — handoff from E1 testing session

**Date:** 2026-05-16
**Branch:** master (pushed)
**Builds shipped:** v506 → v509

## Context

A previous E1 (Emergent) session ran a full E2E QA pass against
`https://babun.app` using `anubis0027.traf@gmail.com` / Malibu tenant
(empty: 0 brigades / 0 masters / 0 clients) and produced a handoff
prompt describing the v507 changes "already in the repo" plus a list
of P0/P1/P2 follow-ups.

Reality check on session start:

- The repo's `BUILD_VERSION` was `v505-tenant-state-backup`, not v507
- `git status` carried only `M CLAUDE.md` — none of the claimed file
  changes (instanceId in realtime sync, data-testids on
  LoginForm/Sidebar/Header, data-appointment-id on AppointmentBlock,
  closest() shortcut in DayColumn) were present on disk
- The handoff was authored in a separate sandbox; the diffs never
  flowed back to `giliuta/babun2`

So the handoff became the **work order** for this sprint, not a state
description. Everything below was implemented from scratch.

## What shipped

### v506 — bootstrap clobber + recurring crash + appointment test-handle
Commit `54172cd` · `fix(masters+realtime): bootstrap clobber + recurring crash`

**P0 — masters silently lost on F5 (root cause + fix).**

Trace through the original code:

1. `DashboardClientLayout.tsx` had two effects in this order:
   - L773 `useEffect(..., [masters, userEmail])` — v463 bootstrap that
     creates a default owner-master when `masters.length === 0`
   - L822 `useEffect(..., [])` — `setMastersState(loadMasters())`
     hydration from localStorage
2. React runs effects in declaration order. On mount with localStorage
   `babun-masters = [owner, Иван]`:
   - Effect 1 sees `masters = []` (initial useState value), enters the
     bootstrap branch, generates a brand-new owner with `crypto.randomUUID()`,
     and calls `saveMasters([defaultMaster])` — **clobbering the
     persisted list inside localStorage**
   - Effect 2 then reads the just-overwritten localStorage and sets
     state to `[newOwner]`
3. Result: every F5 destroyed the user's master, leaving only an
   ever-changing owner record. Exactly matches the testing agent's
   report (URL `master-mp5r8crg-24smz` → reload → "только владелец
   Anubis0027 Traf").

Fix (`L780-L794` new guard): peek at `loadMasters()` before deciding
to bootstrap. If persisted has data, return early and let the
hydration effect populate state on the next render.

**P0 — `/dashboard/recurring` crash on mount.**

`Sidebar.tsx:139` and `app/dashboard/recurring/page.tsx:57` both call
`useRealtimeTenantSync({ table: "recurring_reminders" })` with the
exact same channel name `tenant:<id>:recurring_reminders`. supabase-js
v2 throws on the second `.subscribe()` and the page falls into the
error boundary.

Fix: `useRealtimeTenantSync` now suffixes the channel name with a
per-hook-instance 6-char random id, so N consumers of the same
tenant+table get their own channels.

**P1 — explicit click handle on event tiles.** AppointmentBlock root
`<button>` exposes `data-appointment-id` + `data-testid` for
deterministic test selectors that survive button refactors.

### v507 — primary data-testid pass
Commit `41dfc49` · `chore(testids): primary data-testid pass`

Pure attribute additions, no behaviour changes. Covered the critical
auth + navigation + main sheets:

- **LoginForm:** `login-form / -email / -password / -submit / -error`
- **Sidebar:** `sidebar-nav-<route-slug>` (derived from href tail —
  calendar / clients / chats / finances / recurring / settings / teams /
  masters / sms-templates), `sidebar-logout`
- **Header:** `header-prev / -next / -today / -view-mode /
  -view-mode-option-<mode>`. **TeamTab** carries
  `header-team-tab-<teamId>` via the existing props
- **PersonalEventSheet:** `personal-event-sheet / -save / -delete / -close`
- **AppointmentSheet:** `appointment-sheet-save`

### v508 — extended data-testid pass
Commit `df0b4d9` · `chore(testids): extended data-testid pass`

- **ActionMenuModal:** root container, each option with
  `action-menu-option-<i>` + `data-action-label="<label>"` so tests
  can target by index or by visible text. Cancel button = `action-menu-cancel`
- **UndoToast:** root + `undo-toast-undo-button` (consumed by every
  long-press action — reschedule / delete / complete / etc)
- **CreateClientModal:** name input (`create-client-name`),
  phone input (`create-client-phone`), save, cancel. The internal
  `Field` helper now accepts an optional `testId` prop so future
  fields stay typed and forward correctly
- **DayColumn:** root and the droppable grid both carry
  `calendar-day-column-<dateKey>` and `calendar-day-grid-<dateKey>`.
  **Individual time slots aren't real DOM nodes** — handleColumnClick
  maps a Y offset to a time on the fly — so tests will click an empty
  slot at a computed Y rather than selecting a per-minute element.

### v509 — sync-error surface
Commit `9082f8f` · `feat(sync): surface tenant_state backup errors via OfflineIndicator`

This is the user-trust signal addressing the «не сохраняется»
paranoia. Before this patch the only un-queued sync path
(`tenant_state.prototype_state` blob in
`lib/sync/tenant-state-backup.ts`) silently `console.warn`'d failures
and lost the data — and that blob carries masters, teams, services,
sms-templates, expense-categories, equipment, cities, and location
labels. Now:

- `lib/sync/sync-error-bus.ts` — `useSyncExternalStore`-backed singleton
  (React 19-safe — no setState-in-effect lint hit). API:
  `reportSyncError(err)`, `clearSyncError()`, `useSyncError()`
- `tenant-state-backup.ts` — wired `reportSyncError` into both
  `saveTenantState` and `fetchTenantState`. Success path clears any
  prior error automatically, so the red pill disappears as soon as the
  next save lands
- `OfflineIndicator` — new red **«Ошибка синхронизации»** pill that
  wins over offline / pending pills. Tap to acknowledge.
  `data-testid="sync-status-error"` for QA selectors

`clientsCached` / `appointmentsCached` write failures are intentionally
left untouched here — they already absorb errors into the offline IDB
queue (visible as «Синхронизация: N») which is the correct UX. The
sync-error bus is the safety net for the one path that has no queue.

## What was on the handoff but NOT shipped (with reasons)

### Desktop long-press / right-click affordance (v510 in todos, skipped)
The handoff suggested adding an explicit 3-dots button on
AppointmentBlock when `(hover: hover)` media query matches, because
the testing agent reported right-click "didn't open action menu" on
desktop.

`AppointmentBlock.tsx:147` already wires `onContextMenu` correctly
(`e.preventDefault(); onLongPress?.(appointment);`). Without a
reproducible browser trace I can't tell whether dnd-kit's pointer
listeners actually intercept it; adding an alternate UI element
without confirming the underlying contextmenu doesn't work would be
shotgun debugging.

**Action:** keep as-is until the user can repro with browser devtools
open and we see what cancels the contextmenu event. If the issue is
real, the smallest fix is likely tweaking dnd-kit `activationConstraint`
rather than a new UI control.

### `@vercel/analytics` 404 in console (v511 in todos, no code change)
`app/layout.tsx:95` renders `<Analytics />` as part of STORY-061c,
which the user explicitly added for landing-page conversion + dashboard
performance baselines. The 404 on `/<id>/script.js` means the Vercel
**Web Analytics** toggle isn't enabled on the project itself, not that
the code is wrong.

**Action for the user:** Vercel dashboard → babun project → Analytics
tab → enable Web Analytics + Speed Insights. The injected scripts
will resolve once the project is enrolled. No code change needed.

### Seed test data via scripts/seed-test-tenant.mjs (handoff P1)
Would need `SUPABASE_SECRET_KEY` (service-role) which we don't have in
this session, and the QA agent isn't running here either. Once the
user is back at a terminal with credentials, the data they want is:

```
1 brigade  «Тест-Бригада-Альфа»  (cyan — already created)
2 masters  «Иван Тестовый» + «Пётр Демо»  (one attached to the brigade)
2 clients  «Тест Клиент 1»  +357 99 111 222  Пафос
           «Тест Клиент 2»  +357 99 333 444  Лимассол
```

With the v506 bootstrap fix in, masters created through `/dashboard/masters/new/info`
now survive F5, so seeding through the UI is reliable. The CLI script
is only needed if the user wants to seed multiple tenants in bulk.

### Sync-status indicator chip with sending/synchronised states (handoff P2)
The handoff described a chip with three states:
- 🟢 Synchronised
- 🟡 Sending
- 🔴 Error

The existing `OfflineIndicator` already covers:
- 🟡 «Синхронизация: N» when the IDB queue has pending writes
- gray «Без сети» offline
- and now 🔴 «Ошибка синхронизации» (v509)

The remaining 🟢 «Синхронизировано» state would need a brief
post-write success pulse — the cleanest implementation pairs with a
broader "last-saved-at" timestamp the user can glance at. Left for a
separate small story; the current pills handle every actionable state.

### `dashboard/page.tsx` refactor (1760 lines)
Out of scope — pure tech debt not blocking shipping. STORY-013 is the
sensible vehicle if/when the file becomes painful to evolve.

## Verification

- `npx tsc --noEmit` runs clean after every commit (zero errors)
- 4 commits pushed to `master` (v506 / v507 / v508 / v509) — Vercel
  will auto-deploy each
- localStorage namespace landmines documented in audit P1-3 (mix of
  `babun-*` and `babun2:*` keys for masters/teams/clients) NOT touched
  this sprint — that's a follow-up audit task

## Re-test checklist for the QA agent on `v509` deploy

1. `/dashboard/recurring` — page renders, no error boundary, no
   realtime exception in console
2. Create a personal event → tap it → edit form opens (not create)
3. Create a master via `/dashboard/masters/new/info` → F5 → master
   still in the list
4. Pull the network cable mid-tenant-state save → red «Ошибка
   синхронизации» pill appears → reconnect, trigger another save →
   pill clears automatically
5. Footer build-tag shows `v509-sync-error-surface`
6. Full brigade-calendar E2E still passes (no testid additions changed
   behaviour, but worth a once-over)

## What still blocks "ship to a non-AirFix tenant"

Above and beyond what shipped this sprint, the larger SaaS-readiness
gaps from `BABUN2_AUDIT_2026-05-07.md`:

1. **STORY-057** — migrate masters/teams to a real Supabase table.
   v509 + v506 make the localStorage path safe and visible, but
   multi-device sync of masters/teams still requires real DB tables.
   Estimate from STORY-057: 1 week.
2. **De-AirFix-ify defaults** — hardcoded admin emails in SQL
   migrations + privacy + SettingsDialog (audit P1-4)
3. **Industry templates** — HVAC / Cleaning / Beauty / Auto / Other
   sids for new-tenant onboarding (so new tenant doesn't see fgas
   certifications by default)
4. **Public landing + pricing + Stripe checkout** (STORY-045 + -052)
5. **CSV import** (STORY-046) — still a STUB; blocker for tenant
   migration from any existing system

Nothing in this sprint advances those — it's QA-bug-fix recovery
plus user-trust polish.
