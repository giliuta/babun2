---
name: setup
description: Verify dev environment is ready for Babun2 work
---

Verify the dev environment is configured correctly for Babun2.

**Checks (in parallel where possible):**

1. Working directory is `c:\Users\Dmitry\Desktop\Babun2` — if not, stop.
2. `git remote -v` — must include `origin  https://github.com/giliuta/babun2.git`
3. `git branch --show-current` — must be `master`
4. `ls babun-crm/apps/web/package.json` — the web app exists
5. `cd babun-crm/apps/web && node -v` — Node version (expect ≥ 20)
6. `cd babun-crm/apps/web && ls node_modules/next/package.json` — dependencies installed
7. `cd babun-crm/apps/web && cat node_modules/next/package.json | grep version` — Next 16.x
8. `cd babun-crm/apps/web && npx tsc --noEmit` — typecheck baseline (0 errors expected)
9. Check `docs/` exists with `architecture.md`, `coding-patterns.md`, `roadmap.md`
10. Check `.claude/commands/` has plan/implement/test/review/status/debug/setup
11. Check `.reference/` exists (nextcrm, calcom, monica) — optional but helpful

**Output format:**
```
🔧 Setup Check
━━━━━━━━━━━━━━━━━━━━━━━
Working dir:     ✅ Babun2
Git:             ✅ master @ origin
Node:            ✅ vXX.X.X
Dependencies:    ✅ installed
Next.js:         ✅ 16.X.X
TypeScript:      ✅ clean
Docs:            ✅ present
Commands:        ✅ all 7 present
Reference repos: ✅ 3 cloned
━━━━━━━━━━━━━━━━━━━━━━━
Status: READY
```

If ANY check fails, stop and print the fix command. Don't auto-fix without permission.
