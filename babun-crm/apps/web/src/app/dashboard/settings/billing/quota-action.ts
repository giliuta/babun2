"use server";

// STORY-052 G6 — public read for tenant quota state.
//
// Unlike the Owner-only billing actions in actions.ts, this server
// action is reachable by ANY authenticated tenant member: every
// role's create-flow needs to surface the limit. The server action
// re-resolves tenant_id + membership server-side; the response
// shape is intentionally flat for cheap client consumption.
//
// Returns the same fields surfaced on the billing Settings page so
// hooks and pages can share types via @/components/settings/billing/types.

import { getSupabaseServer } from "@/lib/supabase/server";
import type {
  EffectivePlan,
  QuotaSummary,
  UsageCounts,
} from "@/components/settings/billing/types";

export interface QuotaSnapshot {
  plan: EffectivePlan;
  quotas: QuotaSummary;
  usage: UsageCounts;
}

export type QuotaSnapshotResult =
  | { ok: true; data: QuotaSnapshot }
  | { ok: false; error: string };

export async function getTenantQuotaSummary(): Promise<QuotaSnapshotResult> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const jwtTenantId = (user.app_metadata as { tenant_id?: string } | undefined)
    ?.tenant_id;
  let tenantId = jwtTenantId ?? null;
  if (!tenantId) {
    const { data: m } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    tenantId = m?.tenant_id ?? null;
  }
  if (!tenantId) return { ok: false, error: "tenant_missing" };

  // Membership check — tenant_members SELECT policy already restricts
  // cross-tenant reads, but be explicit so the typed error path fires
  // before we count.
  const { data: membership } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!membership) return { ok: false, error: "not_a_member" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: tenantRow } = await sb
    .from("tenants")
    .select("plan, plan_override")
    .eq("id", tenantId)
    .maybeSingle();
  const plan: EffectivePlan = (tenantRow?.plan_override ??
    tenantRow?.plan ??
    "free") as EffectivePlan;

  const { data: quotaJson } = await sb.rpc("tenant_quota_summary", {
    t_id: tenantId,
  });
  const quotas: QuotaSummary = {
    clients: 100,
    appointments_month: 50,
    team_members: 1,
    sms_month: 10,
    ...((quotaJson as Partial<QuotaSummary>) ?? {}),
  };

  const monthStart = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
  ).toISOString();
  const [
    { count: clientsCount },
    { count: apptCount },
    { count: membersCount },
    { count: invitesCount },
    { count: smsCount },
  ] = await Promise.all([
    sb
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    sb
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", monthStart),
    sb
      .from("tenant_members")
      .select("user_id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    sb
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString()),
    sb
      .from("sms_messages")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", monthStart),
  ]);

  const usage: UsageCounts = {
    clients: clientsCount ?? 0,
    appointments_month: apptCount ?? 0,
    team_members: (membersCount ?? 0) + (invitesCount ?? 0),
    sms_month: smsCount ?? 0,
  };

  return { ok: true, data: { plan, quotas, usage } };
}
