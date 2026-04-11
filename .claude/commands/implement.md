---
name: implement
description: Implement a story that already has a plan in docs/stories/
argument-hint: [story-id] (e.g. 001)
---

Implement STORY-$ARGUMENTS.

**Prerequisites check:**
1. Verify `docs/stories/STORY-$ARGUMENTS.md` exists. If not — tell user to run `/plan` first.
2. Read the story completely. Do not skim.
3. Read `docs/coding-patterns.md`.
4. If the story has `Status: done` — ask if they want to re-implement or add something.
5. If the story has `Dependencies:` that are not `done` — stop and warn.

**Implementation order (strict):**
1. **Database migrations** (if any) → `supabase/migrations/`
2. **Types** → `src/lib/*.ts` interfaces, `packages/shared/types/`
3. **Data layer** → `src/lib/*.ts` load/save functions
4. **API routes** (if any) → `src/app/api/*/route.ts`
5. **Context providers** → update `src/app/dashboard/layout.tsx`
6. **Components** → `src/components/*`
7. **Pages** → `src/app/*/page.tsx`
8. **Tests** (when test runner is set up)

**Per-file checklist:**
- Does it follow `docs/coding-patterns.md`?
- Is the file < 400 lines?
- Named exports, not default (except pages)?
- No `any` types?
- Error handling at boundaries?

**After a batch of related files:**
- Run `cd babun-crm/apps/web && npx tsc --noEmit` — must be green
- Run `cd babun-crm/apps/web && npx eslint src` — no new errors
- If UI changed: bump `BUILD_TAG` in `src/app/dashboard/page.tsx` and `CACHE_VERSION` in `public/sw.js`

**Committing:**
- One logical change = one commit
- Message format: `feat(STORY-$ARGUMENTS): {what}` or `refactor(STORY-$ARGUMENTS): {what}`
- Push to `master`: `git push origin master`

**When done:**
1. Update `Status: done` in the story file
2. Add a brief "Notes" section at the bottom with surprises / lessons learned
3. Commit the story update
4. Run `/status` to confirm everything is green
