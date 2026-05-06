// Server-side tenant resolution, deduplicated per-request via React's
// `cache()` so child server components inside a single render share
// one set of network round-trips.
//
// Earlier we tried two extra optimisations that backfired:
//
//   • Fast-path JWT decode (read tenant_id from the cookie ourselves,
//     skip auth.getUser). Worked when access_token was fresh; broke
//     when it had expired and refresh_token was still valid, because
//     the cookie body shape from the @supabase/ssr refresh path
//     wasn't the same as the original sign-in cookie. Result: edge
//     refused valid sessions, loop with /login.
//   • `unstable_cache` (60s) on the tenants row. Worked when
//     onboarded_at was non-null; if the row was cached with a NULL
//     onboarded_at (legitimately, during the gap between sign-up and
//     onboarding completion) and the user finished onboarding, the
//     cache wouldn't see the new value until either the TTL expired
//     or `updateTag` ran. Layout would redirect to /onboarding;
//     /onboarding queries the DB directly, sees onboarded_at IS set,
//     bounces back to /dashboard; loop.
//
// So we're back to the boring shape: every navigation through
// /dashboard/* makes one auth round-trip and (if not stamped on JWT)
// one tenants round-trip. The big perf wins remained:
//   • Edge middleware short-circuits anonymous traffic.
//   • SW serves cached HTML instantly (stale-while-revalidate).
//   • Code-splitting cut initial JS payload sharply.
//   • DB bloat on the tenants/appointments tables is now actually
//     reclaimed by tightened autovacuum settings.

import { cache } from "react";
import { getSupabaseServer } from "./server";

export interface TenantContext {
  userId: string;
  userEmail: string;
  emailConfirmed: boolean;
  tenantId: string;
  tenantName: string;
  onboardedAt: string | null;
}

export const getTenantContext = cache(
  async (): Promise<TenantContext | null> => {
    const supabase = await getSupabaseServer();

    // getUser validates the JWT against Supabase Auth and refreshes
    // the access_token via the refresh_token when needed. This is the
    // only place that does refresh correctly — anything else (raw
    // cookie decode, JWT exp parse) misses the refresh and produces
    // false-negative "expired" results.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    // Prefer the JWT-stamped tenant_id (set by handle_new_user trigger).
    // Saves a tenant_members round-trip.
    const jwtTenantId = (user.app_metadata as { tenant_id?: string } | undefined)
      ?.tenant_id;
    let activeTenantId = jwtTenantId ?? null;
    if (!activeTenantId) {
      const { data: membership } = await supabase
        .from("tenant_members")
        .select("tenant_id")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      activeTenantId = membership?.tenant_id ?? null;
    }
    if (!activeTenantId) return null;

    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("id, name, onboarded_at")
      .eq("id", activeTenantId)
      .maybeSingle();
    if (error || !tenant) return null;

    return {
      userId: user.id,
      userEmail: user.email ?? "",
      emailConfirmed: Boolean(user.email_confirmed_at),
      tenantId: tenant.id,
      tenantName: tenant.name,
      onboardedAt: tenant.onboarded_at ?? null,
    };
  },
);
