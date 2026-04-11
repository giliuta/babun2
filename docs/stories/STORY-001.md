# STORY-001 — Supabase migration

**Status:** `todo`
**Estimate:** 8 (large — may split into sub-stories)
**Dependencies:** none
**Assignee:** Artem + Claude

## User story

> **As** the AirFix admin
> **I want** my clients, appointments, and schedules stored in a real database
> **So that** I can access the same data from multiple devices, never lose it to a cleared browser cache, and prepare for selling Babun to other service businesses.

## Why now

- Current state: everything in localStorage. Clear browser → everything gone.
- Brother (dispatcher) and two brigades need shared data — currently impossible.
- SaaS requires multi-tenant data model. Doing it now, before more code depends on flat localStorage, is cheaper than later.
- Supabase gives auth, realtime, storage, and RLS in one package — no other backend needed for Phase 1.

## Acceptance Criteria

1. ✅ A user can sign up with email/password → a new `tenant` row is created → they become the `owner` user
2. ✅ All existing localStorage entities are represented as Postgres tables with `tenant_id`
3. ✅ RLS policies prevent a user from seeing/modifying another tenant's data (verified by test)
4. ✅ The dashboard UI reads/writes from Supabase instead of localStorage — no user-facing changes, same UX
5. ✅ When offline, UI still works with cached state; changes sync when online
6. ✅ There is a migration script that imports an existing localStorage JSON dump into the user's tenant
7. ✅ RLS bypass via service role key is disabled in client bundle
8. ✅ Login page from `src/app/login/` actually authenticates

## Technical Plan

### 1. Supabase project setup
- Create Supabase project in EU region (closest to Cyprus)
- Copy anon + service role keys to `.env.local`
- Link local CLI: `npx supabase link --project-ref {id}`

### 2. Schema — create migrations in `supabase/migrations/`

```sql
-- 001_initial.sql

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text default 'free',
  created_at timestamptz default now()
);

create table users (
  id uuid primary key references auth.users,
  tenant_id uuid not null references tenants(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'member' check (role in ('owner','admin','dispatcher','lead','helper')),
  created_at timestamptz default now()
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  region text,
  color text default '#3b82f6',
  lead_id uuid references users(id),
  helper_ids uuid[] default '{}',
  active boolean default true,
  created_at timestamptz default now()
);

create table client_tags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  color text not null
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  full_name text not null,
  phone text,
  sms_name text,
  balance numeric default 0,
  discount int default 0 check (discount between 0 and 100),
  comment text,
  tag_ids uuid[] default '{}',
  acquisition_source text default 'unknown',
  referred_by_client_id uuid references clients(id) on delete set null,
  first_contact_date date,
  address text,
  city text,
  created_at timestamptz default now()
);

create index clients_tenant_idx on clients(tenant_id);
create index clients_phone_idx on clients(phone);

create table service_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  color text
);

create table services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  category_id uuid references service_categories(id),
  name text not null,
  duration_minutes int not null,
  price numeric not null,
  color text,
  available_weekdays int[] default '{}',
  online_enabled boolean default true,
  material_costs jsonb default '[]',
  is_active boolean default true,
  created_at timestamptz default now()
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  team_id uuid references teams(id) on delete set null,
  service_ids uuid[] default '{}',
  date date not null,
  time_start time not null,
  time_end time not null,
  total_amount numeric default 0,
  custom_total boolean default false,
  prepaid_amount numeric default 0,
  payments jsonb default '[]',
  status text default 'scheduled' check (status in ('scheduled','in_progress','completed','cancelled')),
  kind text default 'work' check (kind in ('work','event','personal')),
  is_online_booking boolean default false,
  photos jsonb default '[]',
  comment text,
  address text,
  address_lat numeric,
  address_lng numeric,
  source text,
  reminder_enabled boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index appointments_tenant_date_idx on appointments(tenant_id, date);
create index appointments_client_idx on appointments(client_id);

create table team_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  schedule jsonb not null,  -- { start, end, breaks, overrides }
  unique (team_id)
);

create table sms_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  kind text not null,
  name text not null,
  body text not null,
  enabled boolean default true
);

create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  icon text,
  color text
);
```

### 2b. RLS policies (`002_rls.sql`)

```sql
-- Enable RLS on every tenant-scoped table
alter table tenants enable row level security;
alter table users enable row level security;
alter table teams enable row level security;
alter table clients enable row level security;
alter table client_tags enable row level security;
alter table services enable row level security;
alter table service_categories enable row level security;
alter table appointments enable row level security;
alter table team_schedules enable row level security;
alter table sms_templates enable row level security;
alter table expense_categories enable row level security;

-- Helper function: current user's tenant_id from users table
create or replace function auth.tenant_id() returns uuid as $$
  select tenant_id from users where id = auth.uid() limit 1;
$$ language sql stable;

-- Template policy (repeat for each table that has tenant_id)
create policy "tenant isolation select" on clients
  for select using (tenant_id = auth.tenant_id());
create policy "tenant isolation insert" on clients
  for insert with check (tenant_id = auth.tenant_id());
create policy "tenant isolation update" on clients
  for update using (tenant_id = auth.tenant_id());
create policy "tenant isolation delete" on clients
  for delete using (tenant_id = auth.tenant_id());

-- ... repeat for teams, services, appointments, etc.

-- tenants table: owner-only
create policy "owner read own tenant" on tenants
  for select using (id = auth.tenant_id());
```

### 3. Client library
- `src/lib/supabase/client.ts` — browser client using `createBrowserClient`
- `src/lib/supabase/server.ts` — server client using `createServerClient`
- `src/lib/supabase/middleware.ts` — Next 16 middleware for session refresh
- `middleware.ts` in app root — calls the helper

### 4. Refactor lib/*.ts data layers
For each existing file (`appointments.ts`, `clients.ts`, `services.ts`, `schedule.ts`, `masters.ts`, `sms-templates.ts`, `expense-categories.ts`):

- Keep the TypeScript interfaces unchanged
- Replace `load{X}()` and `save{X}()` with Supabase queries
- Add `useLiveAppointments()` etc. hooks that subscribe to realtime
- Keep localStorage as offline cache layer (optional, phase 2)

### 5. Auth
- `src/app/login/page.tsx` — wire up magic link flow
- `src/app/signup/page.tsx` — new page: email + company name → create tenant + user
- `middleware.ts` — redirect unauthenticated users to /login
- `src/app/dashboard/layout.tsx` — read user, pass tenant_id to providers if needed

### 6. Migration / import tool
- `scripts/import-localstorage-dump.ts` — reads a JSON file, inserts via service role key
- UI at `/dashboard/settings/import` — paste JSON → preview → confirm → import into own tenant

### 7. Tests (first test infrastructure!)
- Install `vitest` + `@testing-library/react`
- `tests/rls.test.ts` — create 2 tenants, assert isolation
- `tests/lib/appointments.test.ts` — basic CRUD
- Update `package.json` with `"test": "vitest"` and `"test:run": "vitest run"`
- Add `/test` command to actually run them

### 8. Deploy
- Add Supabase env vars to Vercel
- Deploy migration to staging project first
- Smoke-test UI with 1 fake user
- Deploy migration to prod Supabase
- Merge to `master`, Vercel auto-deploys

## Files touched

| Action | Path |
|---|---|
| Create | `supabase/migrations/001_initial.sql` |
| Create | `supabase/migrations/002_rls.sql` |
| Create | `babun-crm/apps/web/src/lib/supabase/client.ts` |
| Create | `babun-crm/apps/web/src/lib/supabase/server.ts` |
| Create | `babun-crm/apps/web/src/lib/supabase/middleware.ts` |
| Create | `babun-crm/apps/web/src/middleware.ts` |
| Create | `babun-crm/apps/web/src/app/signup/page.tsx` |
| Create | `scripts/import-localstorage-dump.ts` |
| Create | `tests/rls.test.ts` |
| Modify | `babun-crm/apps/web/src/lib/appointments.ts` |
| Modify | `babun-crm/apps/web/src/lib/clients.ts` |
| Modify | `babun-crm/apps/web/src/lib/services.ts` |
| Modify | `babun-crm/apps/web/src/lib/schedule.ts` |
| Modify | `babun-crm/apps/web/src/lib/masters.ts` |
| Modify | `babun-crm/apps/web/src/lib/sms-templates.ts` |
| Modify | `babun-crm/apps/web/src/lib/expense-categories.ts` |
| Modify | `babun-crm/apps/web/src/app/dashboard/layout.tsx` |
| Modify | `babun-crm/apps/web/src/app/login/page.tsx` |
| Modify | `babun-crm/apps/web/package.json` (add supabase + vitest) |

## Out of scope (defer to later stories)

- Multi-tenant UI (tenant selector, team invites) — STORY-002
- Import 903 AirFix clients from Bumpix — STORY-003
- Realtime collaboration cursors — STORY-007+
- Offline-first with IndexedDB — Phase 2 sub-story

## Risks

- **Credentials in client bundle** — verify `SUPABASE_SERVICE_ROLE_KEY` is never imported from `app/` or `components/`. Add an ESLint rule if possible.
- **RLS gaps** — every new table must have RLS enabled + policies. Test matrix.
- **Downgrade path** — if Supabase goes wrong, can we roll back to localStorage? Yes, keep the old helpers as `loadFromLocal()` fallbacks for at least 2 weeks.
- **Breaking offline PWA** — Supabase calls fail offline. Need a cache layer. Phase 2 concern.
