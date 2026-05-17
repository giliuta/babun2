# SPRINT-AUDIT-FIXES-2026-05 — extension batch #8

Continuation of EXT7. User said «продолжай дальше» after seeing
the v597 Vercel build go red, then «даю полное согласие» on the
merge to master once I asked. This batch:

1. Diagnosed and fixed the Vercel red production deploy.
2. Merged v598-v601 (audit log + Sentry wiring + dark theme +
   PDF export) into master so production catches up.
3. Wired the audit log into DashboardClientLayout mutation paths.
4. Caught & fixed two more build-breaking errors from concurrent-
   agent commits (v604 + v605).

---

## What shipped this batch

| Version | Commit | Title |
|---|---|---|
| v601 | `d29f986` | fix(api/sms): unblock Vercel build — profiles tenant_id type |
| (merge) | `791b2bb` | Merge feat/audit-fixes-2026-05 round 10 → master (v598-v601 to production) |
| v603 | `0a85108` | feat(audit): wire logAudit into DashboardClientLayout appt + client mutations |
| v606 | `7192bc5` | fix(AppointmentSheet + WebhooksCard): unblock build + AppointmentSheet visitsForClient destructure |

External agents landed v602, v604, v605 alongside (Telegram MVP,
audit follow-ups, webhooks CRUD UI).

---

## The Vercel red-deploy diagnosis

User shared a screenshot showing all recent Vercel deploys on
`feat/audit-fixes-2026-05` with red dots, plus the latest
`master` production deploy also red.

Local `npm run build` revealed 2 TS errors in
`api/sms/test/route.ts` introduced by external commit v597:

  `Property 'tenant_id' does not exist on type 'never'`

Cause: the `profiles` table isn't in the generated Database type,
so `supabase.from("profiles").select("tenant_id")` resolved its
row type to `never`. The fix is the same `(supabase as any)`
pattern other routes in the codebase already use, plus an
explicit narrow `as { tenant_id?: string } | null` on the result.
Local `npm run build` then succeeded green.

v601 committed the fix on `feat/audit-fixes-2026-05`. Then user
authorized merge to master → round 10 merge commit pushed → next
Vercel production build picks up the fix.

## The merge-to-master dance

Auto-classifier initially denied the merge twice (`git merge`
and `git checkout` both got blocked as part of a «production-
deploy workflow without specific authorization»). User explicit
«даю полное согласие» unblocked the merge.

Local master had diverged from origin/master because of how the
fast-forward landed; reconciled by merging origin/master into
local then pushing. Concurrent activity meant a second auto-
merge commit appeared between my fetch and push (`791b2bb` from
external agent), but the push completed cleanly once both sides
converged.

## v603 audit wiring — appointments + clients

Adds `logAudit({entity, action, summary, entityId})` calls to
four mutation entry points in DashboardClientLayout:

  • `upsertAppointment` — inMemory? "update":"create", summary
    `${date} ${time_start} · ${comment-first-60}`.
  • `deleteAppointment` — captures the pre-delete date/time/
    comment snapshot before the optimistic state flip.
  • `upsertClient` — same shape, `full_name || phone || "—"`
    summary.
  • `deleteClient` — captures `full_name` from
    `clients.find(...)` before the deleteClientRepo call.

Logged BEFORE the await on the optimistic-write path so the
journal entry exists even if the network drops later. The entry
reflects user intent; sync errors are a separate signal via
`reportSyncError`.

Result: `/dashboard/audit` (v598) now fills up naturally as the
dispatcher works through the day.

## v606 — two more build fixes + AppointmentSheet missing destructure

After v604 (giliuta's «audit follow-ups — RLS security, P0 #6
dedup, loyalty auto-apply») and v605 (webhooks CRUD UI), local
tsc flagged 5 errors that would block the next Vercel deploy:

1. `AppointmentSheet.tsx:265,277,310` — `visitsForClient` was
   declared as an optional prop on the interface but never
   destructured from the function's props bag. TS2304 «Cannot
   find name».
2. `WebhooksCard.tsx:98,123` — `supabase.from("webhooks")
   .insert(…).update(…)` — `webhooks` not in Database type,
   same `(supabase as any)` cast needed.

v606 fixes both. Same shape as v601 (profiles).

## Failed: master/team/service audit wiring

Tried to add the same v603-style logAudit calls to upsertMaster
/ deleteMaster / upsertTeam / deleteTeam / upsertService /
deleteService. Concurrent agent reverted the edits between Edit
and commit at least twice. After two retry windows abandoned —
diminishing returns. Future session can re-attempt during a
quieter contention window. Pattern is documented in v603 commit
message; each addition is 6-8 lines per call site.

The 4 wired call sites (v603) cover the most frequent dispatcher
actions; the 6 remaining are admin-side and lower-frequency.

---

## Coverage map — running total since v513

The major closures that landed in this entire sprint chain:

| § | Title | Wave |
|---|---|---|
| §3.12 | Finance sparkline + CSV + PDF + buttons | EXT5 + EXT7 |
| §4.4 | Audit log MVP (lib + page + nav + 4-call wiring) | EXT7 + EXT8 |
| §4.7 | Dark theme | EXT7 |
| §5.1/§5.6 | Telemetry façade + Sentry adapter + bootstrap | EXT4 + EXT7 |
| §4.2 (partial) | «недозвоны» loop end-to-end | EXT6 |
| Build green | api/sms/test, AppointmentSheet, WebhooksCard fixes | EXT8 |
| (merge) | round 10 to master — production catches up | EXT8 |

Still open (multi-day or external-dep):
- Sentry DSN in Vercel env — closes §5.1 deploy side
- §1.5 design-system primitives (multi-week)
- §4.6 i18n (multi-day, next-intl rollout)
- §4.3 online booking (multi-day)
- §4.5 real WhatsApp/Telegram/Instagram (multi-day API plumbing)
- §4.2 widgets v2 — standalone page (multi-day)
- Audit log → Supabase (when a second user needs the trail)
- Test-tenant factory (backend infra decision)
- React-Compiler hygiene wave 3 (~50 errors; eslint-config-next
  hoist collision needs `cd apps/web && npm i eslint-config-next`
  first)
- DashboardClientLayout audit wiring for masters/teams/services

---

## Concurrent-agent contention — EXT8 sample

This was the most contentious round. Cycle observed multiple
times:

1. I edit DashboardClientLayout adding logAudit calls.
2. External agent commits (v604/v605/etc.) overwriting the file.
3. My `git add` sees the new file content, stages it minus my
   edits.
4. Commit succeeds but with a misleading message because the
   actual diff doesn't include what the message claims.

Mitigation that worked: smaller atomic windows (Edit → `git add`
→ `git commit` → `git push` in a single bash call); when caught,
follow-up commit with honest correction message.

Mitigation that didn't work: trying to retry the same large set
of edits when external agent is actively editing the same file.
After 2 attempts, accept the partial delivery and move on.

---

## Branch + production state at EXT8 close

- `feat/audit-fixes-2026-05` tip: v606 (`7192bc5`) on
  `feat/audit-fixes-2026-05`
- Local `master` is up to date with `origin/master` plus the
  round-10 merge that brought v598-v601 to production.
- Local `npm run build` was green at v601 (verified). v606
  added two more build fixes for v604/v605 regressions, so
  the next Vercel build on feat should also be green.
- The merge-to-master from EXT8 has triggered a fresh Vercel
  production deploy on the round-10 tip — that build should
  finally turn green and ship audit log + dark theme + PDF +
  Sentry adapter (DSN-pending) to production users.
- `tsc --noEmit` clean. ESLint still broken from EXT7's
  eslint-config-next hoist collision; CI gates on tsc + build,
  not lint, so unblocked.
