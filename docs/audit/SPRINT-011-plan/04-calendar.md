# Calendar Audit — 2026-04-20 prod

Scope: `/dashboard` live at https://babun2.vercel.app. iPhone 390 px PWA, Y&D brigade, Apr 20–26 (empty-today seed).

## Bugs

- **[HYDRATION] `src/components/layout/Header.tsx:61`** — `const todayNumber = new Date().getDate()` runs at top-level of a `"use client"` component render. SSR renders with the build-time clock; the client render 10–20 ms later hits the same path with the real clock. When the build is stale past midnight (very likely for Cyprus users — Vercel builds in UTC, PWA rehydrates at Europe/Nicosia +2/+3) the day number differs → React error #418 fires twice (once for the Today chip's text, once for its aria-label). **Fix:** move into `useState(() => null)` and set inside `useEffect` — common pattern for clock-dependent labels.
- **[HYDRATION secondary] `src/app/dashboard/page.tsx:132-137`** — `useState<ViewMode>` initializer reads `window.localStorage` and `window.innerWidth`. Next 16 static HTML ships `"week"` for every user; the client hydrates with `"day"` on phones (innerWidth < 1024) → WeekView vs. single DayColumn structural mismatch. Probably the second #418. **Fix:** always start `"week"` and switch in `useEffect`, or gate the whole dashboard behind `typeof window !== 'undefined'` with a tiny placeholder skeleton.
- **[HYDRATION potential] `src/components/layout/NowPill.tsx:33`** — `useState(() => new Date())` during render; fine alone, but paired with the now-line in `WeekView.tsx:52` (`getCurrentCyprusTime()`) means two independent `Date` reads during the same mount can drift the red marker position between SSR and CSR on slow paints.

## Readability on iPhone 390

- **7 day columns at ~50 px each.** `WeekView.tsx:73` uses `flex w-full` with `DayColumn`'s `flex-1 min-w-0` (`DayColumn.tsx:183`). On 390 − 48 (TimeColumn) = 342 / 7 = **49 px per day**. The Tailwind "ПАФОС ПН 20" stack wraps visibly. **Fix:** on `viewMode === "week"` on phones, drop the city line (`DayColumn.tsx:236-241`) to an *optional* bottom 2-px color strip — one colored line is enough to signal Пафос/Лимассол without burning a text row. Keep the full label only on `3days` and `day`.
- **Header height `h-[72px] lg:h-[82px]`** (`DayColumn.tsx:212`) holds three text rows. On phone week view trim to `h-[52px]` with two rows: compact day+date on line 1, city dot + short weekday on line 2. The 18 px black date at `DayColumn.tsx:256` is the anchor — keep it large; shrink the 7 px uppercase weekday to just a single-letter П/В/С.
- **Day view 82 px header eats 20 % of viewport** before the grid starts. Same file. In `day` mode route to a slim **40 px** header: one line `"ПАФОС · ПН 20 апреля"` with the city chip left-anchored; drop the gradient + glass overlay (those exist to disambiguate 7 stacked cells, which doesn't apply in day view). Suggest gating with `isDayMode ? "h-10" : "h-[72px]"`.
- **Action bar alone with «+ Расход»** (`page.tsx:840-862`). `TodayChip` returns `null` for the empty-today seed (`TodayChip.tsx:40`). Result: a single rose chip on an empty white strip — looks like a broken header. **Fix:** when `stats.count === 0` show a muted stub `«Сегодня пусто · 0 записей»` instead of vanishing; or collapse the whole strip to 0 px height with `hidden` when there's only Расход. Better: **move Расход into the ‘+’ speed-dial** in BottomTabBar (it already has «Новая запись»; add «Добавить расход» to the same popover). The top action bar disappears entirely.
- **Time column 48 px** — `TimeColumn.tsx:11` `w-12 lg:w-16`. Fine, but the `11px` font-medium gray-500 label disappears over the `bg-gray-200/50` out-of-hours overlay (`DayColumn.tsx:311-325`). **Fix:** lift the hour label `z-10` and give it `text-gray-700` so pre-9 AM / post-8 PM labels stay readable.
- **AppointmentBlock on 49 px** — `AppointmentBlock.tsx:154-183` renders 3 text lines at `8px / 10px / 8px`. Legible only with perfect eyes. In week view, collapse to **1 bold line (time-start only + first name)** — drop service row + time-end on narrow columns. Detect by adding a `dense` prop from `WeekView`. Current `max(calc(var(--hh)*N), 18px)` also causes 30 min blocks to overflow into the next slot without visual separator — add a subtle ring-1.

## Widget wiring gaps

- **NowPill** (`page.tsx:825-836`) — gated only by `viewMode !== "month"`. Good. But `findRelevantAppointment` (`NowPill.tsx:85`) **silently returns null** when `teamId === ""`, which happens briefly on first load (`page.tsx:116` starts empty before the `useEffect` picks the first tab). User sees pill flash-in. **Fix:** early-return when `teamId === ""` — no flash at all.
- **NowPill `onOpen` is a no-op** (`page.tsx:830-834`). Tapping does nothing. Either wire it to the scroll-to-appointment + open sheet flow, or remove cursor affordance (`active:opacity-80` on `NowPill.tsx:69`) so the button doesn't *look* tappable.
- **DaySummaryStrip** (`page.tsx:866-873`) — only renders in day view and hides on empty day (`DaySummaryStrip.tsx:44`). Correct behaviour, but *combined* with the also-hidden TodayChip, day view currently shows **zero** context chips for an empty-today — same broken-looking strip as week.
- **EndOfDayBanner** (`page.tsx:1165-1169`) — only appears after 18:00 local when `unpaidCount > 0`. On iPhone Safari after reload at 20:00 it appears correctly. Good. But it reads `new Date()` every render + `setInterval 60 s` — harmless, though potential micro-hydration issue if first paint happens at 17:59:59.
- **Build tag pill** (`page.tsx:926-931`) sits at `left-2 bottom-(safe+0.25rem)` — in iPhone this overlaps the BottomTabBar home-indicator area. On portrait 390 the tab bar is ~76 px; build pill is below it, often cut by safe-area. Probably fine but verify.

## AppointmentSheet quick-audit

- **`AppointmentSheet.tsx:91`** — file is 730+ lines. The header comment at line 74 already flags STORY-013 decomposition; this should move into SPRINT-011 scope.
- **Reset effect `AppointmentSheet.tsx:148-168`** re-fires on every `appointment` reference change. `bookingAppointment` in `page.tsx:532-541` is memoized (good) — but `inlineSheet.initial` (`page.tsx:352`) is a *new* Appointment object passed on every long-press duplicate. Edit-mode drafts can be wiped if the parent re-upserts. Risk-worthy.
- **Double-booking warn** (`AppointmentSheet.tsx:199-222`) reloads from `loadAppointments()` every render of the memo — `O(all_apts)` on every keystroke inside the sheet. For 903 clients × N appointments this will stutter. Should take `allAppointments` from context, not re-read localStorage.
- **Bottom sheet `items-center` + 92vh** (`AppointmentSheet.tsx:358-366`) follows `feedback_center_modals.md`. Good.
- **ESC listener** (`AppointmentSheet.tsx:132-144`) is fine, but there's no backdrop-click dirty-guard — wait, there is: line 361 `onClick={attemptClose}`. But `attemptClose` shows a confirm (`setCloseConfirm(true)`) — is that actually a center popup or bottom sheet? Check `closeConfirm` render path (not shown above).
- **Overlap warning banner** (`overlapWarning`, lines 199-222) — text-only, no tap-to-reveal-the-other. User sees "10:00–11:00 · Иванов" but can't jump to that conflicting record.
- **`loadChats()` in `page.tsx:514, 966`** runs inside render and a callback — cheap today, but once chats grow this needs a cached provider.
- **ClientActionMenu → Profile overlay** — good per rules. Verify it uses the same centred modal pattern and not route-push.
- **`handleCreate` date math `AppointmentSheet.tsx:297-303`** recomputes `time_end` by adding duration, but ignores `>24:00` wrap: `endH = Math.floor(endMin/60) % 24` silently wraps midnight-plus appointments into the early hours, breaking 23:30 bookings. Guard with a max-clamp instead of modulo.
- **`cancelFlag` toggle** (`AppointmentSheet.tsx:322-326`) always overwrites status — if user toggles "отменить" then untoggles, we don't restore the in-progress or completed value; we force `scheduled`. Either preserve `appointment.status` when unchecking, or disable the toggle for non-scheduled records.

## Touch/gesture conflicts

- **Swipe vs. vertical scroll.** `SwipeableCalendar.tsx:121-129` direction-locks at 8 px — too twitchy. Diagonal swipes on a long grid commit horizontal when user meant vertical. Raise `DIRECTION_LOCK_PX` to 12 and bias vertical (`Math.abs(dy) > Math.abs(dx) * 0.7`).
- **Long-press menu is undiscoverable.** No hint, no haptic preview, no "press and hold for options" label. First-time user will never find status-change. **Fix:** add a 1-time toast on first calendar visit: *«Задержите палец на записи — действия»*. Or add a tiny `⋯` icon in the top-right of each `AppointmentBlock` that opens the same menu on tap (iOS-native dual affordance).
