# SPRINT-AUDIT-FIXES-2026-05 — extension batch #5

Continuation of `SPRINT-AUDIT-FIXES-2026-05-EXT4.md`. User said
«продолжай доделывай все» again. Focused on closing the finance
chart deliverables from §3.12 + fixing the CI pipeline along the
way.

---

## What shipped this batch

| Version | Commit | Title |
|---|---|---|
| (lockfile fix) | external | `ci(deps): commit babun-crm/package-lock.json so npm ci can run` — CI was failing in 8s because the lockfile wasn't checked in. After commit: 4 jobs green in 1m7s. |
| v558 | `5d3cc14` | feat(finance): wire FinanceSparkline into Summary tab |
| v559 | `3be3c5d` | feat(finance): CSV export utility for §3.12 |

Plus earlier in the sprint:

| Version | Commit | Plan ref |
|---|---|---|
| v543 | `0f4a7b7` | §5.1 Telemetry façade + global-error boundary + docs/observability.md |
| v544 | `01a24ca` | §3.2 (b) Onboarding StepDone checklist |
| v545 | `341b7bc` | §5.3 GitHub Actions CI |
| v547 | `f5de156` | §3.10 SMS encoding analyzer + preset library module |
| v551 | `d453bcc` | §3.10 SMS preset chips rendered in editor |
| v556 | `26d1894` | §3.12 FinanceSparkline standalone component |

Total mine in EXT5 wave: 6 commits + 1 external CI fix that
unblocked the pipeline.

---

## §3.12 finance — three steps shipped, two open

1. **FinanceSparkline component** (v556) — standalone inline-SVG.
2. **Wired into Summary tab** (v558) — `SummarySparkline` adapter
   folds the already-filtered useFinanceData income + expense lines
   into a sorted FinanceDailyPoint[]. Chart respects active period
   + active team because filters live upstream.
3. **CSV export utility** (v559) — `buildCsv` / `downloadCsv` +
   `FINANCE_CSV_COLUMNS` preset. UTF-8 BOM + `;` separator + CRLF =
   opens cleanly in Russian-locale Excel without a prompt.

**Open:**
- Wire the «Экспорт» button on /dashboard/finances that calls
  `downloadCsv(buildCsv(FINANCE_CSV_COLUMNS, rows), filename)`.
  Pure UI add, ~15 LOC. Concurrent external commit at v558 added a
  CSV-export banner copy — they're working the same area.
- PDF export — needs `jspdf + jspdf-autotable` (~300 kB). Deferred.
- Manual transaction entry sheet — external commit v557 area
  already plumbed `showManualSheet` state on the page; the
  actual sheet component is next.
- Close-day button + day-cash reconciliation — separate item.

---

## Other open items, in priority order

| Ref | What | Why deferred |
|---|---|---|
| **§5.1 actual install** | `npm i @sentry/nextjs` + DSN + paste adapter from `docs/observability.md` | Needs user DSN; without it the install adds bundle weight for no benefit. The façade is ready. |
| Service drag-reorder top-level | Cross-category DnD-kit refactor on `/dashboard/services` | Larger; brigade-scoped reorder already works |
| §4.2 Dashboard widgets | Today / week / month stats + top-3 masters + недозвоны | New page or new tab on /dashboard; multi-day, needs design |
| §4.3–§4.10 | Online booking, integrations, i18n, multi-currency, dark theme, audit log, mobile PWA | Each multi-day |
| §3.4 «Без города» strip | Visible-text instance | Needs browser repro |
| React-Compiler hygiene | Clean 149 lint problems → flip CI gate | Focused sprint |
| Test-only tenant factory | Un-skip 4 Playwright tests | Test infra |
| §1.5 design-system | Button/Input/Modal/Switch/ColorPicker extraction | Multi-week |
| §5.4 Lighthouse | Perf budget | After Sentry |

---

## Coverage map — running total since v513

**Closed (25 items):**

| Plan ref | Title | Version |
|---|---|---|
| §1.1 | Терминология | v518 |
| §1.3 | «Дальше»→«Далее» | v518 |
| §2.1 | DISPLAY_VERSION split | v513 |
| §2.2 | Inline-create persists | v514 |
| §2.3 | Onboarding doesn't re-prompt | v515 |
| §2.4 | Empty-state CTA copy | v516 |
| §2.5 | retry-fetcher | v531 |
| §2.7 | Close-confirm primary swap | v517 |
| §3.1 | Register: name + terms | v520 |
| §3.2 (a) | Onboarding default → personal | v526 |
| §3.2 (b) | Onboarding checklist | v544 |
| §3.5/3.6 | Desktop-aware hints | v519 |
| §3.7 | Permission presets | v538 |
| §3.8 | Clients copy → Заметки | v522 |
| §3.9 | Source mandatory | v524 |
| §3.10 | SMS overhaul (counter + presets + UI) | v547 + v551 |
| §3.11 | Integrations stub | v528 |
| §3.12 | Finance sparkline + wired + CSV util | v556 + v558 + v559 |
| §3.13 | Settings 2-col | v529 |
| §4.1 | Services empty-state | v539 |
| §5.1 | Telemetry façade + docs | v543 |
| §5.2 | Playwright scaffolds | v534 |
| §5.3 | GitHub Actions CI | v545 (lockfile fix landed after) |
| §5.5 | /docs/glossary.md | (mid-batch) |
| (CI infra) | package-lock.json committed | external |

---

## Branch metadata

- Branch: `feat/audit-fixes-2026-05`
- Last commit: `3be3c5d` (v559)
- TSC: clean
- Vitest: 12 files, 78 tests (added 4 csv-export cases + 6 sms-encoding earlier)
- CI: 4/4 jobs green on last run (1m7s)
- PR-ready: https://github.com/giliuta/babun2/pull/new/feat/audit-fixes-2026-05

---

## Recommended next session focus

1. **Install Sentry** — gives §2.5 telemetry teeth + closes §5.1/§5.6.
2. **Wire CSV export button** — single 15-LOC commit pluggin
   `FINANCE_CSV_COLUMNS` into a toolbar button on /dashboard/finances.
3. **React-Compiler hygiene** — 149 → 0 problems, flip CI gate.
4. **§4.2 Dashboard widgets** — new visible feature.
5. **Test-only tenant factory** → 4 Playwright tests un-skipped.
6. Long term: §4.6 i18n, §4.5 real integrations, §1.5 design-system.
