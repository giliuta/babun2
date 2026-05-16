---
name: fix-all-bugs
description: Pull top Sentry issues from the last 24h, dedupe, and dispatch a developer + tester subagent per issue. Stops when issue count hits zero or PR cap is hit.
allowed-tools: Read, Write, Edit, Bash
---

## Workflow

1. Use `mcp__sentry__search_issues` with `is:unresolved environment:production age:-24h` sorted by `users` desc.
   - If `mcp__sentry` is not connected: print a clear message and stop. Do not invent issues.
2. For each issue:
   - `mcp__sentry__get_issue_details` for full context.
   - `mcp__sentry__analyze_issue_with_seer` to propose a root cause.
   - Generate a one-shot patch via `developer` subagent (branch `bug/sentry-<id>`).
   - Have `tester` write a Playwright regression test reproducing the original failure.
   - Open a PR titled `fix(sentry-<id>): <short description>`.
3. Cap at 5 PRs per run.
4. After cap or zero issues, print a Markdown summary listing each PR + Sentry issue link.
