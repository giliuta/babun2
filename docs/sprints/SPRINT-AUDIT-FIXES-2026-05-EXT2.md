# SPRINT-AUDIT-FIXES-2026-05 — extension batch #2 (autonomous + agents)

Follow-on to `SPRINT-AUDIT-FIXES-2026-05-EXT.md`. After the user said
«делай» / «что осталось?» / «делай» again, I worked autonomously
and delegated two independent items to subagents in parallel. This
file documents what actually landed.

---

## What shipped this batch

| Version | Commit | Title | Source |
|---|---|---|---|
| v531 | `ad9a26f` | feat(http): exponential-backoff retry wrapper for fetch() (§2.5) | mine |
| v533 | `359b972` | feat: personal-cal push default + mini-cal year picker + desktop haptics hide | external |
| v535 | `37b378b` | feat(time): wheel honours team's slot step + Today tooltip — **also picked up Agent B's Playwright scaffolds** | external + Agent B |
| v537 | `2fc4788` | fix(comms): chats filter trims SMS chip + SMS-templates RU vars + create-mode hides Delete (P2 #38/39/41) | external |
| v538 | `4fac670` | docs(sprint): SPRINT-FINAL-SCOREBOARD — **also picked up Agent A's permission presets** (§3.7) | external + Agent A |
| v539 | `560a345` | feat(services): empty-state CTA for fresh tenants (§4.1) | mine |
| —    | `109a158` | chore(copy): «в мае» genitive + neutral phone labels (P2 #36/37) | external |
| —    | `f090bb3` | docs(sprint): mark CRM Core P2 #36/37/38/39/41 + P1 #22 as DONE | external |

All pushed to `origin/feat/audit-fixes-2026-05`.

---

## §2.5 — retry-fetcher (v531, mine)

`babun-crm/apps/web/src/lib/http/fetcher.ts` + 5 vitest cases.

- `fetchWithRetry(input, { retries, initialDelayMs, shouldStopRetrying, reportFinalFailure, context })` with exponential backoff (300 ms × 2^attempt + jitter).
- Retries on 5xx, 408, 429 + thrown network errors. Returns 4xx as-is (caller's bug). AbortSignal honoured throughout.
- `fetchJsonWithRetry<T>()` wrapper for JSON endpoints.

**What this DOES NOT cover** (documented in the file header): RSC navigation 5xx — that's Next's prefetch / streaming machinery's domain; the runtime applies its own retries. The user-visible 503 on `/chats?_rsc=…` should be debugged via Sentry (§5.1, still deferred) + Vercel function logs at the cold-start layer.

Vitest pool: 9/9 files → **10/10 files, 68 tests** (+5 new).

---

## §5.2 — Playwright scaffolds (v534/535, Agent B)

Specs under `babun-crm/apps/web/e2e/` for the v513–v517 P0 flows:

- `register.spec.ts` — checkbox-gate (active) + happy-path (skipped, would create real prod users).
- `inline-client.spec.ts` — inline client create persists in `/clients` (active).
- `onboarding.spec.ts` — onboarded tenant sees no first-run screen (active) + fresh-tenant variant (skipped, needs test-only factory).
- `empty-state.spec.ts` — CTA copy per tab (both skipped, needs zero-appointment test tenant).
- `close-confirm.spec.ts` — empty form closes silently + dirty form shows red discard primary (both active).

Plus:
- `playwright.config.ts` (chromium headless, `BABUN_E2E_BASE_URL` env).
- `e2e/tsconfig.json` extending root.
- `README-PLAYWRIGHT.md` with setup + run instructions.
- `package.json` scripts (`e2e`, `e2e:install`) + `@playwright/test ^1.49.0` devDep.
- Root `tsconfig.json` + `vitest.config.ts` exclude `e2e/**` so the main app build and unit tests stay clean.

**Active: 5 tests. Skipped: 4 tests.** Skipped ones need a test-only tenant factory to provision zero-appointment / unonboarded accounts without touching real prod data.

**Commit attribution quirk:** Agent B's files landed inside `37b378b` (titled «feat(time): wheel honours team's slot step…») because a concurrent external agent did `git add -A` on a dirty tree. Functionally correct; subject line misleading.

---

## §3.7 — Permission presets (v538, Agent A)

`/dashboard/masters/[id]/access/page.tsx` rewrite + new `presets.ts`:

- **5 preset chips** at the top: «Менеджер», «Мастер», «Диспетчер», «Только просмотр», «Кастомные». Custom auto-selects when the current matrix doesn't match any other preset.
- **Collapsible groups** (calendar / clients / finance / chats / admin) with `aria-expanded` + `aria-controls`. First group default-expanded, rest collapsed. State persisted to `localStorage` at `babun2:settings:perm-groups-open`.
- **Search field** above the groups. Filters by `PERMISSION_LABELS[key]` with `ё → е` normalisation. Non-empty query auto-expands all groups; clearing the query restores saved state.

**Testids:** `access-preset-{manager|master|dispatcher|viewer|custom}`, `access-search`, `access-group-{calendar|clients|finance|chats|admin}`.

**Commit attribution quirk:** same as Agent B's — landed inside `4fac670` (titled «docs(sprint): SPRINT-FINAL-SCOREBOARD…») because of concurrent `git add -A`. Files at HEAD are correct; verified by Agent A.

---

## §4.1 — Services empty-state (v539, mine)

Services page (`/dashboard/services`) already had full CRUD before this session. What was missing: an empty-state for fresh tenants. Without it the screen showed just the categories collapse and a void below.

`v539` adds a centered card on `services.length === 0` with:
- Settings-icon disc
- Heading «Пока нет услуг»
- Body explaining what a service is + that price/duration auto-fill into appointments
- Primary CTA «Создайте первую услугу» → triggers the existing `handleNew()` flow

Drag-to-reorder at the top level was NOT added — already exists at the brigade-scoped `/dashboard/teams/[id]/services` per the `Service.sort_order` comment, and top-level reorder across categories is a larger DnD-kit refactor for a focused commit later.

---

## Lessons from this batch

**Parallel-agent collisions on `git add -A`** twice cost us clean commit subject lines (37b378b, 4fac670). Both feature commits ended up under unrelated «feat(time)…» / «docs(sprint)…» titles. The content is fine but the log reads strangely. For next sprints with concurrent agents:

- Have agents stage **only their own files explicitly** with `git add path/to/file` — not `git add -A`.
- Or assign each agent a worktree (`isolation: "worktree"` in the Agent tool) so writes don't collide on the same working tree.

The `c998c81` v515 picked-up-external pattern from the earlier sprint worked fine because it was a single external editor. Two agents + one external editor on the same dirty tree is what broke commit attribution.

---

## Coverage map — running total since the audit-fixes branch started

**Closed:**

| Plan ref | Title | Version |
|---|---|---|
| §2.1 | DISPLAY_VERSION split | v513 |
| §2.2 | Inline-create persists | v514 |
| §2.3 | Onboarding doesn't re-prompt | v515 |
| §2.4 | Empty-state CTA copy | v516 |
| §2.5 | retry-fetcher | v531 |
| §2.7 | Close-confirm primary swap | v517 |
| §1.1 | Терминология | v518 |
| §1.3 | Дальше→Далее | v518 |
| §3.1 | Register UX | v520 |
| §3.5/3.6 | Desktop-aware gesture hints | v519 |
| §3.7 | Permission presets | v538 |
| §3.8 | Clients copy → Заметки | v522 |
| §3.9 | Source mandatory | v524 |
| §3.2 (a) | Onboarding default → personal | v526 |
| §3.11 | Integrations stub | v528 |
| §3.13 | Settings 2-col | v529 |
| §4.1 | Services empty-state (CRUD already done) | v539 |
| §5.2 | Playwright scaffolds | v534 |
| §5.5 | /docs/glossary.md | — |

**Still open:**

- **§2.6** base64 in RSC payload — 0 source matches; runtime profiling.
- **§1.5** design-system primitives — multi-week extraction.
- **§3.2 (b)** post-onboarding checklist on StepDone.
- **§3.3** sidebar aria — existing rows have visible text labels; no iconic-only sidebar buttons need work.
- **§3.4** «Без города» strip — only aria-label fallback in source; visible-text instance needs browser repro.
- **§3.10** SMS overhaul — large.
- **§3.12** Finance charts — large; new dep.
- **§4.2 – §4.10** P2 features (dashboard widgets, reports, online booking, integrations, i18n, multi-currency, dark theme, audit log, mobile PWA) — multi-day each.
- **§5.1** Sentry — single biggest infrastructure unlock.
- **§5.3** CI lint+typecheck+test gates.
- **§5.4** Lighthouse audit.
- **§5.6** Sentry source maps + release tags (depends on §5.1).

---

## Recommended next-sprint order (unchanged)

1. **§5.1 Sentry + release tags** — unblocks §2.5 telemetry + §2.6 runtime profiling + all silent-fail audits.
2. **§3.10 SMS overhaul** — close to revenue.
3. **§3.12 finance charts** — visible dashboard polish.
4. **§3.2 (b) post-onboarding checklist** + design-system primitives prep.
5. Top-level service drag-reorder across categories.
6. Resolve Playwright skipped tests by adding a test-only tenant factory.

---

## Branch metadata

- Branch: `feat/audit-fixes-2026-05`
- Last commit: `560a345` (v539)
- TSC: clean (Playwright-spec types only flag when `@playwright/test` is missing; excluded from app build)
- Vitest: 10/10 files, 68 tests
- ESLint: pre-existing React-Compiler hints unchanged
- PR: https://github.com/giliuta/babun2/pull/new/feat/audit-fixes-2026-05
