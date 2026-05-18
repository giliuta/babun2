-- 20260518_002 — SECURITY DEFINER grant cleanup (Supabase advisor §F-AUTH-2)
--
-- 30 SECURITY DEFINER functions in the `public` schema were callable
-- by both `anon` and `authenticated` via PostgREST RPC. Each function
-- already has internal checks (is_platform_admin, current_tenant_id,
-- token validation), but the exposed RPC surface should be the minimum
-- needed to operate the app.
--
-- Categories applied below:
--
--   • Trigger-only (6 funcs) — used only via table triggers, no RPC
--     surface needed. Revoke EXECUTE from anon, authenticated, public.
--
--   • Service-role-only (2 funcs) — called from Edge Functions
--     running as service_role. Revoke EXECUTE from public roles.
--
--   • Internal RLS helpers (3 funcs) — current_tenant_id(),
--     current_user_role(), is_platform_admin(). Executed inline by
--     RLS policies under the function-owner privileges, so revoking
--     EXECUTE from caller roles does NOT break RLS. Revoke from anon,
--     authenticated, public.
--
--   • Tenant-quota + tenant_data_export (7 funcs) — called from
--     server pages with an authenticated JWT. Revoke from anon, keep
--     authenticated.
--
--   • Platform-admin (8 funcs) — called from /dashboard/admin pages.
--     Internal is_platform_admin() check gates execution. Revoke from
--     anon, keep authenticated.
--
--   • Public-facing (3 funcs) — accept_invitation, lookup_rating_token,
--     submit_rating — explicitly called from public pages (invite
--     link, rating link). Anon stays granted.
--
--   • read_tenant_sms_config_safe (1 func) — owner-only path called
--     from /dashboard/settings/sms. Revoke from anon, keep
--     authenticated; internal check restricts to current tenant owner.
--
--   • tenant_sms_summary, tenant_effective_plan — same pattern as
--     tenant_quota_*; revoke anon, keep authenticated.
--
-- After this migration the Supabase advisor will drop the 60
-- function-grant WARN lines (30 × 2 roles).

-- =====================================================================
-- A. Trigger-only functions (no RPC surface)
-- =====================================================================
revoke execute on function public._dispatch_push(text, jsonb, uuid[]) from anon, authenticated, public;
revoke execute on function public._tg_notify_inviter_invite_accepted() from anon, authenticated, public;
revoke execute on function public._tg_notify_owner_new_member() from anon, authenticated, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.set_appointment_created_by() from anon, authenticated, public;
revoke execute on function public.set_event_template_created_by() from anon, authenticated, public;

-- =====================================================================
-- B. Service-role-only (called from Edge Functions)
-- =====================================================================
revoke execute on function public.bump_sms_balance(uuid, integer) from anon, authenticated, public;

-- =====================================================================
-- C. Internal RLS helpers (called inline by policies, not via RPC)
-- =====================================================================
revoke execute on function public.current_tenant_id() from anon, authenticated, public;
revoke execute on function public.current_user_role() from anon, authenticated, public;
revoke execute on function public.is_platform_admin() from anon, authenticated, public;

-- =====================================================================
-- D. Tenant-scoped RPCs — keep authenticated, revoke anon
-- =====================================================================
revoke execute on function public.tenant_data_export() from anon, public;
revoke execute on function public.tenant_effective_plan(uuid) from anon, public;
revoke execute on function public.tenant_quota_appointments_month(uuid) from anon, public;
revoke execute on function public.tenant_quota_clients(uuid) from anon, public;
revoke execute on function public.tenant_quota_sms_month(uuid) from anon, public;
revoke execute on function public.tenant_quota_summary(uuid) from anon, public;
revoke execute on function public.tenant_quota_team_members(uuid) from anon, public;
revoke execute on function public.tenant_sms_summary() from anon, public;
revoke execute on function public.read_tenant_sms_config_safe() from anon, public;

-- =====================================================================
-- E. Platform-admin RPCs — keep authenticated (internal is_platform_admin
--    check enforces actual privilege), revoke anon
-- =====================================================================
revoke execute on function public.add_platform_admin(text) from anon, public;
revoke execute on function public.admin_billing_history(integer, integer) from anon, public;
revoke execute on function public.admin_dashboard_summary() from anon, public;
revoke execute on function public.admin_pending_senders() from anon, public;
revoke execute on function public.admin_resolve_tenant_owner_email(uuid) from anon, public;
revoke execute on function public.admin_stats_summary(integer) from anon, public;
revoke execute on function public.admin_tenant_detail(uuid) from anon, public;
revoke execute on function public.admin_tenants_list(text, text, integer, integer) from anon, public;

-- =====================================================================
-- F. Public-facing RPCs — keep anon (used from /invite/[token],
--    /feedback/[token] which are unauthenticated routes)
-- =====================================================================
-- accept_invitation(p_token), lookup_rating_token(p_token), submit_rating(...)
-- already have the grants we want; no changes here.
