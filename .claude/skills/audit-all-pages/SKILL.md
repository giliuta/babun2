---
name: audit-all-pages
description: Audit every page under babun-crm/apps/web/src/app/ against the four-level done definition. Output to docs/BACKLOG.md, sorted by score.
allowed-tools: Read, Grep, Glob, Bash
---

For each route under `babun-crm/apps/web/src/app/`:

1. Identify the page file (`page.tsx`) and its components.
2. Score it 0–5 on each axis: functionality, UI/UX, performance, security.
3. Find concrete gaps:
   - missing `loading.tsx`
   - missing `error.tsx`
   - missing tests (no `*.test.tsx` or `*.test.ts` nearby; no Playwright spec in `e2e/`)
   - untouched files older than 30d with no test coverage
   - `any` / `as unknown as` usages — `grep -rn ": any\|as unknown as"`
   - hex colors instead of tokens — `grep -rnE '#[0-9a-fA-F]{3,8}'`
   - unindexed Supabase queries — `grep -rn "\.from(.*\.eq("`
   - hard-coded Russian strings in JSX (should be in dictionary)
   - missing skeleton loader
4. Run `cd babun-crm/apps/web && npm run analyze` once and attribute bundle weight per route.
5. If `mcp__sentry` is available: pull top issues last 7d touching each route.

Write `docs/BACKLOG.md` as a prioritized table. Columns:

| Page | Total score (0–20) | Top 3 gaps | Sentry users 7d | Est. effort | Risk |

Sort by `(20 - total_score) * log(sentry_users + 2)` descending.
Pages with score < 16 are blockers; mark them `🔴`.
Pages with score 16–18 are yellow; mark `🟡`.
Pages 19–20 are green; mark `🟢`.

After writing, print the top-5 pages as a short summary so the user can see at a glance.
