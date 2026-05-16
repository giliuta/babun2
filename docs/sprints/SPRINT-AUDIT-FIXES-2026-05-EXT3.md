# SPRINT-AUDIT-FIXES-2026-05 — extension batch #3

Continuation of `SPRINT-AUDIT-FIXES-2026-05-EXT2.md`. After the user
said «продолжай что осталось», I worked autonomously on the
infrastructure tier (§5) plus one P1 onboarding follow-up. Three
focused commits, all on `feat/audit-fixes-2026-05`.

---

## What shipped this batch

| Version | Commit | Title |
|---|---|---|
| v543 | `0f4a7b7` | feat(observability): Sentry-ready telemetry façade (§5.1) |
| v544 | `01a24ca` | feat(onboarding): «Что сделать дальше» checklist on StepDone (§3.2 b) |
| v545 | `341b7bc` | ci: GitHub Actions — tsc + vitest + build gates (§5.3) |

All pushed to `origin/feat/audit-fixes-2026-05`.

---

## §5.1 — Telemetry façade (v543)

Goal: callers can ship `captureException` / `captureMessage` /
`setUserContext` / `setTelemetryTag` today without forcing the
`@sentry/nextjs` dependency. The default adapter is a no-op so the
app builds and runs without Sentry. Wiring Sentry later is a one-file
swap.

**New files:**

- `apps/web/src/lib/observability/telemetry.ts` — façade + types +
  `installTelemetry(adapter)` hook point.
- `apps/web/src/app/global-error.tsx` — Next App Router's top-level
  React error boundary. Renders a recoverable «Что-то сломалось»
  screen and captures the error with `subsystem: "react"` + Next's
  digest.
- `docs/observability.md` — full hookup guide: install command, env
  vars, adapter module template, layout init pattern, source-map
  upload, privacy notes.

**Wired call sites:**

- `lib/sync/sync-error-bus.reportSyncError` → forwards to
  `captureException` with `subsystem: "sync"`. Same failures that
  show the red «Ошибка синхронизации» pill now land in telemetry
  with the right tag.
- `lib/http/fetchWithRetry` (via existing `reportFinalFailure: true`
  option → bus → telemetry) — exhausted retries.
- `app/global-error.tsx` — React boundary.

**Bundle impact:** zero. No new dependency. The Sentry-init pattern
documented in `docs/observability.md` uses a dynamic import so the
main chunk stays lean even after the dep is added.

---

## §3.2 (b) — Onboarding checklist (v544)

Adds a passive 4-item «Что сделать дальше» checklist below the
SummaryRows on StepDone. Two variants based on the personal vs team
calendar choice the user just made:

**Team flow:**
1. 👥 Соберите команду
2. 🧰 Заведите услуги
3. 📞 Создайте первую запись клиента
4. 📲 Подключите SMS-уведомления

**Personal flow:**
1. 🗓️ Добавьте первое событие
2. 🎨 Настройте цвет и часы
3. 🔔 Включите push
4. 👥 Пригласите команду позже

Passive — no checkboxes, no completion tracking. Users discover each
section by visiting it; «Открыть календарь» from StepDone still drops
them on `/dashboard` where the existing empty-state CTA + sidebar
carry them through. Future work could light up checkmarks tied to
first-action milestones (first appointment created, first service
added, etc) but that's a separate sprint.

`data-testid="onboarding-checklist-item-{0..3}"` for QA.

---

## §5.3 — GitHub Actions CI (v545)

New `.github/workflows/ci.yml` runs four parallel jobs on every push
to `master` / `feat/**` / `fix/**` and every PR to `master`:

| Job | Command | Gate |
|---|---|---|
| typecheck | `tsc --noEmit` (apps/web) | **hard** |
| test      | `vitest run` (apps/web)  | **hard** |
| build     | `next build` (apps/web)  | **hard** |
| lint      | `eslint src --max-warnings 200` | soft (`continue-on-error: true`) |

Lint is intentionally NOT gated yet. The codebase has 149 pre-existing
React-Compiler problems (54 errors, 95 warnings, all non-blocking)
that would turn every PR red until cleaned up. Plan: focused
React-Compiler hygiene sprint, then flip the gate.

**Other niceties:**

- Node 22 (latest LTS).
- `npm` cache via `actions/setup-node` with `cache-dependency-path`.
- `.next/cache` cached via `actions/cache` keyed on lockfile + src
  file contents — saves ~3 min on warm runs.
- `concurrency.cancel-in-progress: true` so stale runs die when a
  newer push lands.
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` set to
  placeholders so `next build` static-analysis passes without
  exposing real CI secrets.

The build job is the most expensive (~3-5 min cold, ~1-2 min warm)
but it's the one that catches the actual deploy regressions, so
worth running.

---

## Coverage map — running total

**Closed since the audit-fixes branch started (v513–v545):**

| Plan ref | Title | Version |
|---|---|---|
| §1.1 | Терминология (Напоминания→Возвраты, Мастера→Сотрудники) | v518 |
| §1.3 | «Дальше»→«Далее» | v518 |
| §2.1 | DISPLAY_VERSION split | v513 |
| §2.2 | Inline-create persists to Supabase | v514 |
| §2.3 | Onboarding doesn't re-prompt | v515 |
| §2.4 | Empty-state CTA copy matches sheet | v516 |
| §2.5 | retry-fetcher (5xx+network) | v531 |
| §2.7 | Close-confirm destructive primary | v517 |
| §3.1 | Register: name + terms checkbox | v520 |
| §3.2 (a) | Onboarding default → personal | v526 |
| §3.2 (b) | Onboarding checklist | v544 |
| §3.5/3.6 | Desktop-aware gesture hints | v519 |
| §3.7 | Permission presets + collapse + search | v538 |
| §3.8 | Clients copy → Заметки | v522 |
| §3.9 | Source mandatory on create | v524 |
| §3.11 | Integrations stub | v528 |
| §3.13 | Settings 2-col on lg+ | v529 |
| §4.1 | Services empty-state (CRUD already done) | v539 |
| §5.1 | Telemetry façade + Sentry hookup docs | v543 |
| §5.2 | Playwright scaffolds | v534 |
| §5.3 | GitHub Actions CI | v545 |
| §5.5 | /docs/glossary.md | (mid-batch) |

**Still open:**

| Ref | Why deferred |
|---|---|
| §1.5 | Design-system primitives (`Button`/`Input`/`Modal`/`Switch`/`ColorPicker`/`EmptyState`/`Toast`) — multi-week extraction across many call sites |
| §2.6 | `data:image/` in RSC payload — 0 source matches; runtime profiling required (real fix lives in whichever library is emitting them) |
| §3.4 | «Без города» strip removal — only matches in source are inside aria-label fallbacks; visible-text instance needs browser repro |
| §3.10 | SMS templates overhaul (preset library, preview with substitutions, char counter) — large, separate sprint |
| §3.12 | Finance charts (recharts/visx) — large + new dep |
| §4.2–§4.10 | All P2 feature backlog (dashboard widgets, reports, online booking, real integrations, i18n, multi-currency, dark theme, audit log, mobile PWA) — multi-day each |
| §5.4 | Lighthouse audit + perf budget — once Sentry is live so we can correlate perf regressions to commits |
| §5.6 | Source-map upload (depends on §5.1 actual install) |
| Top-level `/dashboard/services` drag-reorder across categories | Larger DnD-kit refactor |
| Playwright skipped tests | Need test-only tenant factory to provision zero-state accounts |

---

## Next-sprint recommended order (unchanged from v520 report)

1. **Actually install Sentry** — `npm i @sentry/nextjs` + DSN + the
   adapter module documented in `docs/observability.md`. Closes the
   §5.1 / §5.6 / runtime-profiling loop in one move.
2. **React-Compiler lint cleanup** so the lint job can become a hard
   gate.
3. **§3.10 SMS overhaul** — closest to revenue.
4. **§3.12 finance charts** — biggest dashboard visible polish.
5. **Test-only tenant factory** to un-skip the 4 Playwright tests.
6. **§4.1 top-level service reorder** + design-system primitives prep.

---

## Branch metadata

- Branch: `feat/audit-fixes-2026-05`
- Last commit: `341b7bc` (v545)
- TSC: clean
- Vitest: 10/10 files, 68 tests
- ESLint: 149 pre-existing problems (untouched; will be cleaned in
  a focused sprint before lint gate flips)
- PR-ready: https://github.com/giliuta/babun2/pull/new/feat/audit-fixes-2026-05
