---
name: review
description: Code review of uncommitted changes and recent commits. Run before pushing.
---

Review all changes relative to `origin/master`:

1. Run `git diff origin/master..HEAD` for committed changes + `git diff` for staged/unstaged
2. Run `git status --short` to see what's pending
3. For each changed file, check against the checklist below

**Checklist (block on any ❌):**

### TypeScript
- [ ] No `any`, no `ts-ignore`, no unsafe casts
- [ ] Interfaces for all component props
- [ ] Type imports use `import type`
- [ ] `npx tsc --noEmit` passes

### Architecture
- [ ] No business logic in components — lives in `lib/`
- [ ] Context used correctly (no per-page contexts)
- [ ] No new localStorage keys without matching `load*`/`save*` helpers
- [ ] When Supabase added: tenant_id enforced at DB level, never trusted from client
- [ ] No credentials / secret keys hardcoded
- [ ] No `console.log` in production code paths (ok in dev utilities / catch blocks where commented)

### UI
- [ ] Mobile-first — default styles work, `lg:` used only to enhance
- [ ] Safe-area respected on fixed/sticky elements touching screen edges
- [ ] No hardcoded colors outside Tailwind palette / design tokens
- [ ] Touch targets ≥ 44px
- [ ] Russian text in UI, English in code

### PWA
- [ ] If visible UI changed → `BUILD_TAG` bumped
- [ ] If cacheable routes changed → `CACHE_VERSION` bumped
- [ ] No new routes forgotten in `sw.js` PRECACHE_URLS

### Commits
- [ ] Each commit is one logical change
- [ ] Commit messages follow format `type: description` or `type(scope): description`
- [ ] No `--no-verify`, no force push, no amend of public commits

### Known gotchas (never regress)
- [ ] `userScalable: false` in viewport metadata (don't bring back page pinch-zoom)
- [ ] `touchAction: "pan-y"` on outer calendar scroller
- [ ] SwipeableCalendar still aborts on 2+ touches mid-swipe
- [ ] Dev SW auto-unregister in `ServiceWorkerRegister.tsx` intact

**Output:**
```
🔍 Review Summary
━━━━━━━━━━━━━━━━━━━━
Files changed: N
Blockers:      0 or list
Warnings:      N or list
Verdict:       ✅ Approve / ⚠ Approve with comments / ❌ Changes requested
━━━━━━━━━━━━━━━━━━━━
```

If blockers — do NOT push. List each with file:line and a fix suggestion.
