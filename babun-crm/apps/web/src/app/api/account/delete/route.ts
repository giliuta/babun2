// STORY-041 G4 + STORY-039 update — Account self-delete endpoint.
//
// Flow under the new RBAC layer:
//   1. Authenticate the caller via the user-scoped server client
//      (cookies → getUser). Reject anonymous calls.
//   2. List the tenants where this user is a member; for each tenant
//      where they are the LAST owner (no other 'owner' rows), DELETE
//      the tenant via service-role. The tenants → clients/appointments/
//      ... cascade fans out automatically. Memberships in other-people's
//      tenants are not touched here — auth.users delete cascades them.
//   3. Use service-role to drop the auth.users row last; this cascades
//      every remaining tenant_members row owned by this user.
//
// The `protect_last_owner` trigger has a "remove last owner" guard,
// which would normally block step 3's cascade. We side-step it by
// deleting the entire tenant first (step 2) for last-owner cases, so
// by the time auth.users delete cascades, there's no tenant left for
// those rows to violate the invariant on. For non-last-owner tenants,
// the user just leaves silently (count of remaining owners ≥ 1).

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseService } from "@/lib/supabase/service";
import { isSameOriginRequest } from "@/lib/http/csrf";

export async function POST(req: Request) {
  // STORY-079 — same-origin guard so a cross-site form POST can't
  // nuke the user's account through cookie-CSRF.
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = await getSupabaseServer();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  // Find every tenant where this user holds the 'owner' role.
  const { data: ownerships, error: ownErr } = await service
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("role", "owner");
  if (ownErr) {
    return NextResponse.json(
      { error: `tenant_members lookup: ${ownErr.message}` },
      { status: 500 },
    );
  }

  for (const row of ownerships ?? []) {
    const tenantId = row.tenant_id;
    const { count, error: countErr } = await service
      .from("tenant_members")
      .select("user_id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("role", "owner");
    if (countErr) {
      return NextResponse.json(
        { error: `owner count for ${tenantId}: ${countErr.message}` },
        { status: 500 },
      );
    }
    if ((count ?? 0) <= 1) {
      // Last owner — drop the tenant entirely. FK cascades from tenants
      // wipe clients / appointments / settings / memberships.
      const { error: tenantDelErr } = await service
        .from("tenants")
        .delete()
        .eq("id", tenantId);
      if (tenantDelErr) {
        return NextResponse.json(
          { error: `tenants ${tenantId}: ${tenantDelErr.message}` },
          { status: 500 },
        );
      }
    }
    // Non-last-owner tenants: leave the tenant alive; the auth.users
    // cascade below removes only this user's tenant_members row.
  }

  const { error: userDelErr } = await service.auth.admin.deleteUser(user.id);
  if (userDelErr) {
    return NextResponse.json(
      { error: `auth.users: ${userDelErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
