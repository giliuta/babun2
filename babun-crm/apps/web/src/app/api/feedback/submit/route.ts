// Beta #52 (CRM Core brief) — public feedback submission endpoint.
//
// POST /api/feedback/submit
// Body: { token, tenant_id, master_id, appointment_id?, stars, comment? }
//
// The RLS policy from migration 20260517_004 already enforces that
// the token must be unused, non-expired, and match the claimed
// tenant_id + master_id. We use the service-role client here to
// have the trigger consume the token (the after-insert trigger
// runs as SECURITY DEFINER and bypasses anon read-policy on
// master_rating_tokens — but we still need an authenticated insert
// path that the policy accepts).
//
// Anonymous access — no auth required. The token IS the auth.

import { NextResponse } from "next/server";
import { getSupabaseService } from "@/lib/supabase/service";

interface Body {
  token?: unknown;
  tenant_id?: unknown;
  master_id?: unknown;
  appointment_id?: unknown;
  stars?: unknown;
  comment?: unknown;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const tenantId = typeof body.tenant_id === "string" ? body.tenant_id : "";
  const masterId = typeof body.master_id === "string" ? body.master_id : "";
  const appointmentId =
    typeof body.appointment_id === "string" ? body.appointment_id : null;
  const stars = typeof body.stars === "number" ? Math.round(body.stars) : 0;
  const comment =
    typeof body.comment === "string" && body.comment.trim().length > 0
      ? body.comment.trim().slice(0, 1000)
      : null;

  if (!token || !tenantId || !masterId) {
    return NextResponse.json(
      { error: "missing_token_or_target" },
      { status: 400 },
    );
  }
  if (stars < 1 || stars > 5) {
    return NextResponse.json({ error: "stars_out_of_range" }, { status: 400 });
  }
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(token)) {
    return NextResponse.json({ error: "bad_token_format" }, { status: 400 });
  }

  const sb = getSupabaseService();

  // Sanity check the token before insert so we can return a clean
  // 410 / 403 instead of falling through to the RLS rejection. The
  // policy still gates the actual write — this is just UX polish so
  // the error message is meaningful.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tokenRow } = await (sb as any)
    .from("master_rating_tokens")
    .select("token, used_at, expires_at, tenant_id, master_id")
    .eq("token", token)
    .maybeSingle();
  if (!tokenRow) {
    return NextResponse.json({ error: "token_not_found" }, { status: 404 });
  }
  if (tokenRow.used_at) {
    return NextResponse.json({ error: "token_already_used" }, { status: 410 });
  }
  if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "token_expired" }, { status: 410 });
  }
  if (tokenRow.tenant_id !== tenantId || tokenRow.master_id !== masterId) {
    return NextResponse.json(
      { error: "token_mismatch" },
      { status: 403 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any).from("master_ratings").insert({
    tenant_id: tenantId,
    master_id: masterId,
    appointment_id: appointmentId,
    stars,
    comment,
    token,
  });
  if (error) {
    return NextResponse.json(
      { error: "insert_failed", detail: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
