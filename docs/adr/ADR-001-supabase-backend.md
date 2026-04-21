# ADR-001 — Supabase as the Babun CRM backend

**Status:** `accepted` — 2026-04-21 (CEO approved pool model + LWW offline v1)
**Date:** 2026-04-21
**Deciders:** Dima (CEO/owner), Claude (architect)
**Supersedes:** none
**Related:** [STORY-001](../stories/STORY-001.md) (execution plan)

---

## Context

Babun CRM ships to AirFix today as a phone-first PWA with **localStorage as the only store**. That choice was deliberate for the prototype — zero backend to run, zero auth to get wrong, fast iteration — but it has now reached the end of its runway:

- **Clear-cache = total data loss.** iOS aggressively evicts PWA storage after 7 days of inactivity. One customer on a week-long holiday lost 200+ visits.
- **No multi-device.** The dispatcher's iPhone and the owner's laptop hold independent, diverging copies. Manual JSON export/import is a fragile workaround.
- **No multi-user.** The brother (dispatcher) and two brigade leads need *concurrent* access to shared appointments, not snapshots.
- **SaaS requires multi-tenancy.** The product roadmap calls for selling Babun to other service companies by 2026-Q4. Doing multi-tenancy retroactively on top of a flat-data codebase is 3× the work.

A backend is no longer optional. The question is *which*.

## Decision

**Adopt Supabase (managed Postgres + PostgREST + GoTrue + Storage + Realtime) as the single backend for Babun CRM. Model multi-tenancy as a `tenant_id` column on every business table, enforced by Row-Level Security (RLS).**

Concretely:

1. Every tenant-scoped table has `tenant_id uuid not null references tenants(id)`.
2. A single RLS policy per table: `tenant_id = auth.jwt() ->> 'tenant_id'`.
3. Users live in `auth.users` (Supabase-managed). A `public.users` extension table adds `tenant_id` and the in-app role (`owner`, `admin`, `dispatcher`, `lead`, `helper`).
4. The anon key ships in the client bundle; the service-role key never does (server actions only, if at all).
5. Client code reads/writes through `@supabase/supabase-js` v2. No custom ORM.

## Options considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Supabase** | Managed Postgres, auth, realtime, storage, RLS — one vendor. EU region available (low Cyprus latency). Generous free tier covers AirFix for years. Matches CLAUDE.md stack. | Vendor lock-in on PostgREST-flavoured REST + RLS DSL. RLS debugging is hairy. | **Chosen** |
| Firebase (Firestore) | Mature realtime. Offline-first SDK is best-in-class. | NoSQL → reshape every money-sensitive aggregation. No SQL for reports. Weak RLS (security rules DSL). Higher total cost once appointments grow. | Rejected — finance & reports want SQL. |
| Self-hosted Postgres + custom API | Full control. No lock-in. | We'd need to build auth, RLS tooling, realtime, storage, a deploy pipeline, backups, and operate them. 2+ months of work before the first feature. | Rejected — not a database-ops team. |
| PlanetScale / Neon + custom API | Great DB, no lock-in on server logic. | Still needs our own auth layer and realtime. Effort ≈ self-hosted without the ops burden. | Rejected — same "build auth" problem as self-hosted. |
| Keep localStorage + manual export/import | Zero change. | Does not solve the problem. Blocks SaaS. | Rejected. |
| Supabase *without* RLS; rely on application-level filtering | Simpler to reason about locally. | One bug in a client query leaks cross-tenant data. Fatal for SaaS. | Rejected. |

## Consequences

### Positive

- **One migration, many tenants.** Multi-tenant shape from day one; adding the second paying customer is a SQL insert, not a re-architecture.
- **Realtime for free.** The dispatcher sees brigade-lead updates live without us wiring sockets.
- **Storage for photos.** `AppointmentPhoto.data_url` (base64 blobs in localStorage) becomes `storage_path` in Supabase Storage — cheaper, CDN-cached, not capped by localStorage quota.
- **Auth solved.** `/login` stops being a stub. Password reset, email verification, magic links all ship with GoTrue.
- **RLS as defense-in-depth.** Even if we ship a buggy query, the database refuses to return another tenant's rows.
- **SQL available for reports.** `/dashboard/reports` can run aggregations that are awkward in Firestore.

### Negative

- **Offline-first becomes harder.** localStorage was offline-by-default; Supabase client is online-by-default. Mitigated by a small IndexedDB write-through cache — see "Offline strategy" below.
- **RLS error messages are terse.** Violations surface as generic 401s. We'll need a dev-only trace tool to understand why a query was blocked.
- **Clock-skew bugs shift from browser to server.** Appointment `date` is a `YYYY-MM-DD` string today; we keep it that way (no tz math on the DB). `created_at` / `updated_at` move to `timestamptz` with server `now()`.
- **Connection pool ceilings.** Supabase's free tier caps concurrent connections. Client-only app is fine; any future cron/server action must use the pooler URL.
- **One more environment variable to get right.** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be set on Vercel per environment.

### Neutral / deferred

- **Billing.** Free tier is enough for AirFix-only through end of 2026-Q3 (estimate: 2k rows/month, 50 MB photos). Revisit when we onboard the second tenant.
- **Backups.** Supabase PITR is paid-tier. For now, rely on nightly `pg_dump` via a scheduled GitHub Action until we upgrade.
- **Edge vs node.** Client-only reads don't care. We defer Edge Functions until a concrete use-case (e.g., SMS webhook) appears.

## Multi-tenancy shape (non-obvious bit)

**One schema, shared tables, `tenant_id` column, RLS enforces isolation.** This is the "pool" model.

Alternatives considered:

- **Schema-per-tenant** (one `tenant_n` schema per customer): cleanest isolation, but migrations have to run N times and we lose cross-tenant admin queries. Overkill for < 100 tenants.
- **Database-per-tenant:** absolute isolation, eye-watering cost, pointless at our scale.

The pool model trades maximum isolation for operational simplicity. Given our trust model (any cross-tenant leak is a company-ending event, but we own the whole stack and one RLS policy per table is tractable to audit), it's the right call for < 500 tenants. Revisit if we win a regulated customer (medical, financial) who demands their own schema.

## Offline strategy

Dispatchers use Babun on iPhones that lose cell signal in Cyprus villages several times a day. We cannot ship a backend that turns the app into a paperweight when the dispatcher steps into a basement.

Approach:

1. **Read-through cache** in IndexedDB (via `idb` or Dexie — decide at implementation time). Every Supabase query also writes the response to IDB keyed by `(table, tenant_id, query_hash)`.
2. **Optimistic writes:** mutations enqueue to an IDB outbox immediately, render in UI as committed, and retry on reconnect. Conflicts resolve last-write-wins for v1.
3. **Sync indicator** in the sidebar footer (already exists — "Синхр. hh:mm") turns amber when the outbox has un-flushed writes.
4. **No CRDT in v1.** Last-write-wins is boring and correct for a single-dispatcher-per-tenant use-case. Revisit when multi-dispatcher appears.

This is the biggest unknown in the migration and deserves its own ADR (ADR-002) once we prototype.

## Migration plan summary

Execution detail lives in [STORY-001](../stories/STORY-001.md). Phases:

1. **Schema + RLS** — run migrations in a new Supabase project, verify RLS with automated cross-tenant probes.
2. **Shadow-read** — every `loadX()` reads from both localStorage *and* Supabase, compares, logs diffs. No write-through yet. Two-week soak.
3. **Flip reads** — Supabase becomes the read source; localStorage becomes a read-through cache for offline.
4. **Flip writes** — mutations write to Supabase via the outbox; localStorage becomes a pure cache.
5. **Drop localStorage seeding** — delete `MOCK_APPOINTMENTS`, `DEFAULT_TEAMS`, etc. Fresh installs get a per-tenant seed on signup.
6. **Delete the shim** — remove the `babun-*` localStorage keys after two weeks of clean production telemetry.

**A one-time import script** lets AirFix keep its current 900+ client / 200+ appointment history: `babun cli import --json dump.json --tenant airfix`.

## Guardrails (mandatory before we merge the first migration)

- [ ] Automated test asserts that `select * from clients` with tenant-A JWT returns 0 rows from tenant-B's seed data. Run in CI on every PR.
- [ ] No `service_role` key anywhere under `apps/web/src/`. Grep check in CI.
- [ ] A killswitch env var `NEXT_PUBLIC_BACKEND_MODE=localStorage|shadow|supabase` lets us revert reads without a redeploy during the cutover window.
- [ ] Every Supabase query that fetches rows is wrapped by a helper that asserts `tenant_id === currentTenant` client-side as belt-and-braces. RLS is the safety net; the helper is the seatbelt.

## Sign-off

CEO approved 2026-04-21:

1. **Pool model** — `tenant_id` + RLS on shared tables. Revisit if a regulated customer appears.
2. **Offline strategy: IDB outbox + last-write-wins** for v1. CRDT deferred until multi-dispatcher per tenant is a real use-case.

STORY-001 moves to `in-progress`. Execution is phased across multiple sessions — this ADR locks the *shape* of the solution; sub-stories (001a schema, 001b auth, 001c shadow-read, 001d cutover, 001e cleanup) will carry the week-by-week work.
