-- ADR-001 Supabase backend — Row-Level Security.
--
-- Enforces tenant isolation at the database layer. The client can be
-- as buggy as it likes — Postgres won't return another tenant's rows.
--
-- Design:
--   * Every tenant-scoped table has RLS enabled.
--   * `public.tenant_id()` returns the tenant_id of the current JWT.
--   * One select / insert / update / delete policy per table that
--     equates `tenant_id` to `public.tenant_id()`.
--   * `tenants` itself is readable by any member of that tenant,
--     writable by the tenant owner only.
--   * `users` is readable within the same tenant, writable only by
--     owner (role changes).

-- ─── Helper ────────────────────────────────────────────────────────────
-- Looks up the tenant for the current authenticated user. SECURITY
-- DEFINER is critical: without it the function itself would be blocked
-- by the RLS policies it feeds into, leading to an infinite loop /
-- empty results.

create or replace function public.tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.tenant_id
  from public.users u
  where u.id = auth.uid()
  limit 1;
$$;

grant execute on function public.tenant_id() to authenticated, anon, service_role;

create or replace function public.is_tenant_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'owner'
  );
$$;

grant execute on function public.is_tenant_owner() to authenticated, anon, service_role;

-- ─── Enable RLS on every tenant-scoped table ──────────────────────────

alter table public.tenants             enable row level security;
alter table public.users               enable row level security;
alter table public.masters             enable row level security;
alter table public.teams               enable row level security;
alter table public.team_schedules      enable row level security;
alter table public.clients             enable row level security;
alter table public.client_tags         enable row level security;
alter table public.service_categories  enable row level security;
alter table public.services            enable row level security;
alter table public.appointments        enable row level security;
alter table public.sms_templates       enable row level security;
alter table public.expense_categories  enable row level security;
alter table public.ledger_entries      enable row level security;

-- ─── tenants table — owner-only ───────────────────────────────────────

create policy tenants_select_own
  on public.tenants for select
  using (id = public.tenant_id());

create policy tenants_update_owner
  on public.tenants for update
  using (id = public.tenant_id() and public.is_tenant_owner())
  with check (id = public.tenant_id() and public.is_tenant_owner());

-- No insert policy: tenants are created by the signup trigger running
-- as SECURITY DEFINER. Client code must never insert tenants directly.

-- ─── users table — members read self-tenant, owner mutates ───────────

create policy users_select_tenant
  on public.users for select
  using (tenant_id = public.tenant_id());

create policy users_update_owner
  on public.users for update
  using (tenant_id = public.tenant_id() and public.is_tenant_owner())
  with check (tenant_id = public.tenant_id() and public.is_tenant_owner());

-- ─── Generic policies (one block per table) ──────────────────────────

-- Template macro via DO block would save repetition but hurts
-- readability in migrations reviewers see often. Duplication wins.

-- masters
create policy masters_select on public.masters for select
  using (tenant_id = public.tenant_id());
create policy masters_insert on public.masters for insert
  with check (tenant_id = public.tenant_id());
create policy masters_update on public.masters for update
  using (tenant_id = public.tenant_id()) with check (tenant_id = public.tenant_id());
create policy masters_delete on public.masters for delete
  using (tenant_id = public.tenant_id());

-- teams
create policy teams_select on public.teams for select
  using (tenant_id = public.tenant_id());
create policy teams_insert on public.teams for insert
  with check (tenant_id = public.tenant_id());
create policy teams_update on public.teams for update
  using (tenant_id = public.tenant_id()) with check (tenant_id = public.tenant_id());
create policy teams_delete on public.teams for delete
  using (tenant_id = public.tenant_id());

-- team_schedules
create policy team_schedules_select on public.team_schedules for select
  using (tenant_id = public.tenant_id());
create policy team_schedules_insert on public.team_schedules for insert
  with check (tenant_id = public.tenant_id());
create policy team_schedules_update on public.team_schedules for update
  using (tenant_id = public.tenant_id()) with check (tenant_id = public.tenant_id());
create policy team_schedules_delete on public.team_schedules for delete
  using (tenant_id = public.tenant_id());

-- clients
create policy clients_select on public.clients for select
  using (tenant_id = public.tenant_id());
create policy clients_insert on public.clients for insert
  with check (tenant_id = public.tenant_id());
create policy clients_update on public.clients for update
  using (tenant_id = public.tenant_id()) with check (tenant_id = public.tenant_id());
create policy clients_delete on public.clients for delete
  using (tenant_id = public.tenant_id());

-- client_tags
create policy client_tags_select on public.client_tags for select
  using (tenant_id = public.tenant_id());
create policy client_tags_insert on public.client_tags for insert
  with check (tenant_id = public.tenant_id());
create policy client_tags_update on public.client_tags for update
  using (tenant_id = public.tenant_id()) with check (tenant_id = public.tenant_id());
create policy client_tags_delete on public.client_tags for delete
  using (tenant_id = public.tenant_id());

-- service_categories
create policy service_categories_select on public.service_categories for select
  using (tenant_id = public.tenant_id());
create policy service_categories_insert on public.service_categories for insert
  with check (tenant_id = public.tenant_id());
create policy service_categories_update on public.service_categories for update
  using (tenant_id = public.tenant_id()) with check (tenant_id = public.tenant_id());
create policy service_categories_delete on public.service_categories for delete
  using (tenant_id = public.tenant_id());

-- services
create policy services_select on public.services for select
  using (tenant_id = public.tenant_id());
create policy services_insert on public.services for insert
  with check (tenant_id = public.tenant_id());
create policy services_update on public.services for update
  using (tenant_id = public.tenant_id()) with check (tenant_id = public.tenant_id());
create policy services_delete on public.services for delete
  using (tenant_id = public.tenant_id());

-- appointments
create policy appointments_select on public.appointments for select
  using (tenant_id = public.tenant_id());
create policy appointments_insert on public.appointments for insert
  with check (tenant_id = public.tenant_id());
create policy appointments_update on public.appointments for update
  using (tenant_id = public.tenant_id()) with check (tenant_id = public.tenant_id());
create policy appointments_delete on public.appointments for delete
  using (tenant_id = public.tenant_id());

-- sms_templates
create policy sms_templates_select on public.sms_templates for select
  using (tenant_id = public.tenant_id());
create policy sms_templates_insert on public.sms_templates for insert
  with check (tenant_id = public.tenant_id());
create policy sms_templates_update on public.sms_templates for update
  using (tenant_id = public.tenant_id()) with check (tenant_id = public.tenant_id());
create policy sms_templates_delete on public.sms_templates for delete
  using (tenant_id = public.tenant_id());

-- expense_categories
create policy expense_categories_select on public.expense_categories for select
  using (tenant_id = public.tenant_id());
create policy expense_categories_insert on public.expense_categories for insert
  with check (tenant_id = public.tenant_id());
create policy expense_categories_update on public.expense_categories for update
  using (tenant_id = public.tenant_id()) with check (tenant_id = public.tenant_id());
create policy expense_categories_delete on public.expense_categories for delete
  using (tenant_id = public.tenant_id());

-- ledger_entries
create policy ledger_entries_select on public.ledger_entries for select
  using (tenant_id = public.tenant_id());
create policy ledger_entries_insert on public.ledger_entries for insert
  with check (tenant_id = public.tenant_id());
create policy ledger_entries_update on public.ledger_entries for update
  using (tenant_id = public.tenant_id()) with check (tenant_id = public.tenant_id());
create policy ledger_entries_delete on public.ledger_entries for delete
  using (tenant_id = public.tenant_id());
