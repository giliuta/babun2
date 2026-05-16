# SPRINT-AUDIT-FIXES-2026-05 — extension batch #6

Continuation of `SPRINT-AUDIT-FIXES-2026-05-EXT5.md`. User said
«Продолжай делай все до конца». Worked autonomously through the
EXT5 «Recommended next session focus» list while sharing the
branch with several concurrent agents that landed v559–v568 in
parallel.

---

## What shipped this batch

| Version | Commit | Title |
|---|---|---|
| v563 | `bc2abd5` | feat(finance): CSV export button on /finances |
| (docs) | `acaf10b` | docs: CLAUDE.md gains claude-bridge MCP guidance |
| v564 contents | absorbed into `58e5dfe` | feat(briefing): «Не закрыто» row for overdue scheduled visits |
| (lint) | `3235dfc` | chore(lint): allow underscore-prefixed unused vars |
| v570 | `e9cd844` | fix(timeblock): hoist swipe refs above readOnly early-return |

Plus a misleading v569 (`553f789`) — its message advertises the
TimeBlock hook-order fix but the actual TimeBlock.tsx diff was
empty because a concurrent agent stashed my in-progress file
between `git add` and `git commit`. v570 is the corrected commit
with the real diff. Worth being aware of when reading history.

---

## Highlights

### §3.12 finance CSV button wired (v563)

Five-column export on the Finances toolbar. Uses the existing
`buildCsv` / `downloadCsv` utility from v559. Disabled when the
filtered view is empty so the user can't download a 0-row file.
Filename is the active-period key so multiple exports land as
separate files (`babun-finance-today.csv`, `…-week.csv`, etc.).

### §4.2 «Не закрыто» briefing row (v564 contents)

Morning briefing now shows a sixth Stat row counting work-kind
appointments whose date is in the past but status is still
`scheduled`. These are «недозвоны» / forgotten visits — the
dispatcher needs to either close them, cancel them, or call the
client back. Conditional rendering (only when count > 0) keeps
empty days silent. Closes the «недозвоны list» half of §4.2.

### TimeBlock hook-order bug (v570)

Real bug, not just lint hygiene. The component declared its
swipe refs (`swipeStartXRef`, `wasSwipeRef`) AFTER an
`if (readOnly) return …` early return. When TimeBlock rendered
in read-only mode the two `useRef` calls were skipped, so the
hook order between the two render paths differed. React's
rules-of-hooks requires identical call ordering — silent
violations are latent crashes waiting for the wrong remount
sequence to surface them.

Fix: hoist both refs to the top of the component, right after
the existing useState calls. Read-only mode now allocates two
unused refs (cost: nil) but the hook order is stable across
every render. Closes 2/57 lint errors that block flipping CI
lint to a hard gate.

### ESLint underscore pattern (3235dfc)

Quick config tweak — added `argsIgnorePattern`,
`varsIgnorePattern`, `caughtErrorsIgnorePattern`, and
`destructuredArrayIgnorePattern` set to `^_` for
`@typescript-eslint/no-unused-vars`. The underscore prefix is
the canonical «intentionally unused» marker; without the
pattern the codebase carried ~13 noise warnings on lines like
`(_cols, _opts) => …`. No errors promoted, just less noise.

Net: 153 → 140 lint problems, with errors unchanged at 57.

---

## Concurrent-agent contention notes

This sprint saw the highest concurrent-agent activity to date.
Pattern observed:

- Multiple agents share the branch and commit semi-autonomously.
- Some auto-stage with `git add -A`, which sweeps up another
  agent's WIP edits into commits whose subject line is unrelated.
  v564 contents are a clean example — my MorningBriefing change
  landed inside `58e5dfe` (refactor(settings): …useSaveStatus)
  with no mention of the briefing row in the message.
- One agent appears to run `git stash` periodically to keep its
  working tree clean, which pulled my edits out from under
  `git add` → produced the empty-diff v569.
- The same agent also checks out branches (saw `master` briefly)
  during work, which the system briefly surfaced as a «file
  reverted to v513» state — not an actual revert, just a branch
  context switch.

Mitigations that worked:

1. Re-edit + immediately stage + commit + push in a single
   atomic shell call. Anything longer than a few seconds between
   Edit and `git add` risks the file being modified again.
2. After a misleading commit lands (v569), follow up with a
   correcting commit (v570) whose message explains the gap.
   Don't try to amend — the history would still mention the
   first commit and amending under concurrent contention races
   the same way.
3. Stashes have meaningful names — read `git stash list` before
   assuming work is lost; mine was usually in stash@{0}.

For future sessions: a worktree-isolated subagent
(`isolation: "worktree"`) would dodge the contention entirely.
Documented in EXT2; bears repeating after this round.

---

## Coverage map — running total since v513

**Closed (28 items):**

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
| §3.12 | Finance sparkline + CSV util + button | v556 + v558 + v559 + v563 |
| §3.13 | Settings 2-col | v529 |
| §4.1 | Services empty-state | v539 |
| §4.2 (partial) | «Не закрыто» briefing row | v564 contents |
| §5.1 | Telemetry façade + docs | v543 |
| §5.2 | Playwright scaffolds | v534 |
| §5.3 | GitHub Actions CI | v545 |
| §5.5 | /docs/glossary.md | (mid-batch) |
| (CI infra) | package-lock.json committed | external |
| (lint) | underscore unused-vars pattern | 3235dfc |
| (rules-of-hooks) | TimeBlock swipe-ref hoist | v570 |

**Still open:**

- §5.1 actual install — needs user DSN.
- §3.12 PDF export — needs jspdf + autotable (~300 kB).
- §3.12 close-day button + day-cash reconciliation.
- React-Compiler hygiene — 55 lint errors remain (mostly
  `react-hooks/set-state-in-effect` and `preserve-manual-
  memoization`, each needs per-site judgement).
- §4.2 full dashboard widgets (top-3 masters, week / month
  rollups, fuller stats page).
- §4.3–§4.10 — Online booking, integrations, i18n, multi-
  currency, dark theme, audit log, mobile PWA.
- §3.4 «Без города» strip — needs browser repro.
- Service drag-reorder top-level — cross-category DnD refactor.
- Test-only tenant factory — un-skip 4 Playwright tests.
- §1.5 design-system primitives extraction.
- §5.4 Lighthouse perf budget — after Sentry.

---

## Branch metadata

- Branch: `feat/audit-fixes-2026-05`
- Last commit (mine): `e9cd844` (v570)
- TSC on my files: clean. External-agent WIP in
  `src/hooks/useFinanceData.ts` and `src/app/book/[slug]/page.tsx`
  has 2 + 3 errors respectively; neither is committed yet so CI
  doesn't see them.
- Vitest: 12 files, 78 tests.
- CI: green on origin/feat/audit-fixes-2026-05 as of last push.
- PR-ready: https://github.com/giliuta/babun2/pull/new/feat/audit-fixes-2026-05

---

## Recommended next session focus

1. **Resolve concurrent-agent WIP.** The `useFinanceData.ts` and
   `/book/[slug]/page.tsx` external WIP is on disk with tsc
   errors; either commit and fix or revert. Otherwise the next
   `npx tsc --noEmit` in any session will look broken at first
   glance.
2. **Install Sentry.** Still the highest-value §5 item; the
   façade has been waiting since v543.
3. **React-Compiler hygiene wave 2.** 55 lint errors left.
   Tackle the `set-state-in-effect` category first (~39 of
   them) — each is either a stale-deps bug or a legitimate
   external-state-sync that needs an `eslint-disable` with
   reason. Per-site decisions, but mechanical once started.
4. **§4.2 full dashboard widgets.** Top-3 masters table +
   week/month rollups + недозвоны list (the briefing row is
   only the alert; the list itself needs its own page or modal).
5. **Test-only tenant factory** → 4 Playwright tests un-skipped.
