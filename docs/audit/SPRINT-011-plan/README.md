# Chief of Staff — Sprint 011+ consolidated plan

**Date:** 2026-04-20
**Method:** 5 parallel audit agents (mobile UX, design system, finance, calendar, perf/a11y) on real prod https://babun2.vercel.app with 13 device screenshots @ iPhone 390×844 + Lighthouse mobile report.

Raw reports:
- [01-mobile-ux.md](01-mobile-ux.md) — 27 UX findings (7 critical)
- [02-design-system.md](02-design-system.md) — inconsistency sweep, primitive adoption gaps
- [03-finance.md](03-finance.md) — Sprint 007 verified + cents bug + VAT surface missing
- [04-calendar.md](04-calendar.md) — hydration #418 suspects, readability, widget wiring
- [05-perf-a11y.md](05-perf-a11y.md) — Lighthouse 87/96/100, 1-line fixes

---

## 🚨 Ship-blockers (fix before any new feature)

| # | What | Root cause | Where |
|---|---|---|---|
| B1 | **React #418 hydration mismatch** — fires twice on every /dashboard load | `useState(() => getMonday(new Date()))` + `useState` reading `window.innerWidth` + `localStorage` in initializer | [dashboard/page.tsx:115,133-136](babun-crm/apps/web/src/app/dashboard/page.tsx) |
| B2 | **Cents-as-euros 100× display bug** — every future €-value on /expenses, /payroll, /brigades renders 100× too big once real data arrives | `formatEUR` treats input as euros, pages feed it `amountCents` | `/expenses:343,407,456,474`, `/payroll:104-227,392`, `/brigades:402,442` |
| B3 | **Midnight-wrap bug** — booking crossing 00:00 silently corrupts | `handleCreate` uses `% 24` on hour maths | [AppointmentSheet.tsx handleCreate](babun-crm/apps/web/src/components/appointment/AppointmentSheet.tsx) |
| B4 | **Demo-data seed CTA shipping in prod** | no env guard | flagged by UX agent |
| B5 | **PWA install banner covers BottomTabBar** on Clients / Finances | InstallPrompt fixed-bottom without tab-bar offset | `components/pwa/InstallPrompt.tsx` |

All 5 land in **Sprint 011 — «Hydration + data truth»** (est. 1 day).

---

## Proposed sprint queue (order of diminishing criticality)

### Sprint 011 — Hydration + data truth (M, 1 day)
**Goal:** zero-regression correctness pass before we keep layering features.
- Fix B1 hydration (init to SSR-stable value, populate in `useEffect`)
- Add `formatEURFromCents(cents)` helper + mechanical migration for B2
- Fix B3 midnight wrap (clamp + clamp-to-24:00 not wrap)
- Env-guard demo data (B4)
- Lift InstallPrompt above tab bar (B5)
- Fix the 5 Lighthouse a11y failures (landmark-one-main, contrast 1-liners, label-content-name-mismatch — all 1-line edits per the perf report)

After this sprint: Lighthouse a11y 87→95, zero console errors, math that won't lie on real data.

### Sprint 012 — Design unification pass (M, 1.5 days)
Everything the Sprint 005 primitives promised but wasn't adopted.
- indigo-* → violet-* codemod (20 files)
- text-gray-* / border-gray-* → text-slate-* / border-slate-* (40+ files)
- Adopt `<Money>` in all four finance pages (replaces inline `€${n}` / raw `formatEUR(spans)`)
- Adopt `<EmptyState>` in Waitlist, Reports, Expenses, Payroll, Teams, SMS-templates, Clients
- Replace `window.confirm` calls (10 files) with `ConfirmDialog` (keeper rule)
- Unify card recipe (`ring-1 ring-slate-200 shadow-xs` over `border border-gray-200 shadow-sm`)
- Finish lucide migration for 2 pages still using inline SVGs (Clients 11 icons, Settings emoji icons)
- Rebrand InstallPrompt to violet

### Sprint 013 — Calendar readability on iPhone 390 (M, 1 day)
- Week view DayColumn: collapse "ПАФОС / ПН / 20" stack to a 2-px color strip + "ПН 20", drop h-72 → h-52
- Day view: h-82 header → h-10 single line «ПАФОС · ПН 20 апреля»
- AppointmentBlock: 1-line dense mode when column < 80 px
- SwipeableCalendar DIRECTION_LOCK_PX 8 → 12 (twitchy)
- First-visit hint for long-press menu (undiscoverable today)
- Day-view empty-state when no visits (replaces awkward "+ Расход" alone)

### Sprint 014 — Thumb-zone create flow (S+M, 1 day)
- Wire FAB "+" in BottomTabBar center (per original idea #3, UX agent's C1/C2)
- Centred popup with 4 entries (Запись / Расход / Событие / Лид) — NOT bottom sheet
- Remove standalone "+ Расход" chip from action bar
- All header buttons 44×44 min

### Sprint 015 — Finance surfaces v1 (M, 1.5 days)
Unlocked by Sprint 011 B2 cents-fix.
- VAT surfaced: 4th card on /reports "VAT собрано €X (19%)"
- «Факт в кассе» centered modal (infra already in `lib/reconciliations.ts`)
- Today-glance widget on dashboard header area: «Сегодня +€340»
- Honest delta: prev=0 renders "нов." / "—" instead of "+100%"
- Salary drift fix: extract flat-vs-per-member payroll to one function
- 3 money-bundle items from IDEAS_REVIEW: round-up chip, split presets, brigade salary preview in AppointmentSheet

### Sprint 016 — Debts end-to-end (M, 1 day)
- `ClientDebt` first-class record (create / partial-repay / write-off)
- Red pill on client card «Должен €20»
- Finances KPI: total receivables (currently €0 placeholder)
- Payment step auto-creates debt when paid < total

### Sprint 017 — AppointmentSheet decomposition (L, 2 days)
- Current file 730+ lines, golden rule says 400
- Extract: event-mode branch, SMS toggle, handleCreate builder, id↔AppointmentService helpers, overlap detection
- Fix overlapWarning re-reading localStorage on every keystroke → useMemo cache
- Fix cancelFlag not restoring prior status
- Add tap-to-view-conflict on double-booking banner

### Sprint 018 — Perf / install polish (S, 0.5 day)
- Lazy-load jspdf (-350 KB initial)
- Pin Inter font weights (-240 KB)
- `next/dynamic` the heavy modals
- Preconnect Google Fonts
- SW precache narrowing

---

## Anti-ideas (explicit NO right now)

- **Dark mode** — still irrelevant for scooter + sun; defer until SaaS
- **Supabase migration** — stay on localStorage until the cents + hydration bugs are fully closed; Supabase amplifies silent-drift risk 10×
- **Tests for compute** — Vitest deps aren't even installed; fix `npm test` first in Sprint 011 as part of the data-truth pass, don't expand to every module yet
- **Brigade GPS rail** — blocked by fleet-tracking infra we don't have

---

## CEO decision

**Recommended path:** run sprints 011 → 015 in order (6.5 days of work). 011 must be first — everything downstream multiplies today's bugs.

**Alternatives:**
- **A — strict order** above (011, 012, 013, 014, 015, 016, 017, 018)
- **B — parallel streams** (011 solo, then 012 + 013 parallel by agent, then 014 + 015 parallel)
- **C — cherry-pick** — ship 011 + 012 + 015 only, defer the rest
- **D — different priority** — say what

Skip to source reports for details.
