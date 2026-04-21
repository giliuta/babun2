-- ADR-001 Supabase backend — signup trigger.
--
-- When a new row lands in auth.users (via GoTrue signup), create:
--   1. A fresh public.tenants row named after the user's email local-part
--      (owner can rename later under /dashboard/settings/company).
--   2. A public.users row linking auth.users.id → tenant_id with role='owner'.
--
-- Also seeds per-tenant defaults so the UI doesn't look empty on
-- first load: a handful of common client tags, AirFix-style expense
-- categories, and a default SMS template.
--
-- The trigger runs as SECURITY DEFINER so it can insert into public
-- tables that RLS would otherwise block for a freshly created user
-- whose `public.users` row does not yet exist.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_tenant_id uuid;
  local_part text;
  tenant_slug text;
begin
  local_part := split_part(new.email, '@', 1);
  tenant_slug := regexp_replace(lower(local_part), '[^a-z0-9]+', '-', 'g');
  -- Guarantee uniqueness — append short hash if a slug collides.
  if exists (select 1 from public.tenants where slug = tenant_slug) then
    tenant_slug := tenant_slug || '-' || substring(md5(new.id::text) from 1 for 6);
  end if;

  insert into public.tenants (name, slug)
  values (coalesce(local_part, 'Мой бизнес'), tenant_slug)
  returning id into new_tenant_id;

  insert into public.users (id, tenant_id, email, role)
  values (new.id, new_tenant_id, new.email, 'owner');

  -- Seed default client tags.
  insert into public.client_tags (tenant_id, name, color) values
    (new_tenant_id, 'VIP', '#f59e0b'),
    (new_tenant_id, 'Постоянный', '#10b981'),
    (new_tenant_id, 'Новый', '#3b82f6'),
    (new_tenant_id, 'Проблемный', '#ef4444');

  -- Seed default expense categories.
  insert into public.expense_categories (tenant_id, name, icon, color) values
    (new_tenant_id, 'Материалы', 'wrench', '#8b5cf6'),
    (new_tenant_id, 'Топливо', 'fuel', '#f97316'),
    (new_tenant_id, 'Реклама', 'megaphone', '#06b6d4'),
    (new_tenant_id, 'Прочее', 'ellipsis', '#64748b');

  -- Seed a default SMS reminder template.
  insert into public.sms_templates (tenant_id, kind, name, body, enabled) values
    (new_tenant_id, 'reminder', 'Напоминание за день',
     'Здравствуйте, {name}! Напоминаем: {date} в {time} по адресу {address}. Babun CRM',
     true);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
