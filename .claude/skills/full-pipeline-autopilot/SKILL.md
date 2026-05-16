---
name: full-pipeline-autopilot
description: Run the entire autopilot loop for the next N pages in docs/BACKLOG.md. Default N=1. State machine through strategist → architect → developer → tester → designer → security-auditor → performance-optimizer per page. Stops on first red gate. Distinct from /full-pipeline (the chrome-devtools-based interactive babun pipeline).
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
argument-hint: [--max-pages=N] [--page=/route]
---

Arguments: $ARGUMENTS

Default `--max-pages=1`. Use `--page=/route` to force a specific route.

## State machine

The loop is driven by **state markers** that each subagent emits on its last line. The dispatcher (this skill body) reads the marker and invokes the next agent. Markers in order:

1. `READY_FOR_ARCH: STORY-NNN` — strategist done → invoke `architect`
2. `READY_FOR_BUILD: STORY-NNN` — architect done → invoke `developer`
3. `READY_FOR_TEST: STORY-NNN` — developer done → invoke `tester`
4. `READY_FOR_DESIGN: STORY-NNN` — tester green → invoke `designer`
5. `BUGS_FOUND: STORY-NNN` — tester red → bounce to `developer`, max 2 retries
6. `READY_FOR_SECURITY: STORY-NNN` — designer done → invoke `security-auditor`
7. `READY_FOR_PERF: STORY-NNN` — security clean → invoke `performance-optimizer`
8. `SECURITY_BLOCK: STORY-NNN` — security failed → bounce to `developer`, max 2 retries
9. `READY_TO_MERGE: STORY-NNN` — perf green → open PR, wait for Vercel preview, re-run tester against preview URL, merge with `gh pr merge --squash --auto`
10. `PERF_BLOCK: STORY-NNN` — perf failed → bounce to `developer`, max 2 retries
11. `STOP: <reason>` — kill switch from any agent → halt, ping Telegram, end loop

## Workflow

1. Invoke `strategist` subagent. Either pick the next story (default) or use the `--page=` argument to force a route.
2. Loop:
   - Parse last assistant message for a state marker.
   - Dispatch the next agent (see table above).
   - If any agent emits `STOP:` or three consecutive bounces happen for the same STORY → halt loop, summarize in chat, and end.
3. On `READY_TO_MERGE`:
   - `gh pr create` with the autopilot template.
   - Wait for the Vercel preview URL (poll the PR description for the preview comment, max 10 min).
   - Re-run `tester` against the preview URL (`PLAYWRIGHT_BASE_URL=<preview>`).
   - If green, `gh pr merge --squash --auto`. The post-merge GitHub Action runs production smoke; on failure, auto-revert and create a `regression/<NNN>` story.
4. Decrement `--max-pages` counter; if > 0 and time permits, loop back to step 1; otherwise stop.

## Safety caps
- Total Stop hooks per loop: 1 (immediate halt).
- Total `BUGS_FOUND` / `SECURITY_BLOCK` / `PERF_BLOCK` retries per STORY: 2 each.
- Total developer turns per STORY: 60 (enforced by agent `maxTurns`).
- Wall-time per STORY: soft target 60 min, hard cap 2 h.
- If a token-budget warning fires → finish the current STORY, do not start the next.
