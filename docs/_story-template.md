# STORY-NNN: <page or feature> — <short description>

> Template for autopilot stories. Strategist fills `## Why now`, `## Scope`, `## Acceptance`. Architect appends `## Data model`, `## File plan`, `## Test plan`, `## Rollback`. Developer/tester/designer/security/perf log findings inline.

## Why now
- Backlog score: <impact>×<risk>×<sentry_freq> = <total>
- Sentry top issues touched (7d): <list with user count>
- User-visible symptom: <one sentence>

## Scope
- Route(s): `/...`
- Out of scope: <bulleted exclusions to prevent drift>

## Acceptance (the 4-level contract)

### Functionality
- [ ] All CRUD operations covered by E2E (create, read, update, delete, list, search)
- [ ] Edge cases: empty input, max-length input, special chars, concurrent edits, network failure mid-write
- [ ] Optimistic update + rollback verified via Playwright
- [ ] Server Action returns typed errors via `useActionState`

### UI / UX
- [ ] `loading.tsx` with skeleton matching final layout
- [ ] `error.tsx` with retry CTA, Russian copy
- [ ] Empty state with primary CTA
- [ ] 320 / 360 / 390 / 414 / 768 / 1024 viewports verified
- [ ] Touch targets ≥ 44 × 44 px
- [ ] Sonner toast on every mutation
- [ ] View Transition on navigation
- [ ] Tailwind v4 tokens only; new tokens added to `@theme`

### Accessibility
- [ ] axe-core `wcag2a + wcag2aa + wcag21a + wcag21aa` clean
- [ ] Keyboard navigation: tab order logical, focus ring visible, Esc closes modals
- [ ] Screen reader: main heading announced, form labels associated
- [ ] Color contrast ≥ 4.5:1

### Performance
- [ ] LCP < 2.5 s, INP < 200 ms, CLS < 0.1 on Pixel 7 / 4G profile
- [ ] Lists > 50 rows use TanStack Virtual with `measureElement`
- [ ] All Supabase queries indexed (no Seq Scan on tables > 1k rows — verify via `EXPLAIN ANALYZE`)
- [ ] Bundle delta < +20 KB gzipped vs master
- [ ] Server Components by default; client islands minimal

### Security
- [ ] RLS enabled on all new tables; cross-tenant probe in `babun-crm/apps/web/e2e/security/rls/`
- [ ] Zod validation on every Server Action and Route Handler
- [ ] No `dangerouslySetInnerHTML` (or sanitized via DOMPurify)
- [ ] Rate limit on public endpoints
- [ ] No secrets in client bundle

### i18n
- [ ] All UI strings via shared dictionary (RU)
- [ ] No hard-coded Russian or English in JSX
- [ ] Date/time/currency via `Intl` with `ru-RU` locale and EUR

### PWA
- [ ] Page works offline with stale-while-revalidate cache strategy
- [ ] Install prompt fires on supported devices
- [ ] `BUILD_TAG` bumped, `CACHE_VERSION` bumped (see CLAUDE.md Golden Rules)

### Observability
- [ ] Sentry breadcrumbs on user actions
- [ ] Analytics events: `page_view`, `<entity>_created`, `<entity>_updated`, `<entity>_deleted`
- [ ] Error boundary at route level

---

## Data model (architect fills)
- Tables touched: <list>
- New columns / indexes: <list>
- New RLS policies (must use `current_tenant_id()` SECURITY DEFINER): <list>

## File plan (architect fills, each ≤ 400 lines)
- `babun-crm/apps/web/src/app/<route>/page.tsx` — Server Component
- `babun-crm/apps/web/src/app/<route>/actions.ts` — Server Actions + Zod
- `babun-crm/apps/web/src/components/.../*.tsx` — Client islands
- `babun-crm/packages/shared/src/schemas/*.ts` — Zod schemas

## Test plan (architect fills)
- Vitest unit: <list>
- Playwright E2E: <flows>
- axe-core scope: <selectors>
- Cross-tenant RLS probe: `babun-crm/apps/web/e2e/security/rls/<table>-cross-tenant.spec.ts`

## Rollback
- Migration down: `babun-crm/supabase/migrations/XXXX_<slug>_down.sql`
- Feature flag (if any): `<flag-name>`
- Revert PR: `git revert <sha>` is safe iff migration is additive only.

---

## Pipeline log (agents append, do not overwrite)

### Strategist
`READY_FOR_ARCH: STORY-NNN`

### Architect
`READY_FOR_BUILD: STORY-NNN`

### Developer
- Commits: <sha list>
- `READY_FOR_TEST: STORY-NNN`

### Tester
- Vitest: <pass/fail counts>
- Playwright: <pass/fail counts>
- axe-core: <violations>
- Found bugs: <list> or "none"
- `READY_FOR_DESIGN: STORY-NNN` or `BUGS_FOUND: STORY-NNN`

### Designer
- Polish checklist completed
- `READY_FOR_SECURITY: STORY-NNN`

### Security-auditor
- OWASP sweep: <findings>
- RLS matrix: <findings>
- `READY_FOR_PERF: STORY-NNN` or `SECURITY_BLOCK: STORY-NNN`

### Performance-optimizer
- LCP / INP / CLS measured: <values>
- Bundle delta: <KB>
- EXPLAIN ANALYZE summary: <findings>
- `READY_TO_MERGE: STORY-NNN` or `PERF_BLOCK: STORY-NNN`

### Merge
- PR: #NNN
- Vercel preview: <url>
- Production deploy: <url>
- Post-deploy smoke: <pass/fail>
- Status: `done` | `reverted` | `rolled-back`
