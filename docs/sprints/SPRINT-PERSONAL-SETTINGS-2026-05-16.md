# SPRINT-PERSONAL-SETTINGS-2026-05-16 — «Мой календарь + Настройки»

**Date:** 2026-05-16
**Branch:** feat/audit-fixes-2026-05
**Input:** 30-item brief covering personal-calendar + settings cleanup.

A parallel agent has been shipping commits in this same hour:
v515 → v518 (live end-time recalc, empty-state CTA, close-confirm UX,
terminology pass), with v519 in progress (desktop `GestureHint` on
teams/masters lists — uncommitted at the time of writing).

This doc maps the brief to the real codebase and flags items that
*conflict* with what just shipped, so the next agent run doesn't undo
finished work.

---

## Terminology conflict with v510 + v518

The brief proposes:
- Sidebar `/teams` → «Бригады»
- Settings `/settings/team` → «Сотрудники аккаунта»
- Glossary: «Бригада» (sidebar), «Сотрудник» (settings), «Заявка»,
  «Событие»

This contradicts v510 («бригада → команда» rename across 47 files) and
v518 («Мастера → Сотрудники»). The current canonical labels are:

| Surface | v518 (current) | Brief asks |
|---|---|---|
| Sidebar entry | **«Команды»** | «Бригады» |
| Sidebar entry | **«Сотрудники»** (was «Мастера») | (unchanged) |
| Team subroute heading | **«Состав»** | (n/a) |
| Settings page | `/settings/team` heading not yet «Сотрудники аккаунта» | «Сотрудники аккаунта» |

Reverting «Команды» → «Бригады» now would be the third rename of the
same string in two months. Recommendation: keep «Команды» (v510/v518
direction wins) and only rename `/settings/team` → «Сотрудники
аккаунта» if there's a real reason to disambiguate from sidebar
«Команды». If the brief author truly wants «Бригады» back, raise it
with the user before another sweep.

---

## P0 audit — brief vs. reality

### Calendar

| # | Brief | Reality | Action |
|---|---|---|---|
| 1 | `app/dashboard/components/MonthView.tsx` renders empty until scroll | Real file: `src/components/calendar/MonthView.tsx` (131 lines). Needs a live repro — «пустой до скролла» could be SSR-hydration race or a `useEffect`-driven mount. Worth a fresh look. | **STORY-062.** Verify with chrome-devtools MCP, fix if confirmed. |
| 2 | Click day in Месяц → opens that day in День view | `MonthView` likely already has `onDayClick`. URL convention `/dashboard?view=day&date=…` doesn't exist yet (single-page dashboard). | **STORY-063.** Decide on URL scheme first (query param vs. hash vs. state-only); thread the click handler. |
| 3 | View switch preserves day/week | Same as #2 — needs the URL scheme decision. | Bundled with STORY-063. |
| 4 | Иконка «Сегодня» + tooltip | `CalendarHeader.tsx` is a *fictional* path. The real header lives inside `app/dashboard/page.tsx`. `TodayChip` exists at `components/calendar/TodayChip.tsx`. | Confirm which surface — is the icon already shipped on `TodayChip`? Quick visual check. |
| 5 | Multi-select календарей (chips) | Today: single active team chip + Personal pinned at index 0 (v511). Multi-select would require: drop `activeTeam`-as-state, manage `activeTeamIds: string[]`; merge appointment sources; pick a colour per team for AppointmentBlock; conflict-detection unchanged (per-team). | **L size.** S2 candidate. Big architectural change to the dashboard. |
| 6 | Mini-month picker (year selector, «Сегодня», dots) | `MiniCalendar.tsx` exists. Dots already render. Year selector + Today button are small additions. | **STORY-064.** ~2 hours. |
| 7 | Push notification default ON (15 min) | Fictional path `lib/event-defaults.ts`. Closest: `event-presets.ts`. Default lives on the personal-event creation flow in `PersonalEventSheet`. | Trivial once located. |

### Settings

| # | Brief | Reality | Action |
|---|---|---|---|
| 8 | Sidebar `/teams` → «Бригады», settings → «Сотрудники аккаунта» | **Conflicts with v510 + v518.** See terminology section above. | Defer; needs user decision. |
| 9 | Merge Счёт + Реквизиты → `/settings/company`; drop `billing-info` | Real: `/settings/company/page.tsx` (171 lines) + `/settings/account/billing-info/` exist as separate routes. The audit doc lists `billing-info` as «Placeholder» (P2-1). | **STORY-065.** Merge then delete `billing-info`. Real win. |
| 10 | Remove «Локальные записи календаря» — everything straight to Supabase | This is **the** big architectural shift: STORY-042 (appointments→Supabase), STORY-044 (schedule→Supabase), STORY-057 (masters/teams→Supabase), STORY-054 (offline-first). All specced, none fully shipped. Removing localStorage today would break offline mode. | **Out of scope this sprint.** Wait for STORY-042/044/057 to land. Brief item is too aspirational. |
| 11 | `app/dashboard/settings/layout.tsx` scroll fix | **No such file** — settings inherits the dashboard layout. Scroll issue probably lives in the dashboard's main `<main>` or in `settings/page.tsx`. | Needs repro to locate. |
| 12 | Personal-calendar toggle = confirm dialog | `ConfirmProvider` exists (used elsewhere). Wrap the toggle. | **STORY-066.** ~30 min. |
| 13 | Strip `v513-appointment-sync-error` from footer | **DONE.** v514 split BUILD_VERSION/DISPLAY_VERSION. Slug is now `v518-terminology-pass`; UI renders `v1.5.18`. The two `v513` hits remaining are EN comments in `DashboardClientLayout.tsx`, never user-visible. | No action. |
| 14 | Hide «Тактильная отдача» toggle on ≥ md | Real toggle exists in settings/personal? Need to locate. Wrap section in `!isDesktop`. | Small. |
| 15 | Tariff grid (3 plans, Stripe Checkout) | STORY-052 — Stripe billing. `/settings/billing/page.tsx` exists (222 lines). PricingTable.tsx doesn't. | **L size.** Whole-story scope. |
| 16 | Finish online-booking | `/settings/online-booking/page.tsx` exists. Brief lists 5 features still missing (working hours override, service list, prepay, confirm copy, anti-spam). | **L size.** Whole-story scope. |

### P1 / P2

| # | Item | Note |
|---|---|---|
| 17 | SVG timeline — visible/working/booking hours | New component. S/M lift. |
| 18 | Custom event recurrence (Mon+Wed+Fri, until, N times) | Touches `recurring-reminders` model + creation UI. |
| 19 | Auto-detect video conf URL | Regex pass on the link field — small. |
| 20 | Sign-in log («СКОРО» → real) | Needs Supabase `auth.audit_log_entries` exposure or a custom table. |
| 21 | 2FA via email code | Supabase auth supports MFA factors; UI work + email template. M lift. |
| 22 | Delete-account confirm dialog with email re-type | Already has `data-export-action.ts` siblings — pattern exists. S lift. |
| 23 | Drop `AIRFIX` preset from SMS sender name | One-line edit. |
| 24 | «Покинуть» → «Передать владение» for owner | UI string + ownership-transfer flow. M lift (server side too). |
| 25-30 | Google Calendar sync, webcal, CSV import, dark mode, i18n, webhooks | Each is its own multi-week story (Stories 046, 047 etc reference some). |

---

## Recommendation

The brief is again a roadmap, not a sprint. Realistic next batch (1–2 days):

1. **STORY-062** — verify + fix MonthView empty-state (P0 #1) if real.
2. **STORY-063** — URL scheme for view/date + persist on view switch (#2 + #3).
3. **STORY-064** — Mini-month picker upgrades (#6).
4. **STORY-065** — Merge billing-info into company page (#9).
5. **STORY-066** — Personal-calendar toggle confirm dialog (#12).

Items deferred with strong reasons: #5 (architecture), #8 (conflicts
with v518), #10 (waits for STORY-042/044/057), #15/#16 (full-story
scope each). P0 #13 is already done — don't re-ship.

No code change in this commit — the parallel agent has unstaged edits
in `teams/page.tsx` and `masters/page.tsx` (v519 GestureHint) and I
won't risk a merge collision.
