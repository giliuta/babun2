// STORY-041 G4 — Account self-delete endpoint.
//
// Flow:
//   1. Authenticate the caller via the user-scoped server client
//      (cookies → getUser). Reject anonymous calls.
//   2. Use the user-scoped client (RLS-enforced) to drop tenant data:
//      client_tag_assignments → client_tags → clients → tenants. The
//      RLS policies guarantee these only touch the caller's tenant.
//   3. Use the service-role client to drop the auth.users row last —
//      RLS doesn't apply to auth schema, and only service role can
//      delete auth users.
//
// If step 2 fails partway through we leave a half-deleted tenant
// in the DB and the auth row alive — the user can retry. Step 3
// failure is the worst case (data gone, auth alive); the orphan
// backfill migration covers that scenario as a safety net.

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseService } from "@/lib/supabase/service";

export async function POST() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve the tenant id once so all DELETEs target the same row.
  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (tenantErr) {
    return NextResponse.json(
      { error: `tenant lookup: ${tenantErr.message}` },
      { status: 500 },
    );
  }

  if (tenant) {
    const tenantId = tenant.id;
    const cleanups: Array<{ table: "client_tag_assignments" | "client_tags" | "clients" }> = [
      { table: "client_tag_assignments" },
      { table: "client_tags" },
      { table: "clients" },
    ];
    for (const { table } of cleanups) {
      const { error } = await supabase.from(table).delete().eq("tenant_id", tenantId);
      if (error) {
        return NextResponse.json(
          { error: `${table}: ${error.message}` },
          { status: 500 },
        );
      }
    }

    const { error: tenantDelErr } = await supabase
      .from("tenants")
      .delete()
      .eq("id", tenantId);
    if (tenantDelErr) {
      return NextResponse.json(
        { error: `tenants: ${tenantDelErr.message}` },
        { status: 500 },
      );
    }
  }

  try {
    const service = getSupabaseService();
    const { error: userDelErr } = await service.auth.admin.deleteUser(user.id);
    if (userDelErr) {
      return NextResponse.json(
        { error: `auth.users: ${userDelErr.message}` },
        { status: 500 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "service role unavailable" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
