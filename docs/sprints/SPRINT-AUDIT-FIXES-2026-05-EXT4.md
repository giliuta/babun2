# SPRINT-AUDIT-FIXES-2026-05 — extension batch #4

Continuation of `SPRINT-AUDIT-FIXES-2026-05-EXT3.md`. User said
«доделывай» / «продолжай что осталось». Worked autonomously through
infrastructure + revenue-adjacent UX items.

---

## What shipped this batch

| Version | Commit | Title | Plan ref |
|---|---|---|---|
| v543 | `0f4a7b7` | feat(observability): Sentry-ready telemetry façade | §5.1 |
| v544 | `01a24ca` | feat(onboarding): «Что сделать дальше» checklist | §3.2 b |
| v545 | `341b7bc` | ci: GitHub Actions — tsc + vitest + build gates | §5.3 |
| v547 | `f5de156` | feat(sms): proper GSM-7/UCS-2 segment math + preset library | §3.10 (math + module) |
| v551 | `d453bcc` | feat(sms): render per-kind preset chips in editor | §3.10 (UI) |
| v556 | `26d1894` | feat(finance): inline-SVG daily sparkline component | §3.12 (first step) |

All pushed to `origin/feat/audit-fixes-2026-05`. tsc clean. Vitest
11 files, 74 tests passing (added 6 SMS-encoding cases).

---

## Highlights

### §5.1 Sentry telemetry façade (v543)

`lib/observability/telemetry.ts` — no-op-by-default façade with
`captureException` / `captureMessage` / `setUserContext` /
`setTelemetryTag`. Pre-wired to three call sites:

- `sync-error-bus.reportSyncError` — every Supabase write failure
  tagged `subsystem: "sync"`.
- `fetchWithRetry` exhausted retries (via existing
  `reportFinalFailure` flag).
- `global-error.tsx` (new) — Next App Router top-level React error
  boundary with «Что-то сломалось» recovery screen tagged
  `subsystem: "react"`.

Activation is a **one-file swap** documented in `docs/observability.md`:
install `@sentry/nextjs`, set `NEXT_PUBLIC_SENTRY_DSN`, paste the
adapter template, init in layout.tsx behind a dynamic import. Zero
bundle impact until activated.

### §3.2 b Onboarding checklist (v544)

Wizard StepDone grows a 4-item «Что сделать дальше» list below the
SummaryRows. Two variants based on personal vs team calendar choice
so a solo owner doesn't see «Соберите команду» first.

### §5.3 GitHub Actions CI (v545)

4-job workflow on every PR + push to master/feat/fix:
typecheck (hard), test (hard), build (hard), lint (soft until React-
Compiler hygiene sprint clears 149 pre-existing problems). Node 22,
npm + .next caching, concurrency-cancel.

### §3.10 SMS overhaul (v547 + v551)

`packages/shared/src/local/sms-encoding.ts` — `analyzeSmsEncoding(body)`
returns `{ length, weight, encoding, segments, singleLimit,
multipartLimit, remaining }`. Detects GSM-7 vs UCS-2, accounts for
extended-GSM weight (`€ { } [ ] ~ | \\ ^` count as 2 each), splits
multipart at the right boundary (153 for GSM-7, 67 for UCS-2). 6
vitest cases.

`packages/shared/src/local/sms-presets.ts` — 2-3 starter presets per
TemplateKind. Editor renders them as «Применить» chips between the
textarea and the token palette. Only shown when body is empty
(doesn't clobber drafts). Auto-fills `name` only if user hasn't
typed it.

Editor counter now shows «{N} знаков · {M} SMS · UCS-2» (UCS-2 tag
only when relevant) and turns orange + adds a helper line when
segments > 1 so the dispatcher knows trimming ~10 chars halves
their per-send bill.

### §3.12 Finance sparkline (v556, first step)

`components/finance/FinanceSparkline.tsx` — standalone inline-SVG
chart. Daily income (green bar) + expense (red overlay) for any
number of days. Header shows running totals (+income, −expense,
profit). Empty array renders the «Нет данных за выбранный период»
placeholder.

Zero new dependencies — recharts/visx would have added ~120 kB to
the bundle for one chart on one page. The component is intentionally
minimal: one job done well. Plugging it into `/dashboard/finances`
(582-line page with multiple modes) is a separate focused commit.
Export to Excel / PDF + manual-operation entry from the same §3.12
spec are also deferred.

---

## Coverage map — running total since the audit-fixes branch started

**Closed (23 items):**

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
| §3.10 | SMS overhaul (counter + presets) | v547 + v551 |
| §3.11 | Integrations stub | v528 |
| §3.12 | Finance sparkline component | v556 (1st step) |
| §3.13 | Settings 2-col | v529 |
| §4.1 | Services empty-state | v539 |
| §5.1 | Telemetry façade + docs | v543 |
| §5.2 | Playwright scaffolds | v534 |
| §5.3 | GitHub Actions CI | v545 |
| §5.5 | /docs/glossary.md | (mid-batch) |

**Still open (real deferrals, not «easy to ship»):**

| Ref | Why deferred |
|---|---|
| §1.5 | Design-system primitives extraction — multi-week, touches many call sites |
| §2.6 | base64 in RSC payload — 0 source matches, runtime profiling once Sentry is live |
| §3.4 | «Без города» strip — needs browser repro for the visible-text instance |
| §3.12 wire-in | Plug sparkline into /dashboard/finances/page.tsx (582 LOC). Excel / PDF export. Manual operation form. Each is a focused commit. |
| §4.2–§4.10 | All P2 feature backlog (dashboard widgets, reports, online booking, real WhatsApp / Telegram, i18n, multi-currency, dark theme, audit log, mobile PWA) — multi-day each |
| §5.4 | Lighthouse audit + perf budget |
| §5.6 | Sentry source maps + release tags (depends on actual Sentry install) |
| top-level service drag-reorder | Cross-category DnD, larger refactor |
| Playwright skipped tests (4) | Test-only tenant factory required |

---

## Recommended next moves

1. **Actually install Sentry.** Run `npm i @sentry/nextjs` + paste the
   adapter from `docs/observability.md`. Closes §5.1 / §5.6 +
   unblocks §2.5 (retry alerts) + §2.6 (base64 RSC profiling).
2. **Plug FinanceSparkline into /dashboard/finances/page.tsx** with
   the existing daily-breakdown source. One focused commit.
3. **React-Compiler hygiene sprint** to flip CI lint to a hard gate
   (149 → 0 problems).
4. **Test-only tenant factory** to un-skip 4 Playwright tests.
5. **§4.2 Dashboard widgets** — biggest remaining UX win
   (today/week/month numbers + top-3 masters + недозвоны list).
6. **§4.6 i18n** — RU/EN/GR with `next-intl`. Unlocks Greek-speaking
   customer market.

---

## Branch metadata

- Branch: `feat/audit-fixes-2026-05`
- Last commit: `26d1894` (v556)
- TSC: clean (Playwright e2e specs excluded from app build)
- Vitest: 11 files, 74 tests passing
- ESLint: 149 pre-existing problems unchanged (lint not gated)
- PR-ready: https://github.com/giliuta/babun2/pull/new/feat/audit-fixes-2026-05
