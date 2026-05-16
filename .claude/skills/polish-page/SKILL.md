---
name: polish-page
description: Run designer + performance-optimizer + security-auditor agents on a single existing page without rebuilding it. Surface-level cleanup runs (loading/error/empty states, a11y, perf, RLS check).
allowed-tools: Read, Write, Edit, Bash
argument-hint: <route>
---

Page: $ARGUMENTS

If no argument given, ask the user which route, then proceed.

## Workflow

1. Read the current `babun-crm/apps/web/src/app/<route>/page.tsx` and its imports.
2. Invoke `designer` subagent on this page only. Apply the full polish checklist (skeleton, error, empty, viewports 320/360/390/414/768/1024, touch targets, contrast, tokens, microinteractions, iOS pinch-zoom preservation).
3. Then `performance-optimizer` — Lighthouse, bundle, EXPLAIN ANALYZE on any Supabase queries.
4. Then `security-auditor` — RLS / Zod / OWASP sweep on the route.
5. Open **one** PR titled `polish: <route>` covering all three sets of changes.

Do not change the route's data model or migrations. If a polish item requires schema changes, write a follow-up STORY instead and skip that item in this run.
