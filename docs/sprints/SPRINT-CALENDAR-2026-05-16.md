# SPRINT-CALENDAR-2026-05-16 — "Команды и Календарь"

**Date:** 2026-05-16
**Branch:** feat/audit-fixes-2026-05
**Input:** 26-item P0/P1/P2 sprint plan from product (Календарь + Команды).
**Output of this session:** triage map + sprint doc. P0 #3 (v515) landed
in parallel from a separate session as commit `c998c81`; this doc is
the planning artifact, not the code change.

---

## TL;DR

The product plan references file paths and code patterns that don't exist
in this codebase (e.g. `app/dashboard/calendar/components/AppointmentForm.tsx`,
`handleAddressSave` + `mutate()`, `components/TimePicker.tsx`). The Babun
codebase has the calendar at `app/dashboard/page.tsx` (1784 lines), the
sheet at `components/appointment/AppointmentSheet.tsx` (1311 lines), and
uses localStorage + Supabase backup — not SWR/`mutate`. The work below
is grounded in the real files.

Four of the seven P0 items are already shipped (#3 live end-time recalc
landed as `c998c81` in parallel; #4 single-click create, #6 «Команды/
Мастера» rename, #7 footer leak from previous sprints). The remaining
three (#1, #2, #5) need further triage or design before code.

---

## P0 audit — prompt vs. reality

### P0 #1 — Address persists and shows
- **Prompt:** «`handleAddressSave` не зовёт `mutate()` после `supabase.update()`».
- **Reality:** there is no `handleAddressSave` function and no `mutate()`
  pattern. `AddressBlock` is read-only. The address rendered in the
  sheet comes from `selectedLocation?.address ?? appointment.address`
  (line 258 of `AppointmentSheet.tsx`); it's edited through the
  `LocationsBlock` → location editor flow, and persists through
  `onSave` → `upsertAppointment` (which already wires sync errors into
  the bus as of v513).
- **Action:** the described bug doesn't reproduce against the current
  code. Reopen with concrete repro steps (open which sheet, where do
  you type the address, what do you see after reopen) before patching.

### P0 #2 — Time picker honours team's step
- **Prompt:** «если у команды шаг 30 мин — picker показывает 09:00, 09:30, 10:00».
- **Reality:** `TimeBlock.tsx` is an iOS-style wheel picker with
  hardcoded `MIN_STEP = 5`. The team schema *does* carry
  `default_slot_minutes` (masters.ts:541) and `DayColumn` already uses
  it for empty-cell snap (line 256). The wheel does not.
- **Action — STORY-059 (next sprint):** thread `defaultSlotMinutes`
  from the active team into `TimeBlock`, rebuild the minutes column
  from it (`MINUTES = 0..60 step defaultSlotMinutes`), and add a
  one-line text-mode toggle for keyboard entry ("11:45"). The wheel
  is fine for thumbs on mobile; on desktop the keyboard fallback is
  the actual UX win. Est. ~3 hours, contained to `TimeBlock.tsx` and
  one new prop pipe through `AppointmentSheet` + `PersonalEventSheet`.

### P0 #3 — End-time = max(Σ services, slot)
- **Prompt:** «добавили услугу 90 мин в слот 11:00–11:30 → end автоматом 12:30, обновляется live».
- **Reality:** end-time only recalculated once, at save-time, inside
  `handleCreate` (lines 399–408). Adding/removing services in an open
  sheet did not reflect in the time chip. In *edit* mode, end-time
  was never grown at all.
- **Fix shipped as `c998c81` (v515 — landed in parallel):** new
  `useEffect` in `AppointmentSheet.tsx` recomputes
  `timeEnd ≥ timeStart + Σ duration` live whenever services or
  `timeStart` change. Grows only; never shrinks a manually-extended
  end. Off in view/done (readonly) and for personal events. Clamped at
  23:59 (no midnight wrap-around). `handleCreate` simplified to trust
  `timeEnd` directly.

### P0 #4 — Single-click on grid creates appointment
- **Reality:** already implemented at `DayColumn.tsx:238-265`
  (`handleColumnClick`). Snaps to `snapMinutes` (resolved per-team
  via `default_slot_minutes`), respects the windowed hour range,
  bails out on tap-through-button, calls `onEmptySlotClick(date, time)`
  which `dashboard/page.tsx` wires to opening the sheet with the
  active team's id pre-selected. **DONE.**

### P0 #5 — Desktop action buttons + hide mobile hints on ≥ md
- **Reality:** STORY-056 (desktop adaptation) is partially in flight.
  `useIsDesktop` exists; the floating sync pill and PWA prompts
  already gate on `!isDesktop`. The list-row action surface (★ / ✏ / 🗑
  on labels, services, masters, appointments) is not uniform yet — some
  screens use a kebab menu, some show actions on hover, some are
  swipe-only.
- **Action — STORY-060 (queue):** sweep `app/dashboard/{teams,masters,
  services,labels,recurring}` row renderers, ensure each gets a
  consistent desktop action group (visible buttons) with a mobile
  fallback (kebab → ActionMenuModal). Audit-level work, ~1 day.
  Out of scope this session.

### P0 #6 — «Команды» vs «Мастера» terminology + URL
- **Prompt:** sidebar = «Команды» + «Мастера»; team subroute
  `/teams/[id]/members`.
- **Reality:** v510 already swept «бригада → команда» across the UI
  (47 files). Sidebar has both `Команды` (line 283) and `Мастера`
  (line 290) entries with separate `tone` colours and the right routes.
  The team subroute is `/teams/[id]/masters`, not `/members`.
- **Action:** the rename to `members` is cosmetic. Worse — the
  `/teams/[id]/masters` route is parked per `memory/project_masters_subroute_parked.md`:
  it's a stub awaiting the `/dashboard/masters` redesign. Renaming
  parked code without rebuilding it would invalidate the deferred
  plan. **Defer until the masters redesign lands**, then choose
  `/teams/[id]/members` or `/teams/[id]/crew` at that point.

### P0 #7 — Strip `v513-appointment-sync-error` from footer
- **Reality:** already fixed in v514 (commit `96c4a73` "fix(version):
  split BUILD_VERSION (internal) vs DISPLAY_VERSION (UI)"). The sidebar
  footer renders `DISPLAY_VERSION` (`v1.5.13`); the slug only appears
  in a dev-only build-tag chip on the dashboard
  (`page.tsx:1478-1485`, `NODE_ENV !== "production"`). Plus the
  settings page footer ("Babun · v1.5.13"). **DONE.**

---

## P1 / P2 — triage notes (not implemented this session)

| # | Item | Lift | Blocker / note |
|---|---|---|---|
| 8 | Конструктор формы (split-view с превью) | L | New `/dashboard/settings/appointment-form` page. STORY-058 is in this area; coordinate. |
| 9 | «Метка → Зона» pill + map tooltip | M | `DayColumn` city pill already exists; add hover-map (Google Static) on desktop. |
| 10 | Цветовая легенда | S | Floating bottom-right widget in `dashboard/page.tsx`. |
| 11 | «Скопировать на остальные дни» в расписании | S | One button in `dashboard/teams/[id]/schedule/page.tsx`. |
| 12 | Шаблоны расписаний | M | New entity `schedule_templates`; settings page. |
| 13 | Two-column form ≥ 1024px | M | `AppointmentSheet` already responsive; needs grid split + sticky preview. |
| 14 | Источник заявки → radio | S | `SourceBlock` is a chip strip today; convert to radio group on desktop. |
| 15 | «Сплит» → «Раздельно» | XS | One Russian string in `PaymentBlock`. |
| 16 | Sticky CTA «Создать · €X» | S | Already exists in `AppointmentSheet` footer; just polish copy. |
| 17 | Drag-resize | L | S2. `react-dnd` or pointer events on AppointmentBlock bottom edge. |
| 18 | Drag-move between days | L | S2. Already half-wired (`useDroppable` per column); finish the drop handler. |
| 19 | Conflict detection on drag | M | S2. `overlapConflict` logic in `AppointmentSheet` is the donor; extract to a pure helper, reuse on drop. |
| 20 | Google Maps embed | M | S3. Static Maps URL + iframe; behind a `NEXT_PUBLIC_GOOGLE_MAPS_KEY`. |
| 21 | Auto-buffer (Distance Matrix) | L | S3. Server route — needs the same key. Cost concern. |
| 22 | История клиента в карточке | S | S3. Already fetchable via `loadAppointments().filter(client_id)`; just render. |
| 23 | Шаблоны записей | M | S4. New `appointment_templates`. |
| 24 | Mini-month picker | S | S4. `MiniCalendar` component already exists; wire into header. |
| 25 | Виды: День / Неделя / Месяц / Агенда | M | S4. `WeekView` + `MonthView` exist; add Day + Agenda. |
| 26 | Шорткаты T/N/←→/Esc | S | S4. Global `keydown` listener in `dashboard/page.tsx`. |

---

## Shipped in parallel during this session window

```
c998c81 feat(appointment): live end-time recalc on service-list change (v515)
244a1c5 fix(calendar): empty-state CTA copy matches the sheet it opens (v516, P0 #2.4)
f1b6f6e fix(onboarding): don't re-prompt calendar-mode after wizard (v515, P0 #2.3)
```

This sprint doc is the planning artifact — it maps the 26-item product
brief to the actual codebase and tags each item with the right STORY
or "deferred" reason.

## Next sprint (S1 continuation)

1. **STORY-059** — TimeBlock honours team step + keyboard input (P0 #2).
2. **STORY-060** — Desktop action-row audit (P0 #5).
3. **STORY-061** — P1 #14/#15/#16 polish batch (radio source, raздельно,
   sticky CTA copy). ~2 hours total.

P0 #1 (address persistence) and P0 #6 (members URL) stay open with
notes above. Ask the user for a specific repro on #1, and wait for
the masters redesign before touching #6.
