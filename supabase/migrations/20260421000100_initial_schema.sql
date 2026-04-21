-- ADR-001 Supabase backend — initial schema.
--
-- Pool model: shared tables, `tenant_id` column, RLS enforces isolation.
-- Each tenant is one Babun customer (AirFix is tenant #1). Every row in
-- a business table carries `tenant_id`, and RLS (next migration) forbids
-- cross-tenant reads/writes via the `auth.tenant_id()` helper.
--
-- Types that are inherently nested (client locations, phones, equipment,
-- per-line service pricing, photo blobs, payment breakdown) are stored
-- as `jsonb`. They are tenant-local by construction (living inside a row
-- that already has tenant_id) so RLS doesn't need to walk into them.
--
-- Money columns use `numeric(12,2)` — enough to represent every HVAC
-- invoice we could plausibly see without floating-point drift.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ─── Tenants + users ──────────────────────────────────────────────────

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug citext unique not null,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

-- Extends auth.users with tenant membership + in-app role.
-- Babun tenant is single-owner today; the `role` column is forward-
-- looking for brigade-lead / helper accounts when multi-user lands.
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email citext not null,
  full_name text,
  role text not null default 'owner' check (role in ('owner','admin','dispatcher','lead','helper')),
  created_at timestamptz not null default now()
);

create index users_tenant_idx on public.users(tenant_id);

-- ─── Teams + masters ──────────────────────────────────────────────────

create table public.masters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  full_name text not null,
  phone text,
  avatar_url text,
  team_id uuid,
  role text not null default 'helper' check (role in ('admin','dispatcher','lead','helper')),
  is_active boolean not null default true,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index masters_tenant_idx on public.masters(tenant_id);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  region text,
  color text not null default '#3b82f6',
  default_city text,
  lead_id uuid references public.masters(id) on delete set null,
  helper_ids uuid[] not null default '{}',
  payout_percentage numeric(5,2) not null default 30,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index teams_tenant_idx on public.teams(tenant_id);

-- masters.team_id closes the cycle, added after teams exists.
alter table public.masters
  add constraint masters_team_fk foreign key (team_id) references public.teams(id) on delete set null;

create table public.team_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  schedule jsonb not null,
  created_at timestamptz not null default now(),
  unique (team_id)
);

create index team_schedules_tenant_idx on public.team_schedules(tenant_id);

-- ─── Clients ──────────────────────────────────────────────────────────

create table public.client_tags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create index client_tags_tenant_idx on public.client_tags(tenant_id);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  full_name text not null,
  phone text,
  phones jsonb not null default '[]'::jsonb,
  whatsapp_phone text,
  email citext,
  sms_name text,
  telegram_username text,
  instagram_username text,

  balance numeric(12,2) not null default 0,
  discount int not null default 0 check (discount between 0 and 100),

  comment text,
  tag_ids uuid[] not null default '{}',
  acquisition_source text not null default 'unknown',
  referred_by_client_id uuid references public.clients(id) on delete set null,
  first_contact_date date,

  address text,
  city text,
  property_type text,
  equipment jsonb not null default '[]'::jsonb,
  locations jsonb not null default '[]'::jsonb,

  notes jsonb not null default '[]'::jsonb,
  birthday date,
  blacklisted boolean not null default false,

  created_at timestamptz not null default now()
);

create index clients_tenant_idx on public.clients(tenant_id);
create index clients_tenant_phone_idx on public.clients(tenant_id, phone);
create index clients_tenant_name_idx on public.clients(tenant_id, full_name);

-- ─── Services ─────────────────────────────────────────────────────────

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  color text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create index service_categories_tenant_idx on public.service_categories(tenant_id);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category_id uuid references public.service_categories(id) on delete set null,
  name text not null,
  duration_minutes int not null,
  price numeric(12,2) not null,
  color text,
  available_weekdays int[] not null default '{}',
  online_enabled boolean not null default true,
  material_costs jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  bulk_threshold int not null default 0,
  bulk_price numeric(12,2) not null default 0,
  cost_per_unit numeric(12,2) not null default 0,
  is_countable boolean not null default true,
  brigade_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index services_tenant_idx on public.services(tenant_id);
create index services_tenant_active_idx on public.services(tenant_id, is_active);

-- ─── Appointments ─────────────────────────────────────────────────────

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  client_id uuid references public.clients(id) on delete set null,
  location_id text,
  team_id uuid references public.teams(id) on delete set null,
  service_ids uuid[] not null default '{}',

  date date not null,
  time_start time not null,
  time_end time not null,

  total_amount numeric(12,2) not null default 0,
  custom_total boolean not null default false,
  discount_amount numeric(12,2) not null default 0,
  prepaid_amount numeric(12,2) not null default 0,
  services jsonb not null default '[]'::jsonb,
  global_discount jsonb,
  service_price_overrides jsonb not null default '{}'::jsonb,
  expenses jsonb not null default '[]'::jsonb,
  payments jsonb not null default '[]'::jsonb,
  payment jsonb,
  total_duration int not null default 0,
  color_override text,

  comment text,
  address text,
  address_note text,
  address_lat numeric,
  address_lng numeric,

  source text,
  is_online_booking boolean not null default false,
  kind text not null default 'work' check (kind in ('work','event','personal')),
  status text not null default 'scheduled' check (status in ('scheduled','in_progress','completed','cancelled')),

  photos jsonb not null default '[]'::jsonb,
  consent_given boolean not null default true,

  reminder_enabled boolean not null default false,
  reminder_offsets int[] not null default '{1440,60}',
  reminder_template text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointments_tenant_date_idx on public.appointments(tenant_id, date);
create index appointments_client_idx on public.appointments(client_id);
create index appointments_tenant_status_idx on public.appointments(tenant_id, status);

-- ─── Misc tenant-scoped settings ──────────────────────────────────────

create table public.sms_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null,
  name text not null,
  body text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index sms_templates_tenant_idx on public.sms_templates(tenant_id);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  icon text,
  color text,
  created_at timestamptz not null default now()
);

create index expense_categories_tenant_idx on public.expense_categories(tenant_id);

-- Expenses / payouts / day-extras / day-cities that the app stores
-- today as loosely-typed localStorage records. One table, `kind`
-- column disambiguates. Keeps the initial migration small; split later
-- if one kind outgrows the pattern.
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null check (kind in ('expense','payment','payout','day_extra','day_city')),
  team_id uuid references public.teams(id) on delete set null,
  date date not null,
  amount numeric(12,2) not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index ledger_tenant_kind_date_idx on public.ledger_entries(tenant_id, kind, date);

-- ─── Update triggers ──────────────────────────────────────────────────
-- Keep updated_at fresh on appointments without relying on the client.

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();
