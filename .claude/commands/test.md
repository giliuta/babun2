---
name: test
description: Run typecheck + lint on the web app. Test runner comes after STORY-001.
---

Run the full verification suite on `babun-crm/apps/web`:

1. **TypeScript** — `cd babun-crm/apps/web && npx tsc --noEmit`
   - Must be zero errors
   - If there are errors, list the first 20 lines of output and stop
2. **ESLint** — `cd babun-crm/apps/web && npx eslint src`
   - Report new errors compared to `master` (if possible)
   - Existing known warnings (unused vars, etc.) are acceptable unless explicitly asked to fix
3. **Build dry-run** (optional, slower) — if user says "full test": `cd babun-crm/apps/web && npm run build`

4. **Vitest** — once STORY-001 adds test infrastructure, also run `cd babun-crm/apps/web && npm run test -- --run`

Report format:
```
📋 Test Report
━━━━━━━━━━━━━━━━━━━━
TypeScript:  ✅ clean  |  ❌ N errors
ESLint:      ✅ clean  |  ⚠ N warnings  |  ❌ N errors
Build:       ✅ success  |  ❌ failed  |  ⏭ skipped
━━━━━━━━━━━━━━━━━━━━
```

Never swallow errors. If anything fails, show the user the first ~20 lines of output.
