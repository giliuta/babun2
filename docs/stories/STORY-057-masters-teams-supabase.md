# STORY-057 — Migrate masters/teams to Supabase (multi-device)

**Status:** planned (next session)
**Priority:** P0 — blocker for true multi-device + SaaS readiness
**Estimated:** 1 week (2-3 focused sessions)

## Why

Discovered 2026-05-09 while debugging «у меня пропал личный календарь»:

- `masters` and `teams` are loaded **only from localStorage**
  ([DashboardClientLayout.tsx:751-752](../../babun-crm/apps/web/src/components/layout/DashboardClientLayout.tsx#L751-L752))
- A fresh PWA install / new device / cleared cache → both arrays empty
- Result: no personal pill, no brigade pills, blank week grid

v462 + v463 hotfixes papered over the symptoms (always render personal
tab + bootstrap a local master from `userEmail`). They unblock single-
device usage but **the data still doesn't sync between devices**, and
two devices for the same user produce two unrelated default masters.

This is a real blocker for:
1. CEO logging in from iPhone PWA after using desktop
2. Multi-master tenants (AirFix has 2 brigades = 4-6 masters)
3. SaaS onboarding for tenant #2 (anyone other than AirFix)

## Acceptance criteria

- [ ] `masters` table in Supabase with full Master interface coverage
      (permissions jsonb, salary_rules jsonb, team_id FK, login_email,
      personal_calendar_name, all the optional contact fields)
- [ ] `teams` table reconciled — current `001_initial_schema.sql` lacks
      `tenant_id`, `is_active`, `cities`, `default_city`, `slot_minutes`,
      `buffer_minutes`, `hide_cancelled` (all currently in `Team`
      interface in `packages/shared/src/local/masters.ts`)
- [ ] `team_masters` join table for many-to-many (a master can belong to
      multiple brigades — already supported in `salary_rules` per-team)
- [ ] RLS:
  - SELECT: `tenant_members` of the tenant
  - INSERT/UPDATE/DELETE: `tenant_members` with role IN ('owner','dispatcher')
- [ ] `lib/supabase/masters.ts` — `listMasters`, `upsertMaster`,
      `deleteMaster`, modeled after `lib/supabase/clients.ts`
- [ ] `lib/supabase/teams.ts` — same pattern
- [ ] `DashboardClientLayout` — `reloadMasters()` + `reloadTeams()`
      async effects, surface loading/error state via context, drop the
      `loadMasters()` / `loadTeams()` localStorage reads on mount
- [ ] `handleMastersChange` / `handleTeamsChange` write to Supabase
      first, optimistic local update, rollback on error
- [ ] Auto-bootstrap first owner-master moves server-side: when
      `tenant_members` get a row with role='owner' on signup, the same
      RPC creates a `masters` row for the user
- [ ] Migration script: import existing localStorage masters/teams to
      Supabase for current AirFix tenant (one-shot, manual)
- [ ] Drop localStorage fallback for masters/teams after import is
      verified live

## Out of scope

- `appointments`, `schedule`, `services` — already migrated (STORY-042,
  044, etc.). This STORY is masters/teams only.
- Live realtime sync between devices via Supabase Realtime — separate
  follow-up. Read-on-mount + write-through is enough for v1.
- `salary_rules` per-team detail UI — already works against in-memory
  Master, just needs the underlying storage swapped.

## Migration plan

1. **Schema migration** (`20260510_001_masters_teams.sql`)
   - `CREATE TABLE masters` with all columns from `Master` interface
   - `CREATE TABLE team_masters` join
   - `ALTER TABLE teams` to add missing columns
   - RLS policies (parallel to clients/appointments)
2. **Type regeneration**: `npm run db:types` (requires
   `SUPABASE_ACCESS_TOKEN` env var)
3. **Lib functions**: `listMasters / upsertMaster / deleteMaster`
   in `apps/web/src/lib/supabase/masters.ts`. Same shape as
   `apps/web/src/lib/supabase/clients.ts`.
4. **Loader wiring**: extend `DashboardClientLayout` state +
   useEffect for `reloadMasters / reloadTeams`. Show skeleton
   in calendar header while loading.
5. **One-time import**: `scripts/import-localstorage-masters.ts`
   that reads current localStorage dump (provided by CEO) and
   inserts into Supabase under AirFix tenant_id.
6. **Bootstrap RPC**: replace v463 client-side bootstrap with a
   Postgres trigger on `tenant_members` insert (role='owner') that
   inserts a corresponding `masters` row.

## Risks

- Existing localStorage masters on prod devices need to be preserved
  during cutover. Read-from-Supabase-fallback-to-localStorage during
  transition window (1 week) avoids data-loss.
- `salary_rules` schema is not stable — kept as `jsonb` initially to
  avoid blocking. Schematize after the next finance pass.
- Two competing loaders (localStorage + Supabase) during transition
  must be careful about merge order — Supabase wins, localStorage
  is the seed source.

## Blockers / what's needed from CEO

- **Supabase access token** for the agent OR CEO applies migration
  via `supabase db push` from local CLI. Without one of these, schema
  changes can't ship.
- Confirmation that the current AirFix masters/teams data in
  localStorage is the source of truth (vs. anything in Bumpix
  export from STORY-003).
