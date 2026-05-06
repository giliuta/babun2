// Server-side tenant resolution, cached per request.
//
// Why this exists: DashboardLayout (and any server component nested
// inside it that also needs tenant_id) used to issue 1-3 Supabase
// queries each — auth.getUser, tenant_members, tenants. With Next 16
// App Router, every server component re-runs on each navigation, so
// repeated tenant lookups inside the same request became the dominant
// latency on slow networks ("page didn't open" syndrome).
//
// React's `cache()` deduplicates the work within a single render pass.
// Two server components in the same request that both call
// `getTenantContext()` share one set of network round-trips. Across
// different requests / navigations the cache is naturally re-evaluated,
// which is correct — auth state can change.

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

/** Resolves the active user + tenant for server components.
 *
 * Returns `null` when the user has no session or no tenant — callers
 * decide whether to redirect, render a guest shell, etc. The function
 * never throws on auth failure; it only throws on truly unexpected
 * errors (RLS misconfig, etc.) so the dev sees the bug. */
export const getTenantContext = cache(
  async (): Promise<TenantContext | null> => {
    const supabase = await getSupabaseServer();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    // Prefer the JWT-stamped tenant_id (set by the handle_new_user
    // trigger). Saves a tenant_members round-trip on the hot path.
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
