<!-- Babun autopilot PR template. Filled by the developer/tester/designer/security-auditor/performance-optimizer agents in turn. -->

## Story
`docs/stories/STORY-NNN-<slug>.md`

## Summary
<!-- One paragraph. What changed, why now. -->

## Acceptance — four-level contract (mirrors docs/_story-template.md)

### Functionality
- [ ] All CRUD operations covered by E2E (create / read / update / delete / list / search)
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
- [ ] Tailwind v4 tokens only; new tokens under `@theme`

### Accessibility
- [ ] axe-core `wcag2a + wcag2aa + wcag21a + wcag21aa` clean
- [ ] Keyboard navigation logical; focus ring visible; Esc closes modals
- [ ] Color contrast ≥ 4.5:1

### Performance
- [ ] LCP < 2.5 s, INP < 200 ms, CLS < 0.1 on Pixel 7 / 4G
- [ ] Lists > 50 rows use TanStack Virtual with `measureElement`
- [ ] Supabase queries indexed (no Seq Scan on > 1k-row tables)
- [ ] Bundle delta < +20 KB gzipped vs master

### Security
- [ ] RLS enabled on all new tables; cross-tenant probe in `babun-crm/apps/web/e2e/security/rls/`
- [ ] Zod validation on every Server Action and Route Handler
- [ ] No `dangerouslySetInnerHTML` (or sanitized via DOMPurify)
- [ ] Rate limit on public endpoints
- [ ] No secrets in client bundle

### i18n / PWA / Observability
- [ ] UI strings in Russian via dictionary; no JSX literals
- [ ] `BUILD_TAG` and `CACHE_VERSION` bumped (Golden Rule #3)
- [ ] Sentry breadcrumbs on user actions; error boundary at route level

## Test plan
<!-- Vitest cases + Playwright flows + axe-core scope + RLS probe path. Paste outputs. -->

## Rollback
- Down-migration: `babun-crm/supabase/migrations/XXXX_<slug>_down.sql` (if any)
- Feature flag: `<flag-name>` (if any)
- `git revert <sha>` is safe iff this PR is additive only.

## Autopilot pipeline log
- strategist: `READY_FOR_ARCH: STORY-NNN`
- architect: `READY_FOR_BUILD: STORY-NNN`
- developer: `READY_FOR_TEST: STORY-NNN`
- tester: `READY_FOR_DESIGN: STORY-NNN`
- designer: `READY_FOR_SECURITY: STORY-NNN`
- security-auditor: `READY_FOR_PERF: STORY-NNN`
- performance-optimizer: `READY_TO_MERGE: STORY-NNN`
