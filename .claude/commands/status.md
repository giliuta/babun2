---
name: status
description: Snapshot of project state — stories, git, build, deploy
---

Report a concise dashboard of where Babun2 stands right now.

Collect in parallel:
1. `ls docs/stories/` → count stories by status (grep `Status: done/in-progress/todo`)
2. `git log --oneline -5` → last 5 commits
3. `git status --short` → uncommitted changes count
4. `git rev-list --count origin/master..HEAD` → commits ahead of origin
5. Read `babun-crm/apps/web/public/sw.js` for current `CACHE_VERSION`
6. Read `babun-crm/apps/web/src/app/dashboard/page.tsx` for current `BUILD_TAG`

Output format:
```
📊 Babun2 Status
━━━━━━━━━━━━━━━━━━━━━━━
Stories:      N done  |  M in-progress  |  K todo
SW version:   babun-vN
Build tag:    vN-{feature}
Git:          clean  |  N uncommitted  |  N ahead of origin
Branch:       master
Last commit:  {sha} {message}
━━━━━━━━━━━━━━━━━━━━━━━
Next action:  {suggestion based on roadmap.md top unfinished item}
```

Keep it under 15 lines of output. Don't run tests or builds — this is read-only.
