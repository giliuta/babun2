# RLS Audit — Babun production schema

Generated during autopilot Phase 4. Source of truth: migrations in `babun-crm/apps/web/supabase/migrations/` (the **apps/web** dir is the canonical production schema; `babun-crm/supabase/migrations/001_initial_schema.sql` is the pre-multi-tenant draft and is *not* applied to prod — see D-013).

## Helper function: `public.current_tenant_id()`

**Status:** ✅ Already exists (created by `20260429_001_rls_policies.sql` — STORY-038). **Do not recreate.**

Existing signature (uuid, not text):

```sql
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(((auth.jwt() -> 'app_metadata') ->> 'tenant_id'), '')::uuid,
    (select id from public.tenants where owner_user_id = auth.uid() limit 1)
  );
$$;
```

Differences from plan §8.1:
- Returns `uuid`, plan template suggested `text`. **uuid is correct** — every `tenant_id` column in this schema is `uuid references public.tenants(id) on delete cascade`. Logged as D-012.
- Adds a DB fallback that queries `public.tenants` by `auth.uid()` — covers the fresh-signup race where the JWT predates the `handle_new_user` trigger's `app_metadata` stamp.
- Granted to **anon** as well as authenticated (plan template grants only authenticated). Required because the app uses the publishable-key client which authenticates as `anon` until a session exists. Anon callers see `NULL` and RLS strips all rows.

**No migration to apply.** CLAUDE.md correspondingly says `tenant_id uuid not null references public.tenants(id)`.

## Table-by-table RLS status

22 tables defined in apps/web migrations. All 22 have RLS enabled. Coverage is mature; the autopilot setup did not need to add policies.

| Table | RLS on | Policies | Tenant scoping | Cross-tenant probe path |
|---|---|---|---|---|
| `tenants` | ✅ | `tenants_select_own`, `tenants_update_own`, plus service-role | `id = current_tenant_id()` | `e2e/security/rls/tenants-cross-tenant.spec.ts` |
| `clients` | ✅ | `clients_all_own`, `clients_select_member`, `clients_insert_owner_or_dispatcher`, `clients_update_owner_or_dispatcher`, `clients_delete_owner`, `clients_service_role_select` | `tenant_id = current_tenant_id()` plus member/role checks | `e2e/security/rls/clients-cross-tenant.spec.ts` ✓ (template created) |
| `client_tags` | ✅ | `client_tags_all_own`, `client_tags_modify_owner_or_dispatcher`, `client_tags_select_member` | `tenant_id = current_tenant_id()` | `e2e/security/rls/client_tags-cross-tenant.spec.ts` |
| `client_tag_assignments` | ✅ | `client_tag_assignments_all_own`, `client_tag_assignments_modify_owner_or_dispatcher`, `client_tag_assignments_select_member` | `tenant_id = current_tenant_id()` (denormalized) | `e2e/security/rls/client_tag_assignments-cross-tenant.spec.ts` |
| `appointments` | ✅ | `appointments_all_own`, `appointments_select_member`, `appointments_insert_owner_or_dispatcher`, `appointments_update_member`, `appointments_delete_owner_or_dispatcher`, `appointments_service_role_select` | `tenant_id = current_tenant_id()` + member/role checks | `e2e/security/rls/appointments-cross-tenant.spec.ts` |
| `appointment_photos` | ✅ | `appointment_photos_all_member`, `appointment_photos_all_own` | `tenant_id = current_tenant_id()` | `e2e/security/rls/appointment_photos-cross-tenant.spec.ts` |
| `calendar_settings` | ✅ | `calendar_settings_all_own`, `calendar_settings_modify_owner_or_dispatcher`, `calendar_settings_select_member` | `tenant_id` is PK + matches `current_tenant_id()` | `e2e/security/rls/calendar_settings-cross-tenant.spec.ts` |
| `day_cities` | ✅ | `day_cities_all_own`, `day_cities_modify_owner_or_dispatcher`, `day_cities_select_member` | `tenant_id = current_tenant_id()` | `e2e/security/rls/day_cities-cross-tenant.spec.ts` |
| `day_extras` | ✅ | `day_extras_all_own`, `day_extras_modify_owner_or_dispatcher`, `day_extras_select_member` | `tenant_id = current_tenant_id()` | `e2e/security/rls/day_extras-cross-tenant.spec.ts` |
| `team_schedules` | ✅ | (see `20260430_005_schedule.sql`) | `tenant_id = current_tenant_id()` | `e2e/security/rls/team_schedules-cross-tenant.spec.ts` |
| `recurring_reminders` | ✅ | `recurring_reminders_all_own`, `recurring_reminders_modify_owner_or_dispatcher`, `recurring_reminders_select_member` | `tenant_id = current_tenant_id()` | `e2e/security/rls/recurring_reminders-cross-tenant.spec.ts` |
| `invitations` | ✅ | `invitations_invitee_select`, `invitations_owner_manage` | `tenant_id` (owner-managed) | `e2e/security/rls/invitations-cross-tenant.spec.ts` |
| `tenant_members` | ✅ | (member RLS via `tenant_members` itself; see `20260430_008_team_roles.sql`) | self-referential | `e2e/security/rls/tenant_members-cross-tenant.spec.ts` |
| `push_subscriptions` | ✅ | `push_subscriptions_select_own`, `push_subscriptions_insert_own`, `push_subscriptions_delete_own`, `push_subscriptions_service_role_all` | `user_id = auth.uid()` (user-scoped, not tenant-scoped) | `e2e/security/rls/push_subscriptions-cross-tenant.spec.ts` |
| `sms_messages` | ✅ | `sms_messages_tenant_select`, `sms_messages_service_role_all` | `tenant_id = current_tenant_id()` | `e2e/security/rls/sms_messages-cross-tenant.spec.ts` |
| `sms_logs` | ✅ | `sms_logs_select_member`, `sms_logs_service_role` | `tenant_id` via member check | `e2e/security/rls/sms_logs-cross-tenant.spec.ts` |
| `sms_topups` | ✅ | `sms_topups_select_owner`, `sms_topups_service_role` | `tenant_id = current_tenant_id()` (owner only) | `e2e/security/rls/sms_topups-cross-tenant.spec.ts` |
| `tenant_sms_config` | ✅ | (see `20260502_001_sms_config.sql`) | `tenant_id = current_tenant_id()` | `e2e/security/rls/tenant_sms_config-cross-tenant.spec.ts` |
| `billing_events` | ✅ | `billing_events_tenant_select`, `billing_events_service_role_all` | `tenant_id = current_tenant_id()` | `e2e/security/rls/billing_events-cross-tenant.spec.ts` |
| `app_settings` | ✅ | `app_settings_service_role_all`, `app_settings_service_role_select` | tenant-scoped via member check | `e2e/security/rls/app_settings-cross-tenant.spec.ts` |
| `admin_actions_log` | ✅ | `admin_actions_log_select_admin`, `admin_actions_log_service_role` | admin-only | (no cross-tenant test needed — admin-scoped) |
| `platform_admins` | ✅ | `platform_admins_select_admin`, `platform_admins_service_role` | admin-only | (no cross-tenant test needed) |

## Findings

### Strengths
1. **RLS is on for every public table that holds tenant data.** No naked tables found.
2. **`current_tenant_id()` is SECURITY DEFINER with `set search_path = public`** — guards against schema-shadowing.
3. **Both anon and authenticated roles are policy-covered explicitly** — closes the publishable-key gap.
4. **Composite policies**: most tables have both an "all_own" policy AND member/role-aware variants, providing defence in depth.
5. **service_role bypass policies are explicit** (`for all to service_role using(true) with check(true)`), consistent with the JWT-Signing-Keys migration that disabled legacy auto-bypass.

### Watch-outs (no migrations to apply; these are reminders for the security-auditor agent)
1. **20260427_002_disable_rls.sql** — this migration **disabled** RLS on `tenants`, `clients`, `client_tags`, `client_tag_assignments`. The very next migration (`20260429_001_rls_policies.sql`, STORY-038) re-enabled them. Any new migration that disables RLS must re-enable in the same file or in an immediately following file. The migration linter should flag any `disable row level security` without a matching `enable` within ±1 file.
2. **Cross-tenant probe coverage is currently 1 / 22 tables** (only `clients` was templated this phase). The strategist's first autopilot story should be a bulk PR adding the remaining 21 spec files — each is a 30-line copy of `clients-cross-tenant.spec.ts` with the table name swapped.
3. **`push_subscriptions` is user-scoped, not tenant-scoped** (RLS keys on `user_id = auth.uid()`). That's correct for push subscriptions, but the cross-tenant probe must verify that a user in tenant-b cannot read tenant-a's tenant_members rows that grant the same user push to both tenants — edge case worth a dedicated probe.
4. **Several policies use `member`-style checks via the `tenant_members` table** — `appointments_select_member`, `clients_select_member`, etc. These rely on `tenant_members` itself being RLS-correct (chicken-and-egg). Migration `20260430_008_team_roles.sql` sets `tenant_members` RLS; security-auditor should re-verify on any change to that file.

### Recommended next migrations (deferred to architect; do not auto-apply)
1. **Index audit migration** — add `create index if not exists` for `tenant_id` on every tenant-scoped table that doesn't already have one (RLS predicate hits this column on every row).
2. **`pg_trgm` extension** — needed by the planned client-deduplication feature (similarity on `(full_name, phone)`).
3. **Realtime publication audit** — `20260430_010_realtime_publication.sql` already adds tables to the publication; new tables must be added explicitly. The architect should include this in every story that creates a tenant-scoped table.

## Cross-tenant probe — canonical pattern

The existing template at `babun-crm/apps/web/e2e/security/rls/clients-cross-tenant.spec.ts` is the model:

```ts
test("user in tenant-A cannot read tenant-B rows", async ({ context }) => {
  const { cookies } = await context.storageState();
  const access = cookies.find((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"))!;
  const supabase = createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${JSON.parse(access.value).access_token}` } },
  });
  const { data } = await supabase.from("<table>").select("id, tenant_id").eq("tenant_id", "<other>");
  expect(data).toEqual([]);
});
```

Duplicate per table, swap `<table>` and `<other>`. Storage state is set up by `e2e/global.setup.ts` (Phase 2).

## No write actions taken
This audit is **read-only**. No migration was applied; no policy was added; no schema was altered. The autopilot Phase-4 instruction was explicit:
> "Если её нет — НЕ применяй автоматически, покажи мне миграцию и жди подтверждения."

The helper function **does exist** in prod (created by STORY-038 migration in the apps/web migrations dir), so even the optional "0001_tenant_helper.sql" template from plan §8.1 was not created — it would have been redundant + a worse implementation. Logged as D-012.
