-- STORY-056 — Event templates for the unified EventSheet.
--
-- Custom user-authored event presets (e.g. "Йога 60 мин 🧘") that
-- show up after the 6 hard-coded SYSTEM_PRESETS in the new EventSheet.
-- Privacy is per-user (RLS via created_by = auth.uid(), not master_id —
-- there is no master_id ↔ auth.uid() mapping in this schema, see
-- STORY-055 reasoning). System presets stay hard-coded in
-- lib/eventPresets.ts and are never persisted to this table.
--
-- Mirrors STORY-055 pattern:
--   • BEFORE INSERT trigger fills created_by from auth.uid() so the TS
--     layer never has to send the column explicitly.
--   • RLS policies role-clauses match 20260430_008_team_roles.sql
--     convention (`to authenticated`).
--   • No moddatetime extension dependency — hand-rolled BEFORE UPDATE
--     trigger keeps updated_at fresh.

-- ── 1. Table ─────────────────────────────────────────────────────────
create table if not exists public.event_templates (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  name            text not null check (length(name) between 1 and 80),
  emoji           text check (emoji is null or length(emoji) <= 8),
  color           text not null,
  duration_min    int  not null check (duration_min between 5 and 1440),
  push_offset_min int  check (push_offset_min is null or push_offset_min between 0 and 1440),
  sort_order      int  not null default 0,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists event_templates_tenant_creator_sort_idx
  on public.event_templates (tenant_id, created_by, sort_order);

alter table public.event_templates enable row level security;

-- ── 2. Trigger — auto-fill created_by from auth.uid() ────────────────
create or replace function public.set_event_template_created_by()
returns trigger as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_event_templates_set_created_by on public.event_templates;
create trigger trg_event_templates_set_created_by
  before insert on public.event_templates
  for each row execute function public.set_event_template_created_by();

-- ── 3. Trigger — bump updated_at on every UPDATE ─────────────────────
-- Universal hand-rolled version. Avoids the moddatetime extension
-- dependency in case it isn't enabled on this project.
create or replace function public.touch_event_template_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_event_templates_touch_updated_at on public.event_templates;
create trigger trg_event_templates_touch_updated_at
  before update on public.event_templates
  for each row execute function public.touch_event_template_updated_at();

-- ── 4. RLS policies — per-user privacy ───────────────────────────────
-- Author can read / insert / update / delete their own templates,
-- scoped to the current tenant. No tenant-wide sharing in V1.

drop policy if exists event_templates_select on public.event_templates;
create policy event_templates_select on public.event_templates for select
  to authenticated
  using (tenant_id = public.current_tenant_id() and created_by = auth.uid());

drop policy if exists event_templates_insert on public.event_templates;
create policy event_templates_insert on public.event_templates for insert
  to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and (created_by is null or created_by = auth.uid())
  );

drop policy if exists event_templates_update on public.event_templates;
create policy event_templates_update on public.event_templates for update
  to authenticated
  using      (tenant_id = public.current_tenant_id() and created_by = auth.uid())
  with check (tenant_id = public.current_tenant_id() and created_by = auth.uid());

drop policy if exists event_templates_delete on public.event_templates;
create policy event_templates_delete on public.event_templates for delete
  to authenticated
  using (tenant_id = public.current_tenant_id() and created_by = auth.uid());

-- ── 5. Grants ────────────────────────────────────────────────────────
grant select, insert, update, delete on public.event_templates to authenticated;
