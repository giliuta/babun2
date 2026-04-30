// STORY-039 G2 — Active tenant switcher.
//
// POST /api/team/switch { tenantId } — the user is in multiple tenants
// and wants to switch the active one. Steps:
//   1. Verify caller is a member of the target tenant.
//   2. Re-stamp app_metadata.tenant_id via service-role admin API.
//   3. Refresh available_tenants from the source of truth.
// The client side calls supabase.auth.refreshSession() after a 200
// response to pick up the new claims.

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseService } from "@/lib/supabase/service";

export async function POST(req: Request) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  type Body = { tenantId?: unknown };
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const targetTenantId = typeof body.tenantId === "string" ? body.tenantId : "";
  if (!targetTenantId) {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  }

  let service;
  try {
    service = getSupabaseService();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "service role unavailable" },
      { status: 500 },
    );
  }

  // Membership check — service-role bypasses RLS so we can verify
  // the user is on the target tenant before switching.
  const { data: target, error: memErr } = await service
    .from("tenant_members")
    .select("tenant_id")
    .eq("tenant_id", targetTenantId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: "Not a member of that team" }, { status: 403 });
  }

  // Recompute the full available_tenants array (in case it drifted
  // since the last stamp). Stamp tenant_id = target.
  const { data: allMemberships, error: listErr } = await service
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id);
  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }
  const available = (allMemberships ?? []).map((m) => m.tenant_id);

  const existing = (user.app_metadata as Record<string, unknown> | undefined) ?? {};
  const { error: updErr } = await service.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...existing,
      tenant_id: targetTenantId,
      available_tenants: available,
    },
  });
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tenantId: targetTenantId, available });
}
