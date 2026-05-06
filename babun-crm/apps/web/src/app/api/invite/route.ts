// STORY-039 G2 — Owner-side invitation endpoint.
//
// POST /api/invite { email, role } → creates a public.invitations row
// with a 192-bit URL-safe token + 7-day TTL. Returns the accept URL
// for the Owner UI to surface (copy-link button). Email delivery via
// Resend is intentionally not implemented in this story; future
// STORY-039d adds it. The token-in-URL pattern works without email.

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/lib/http/csrf";
import {
  assertQuotaAvailable,
  QuotaExceededError,
  quotaKindLabelRu,
} from "@/lib/quota/check";

// STORY-079 — restrict /api/invite to non-owner roles. Co-owner
// invitations are too high-risk to be a one-click flow (a phished
// owner click grants permanent full access including Stripe customer
// id mutation, account deletion). Owner-add is now a manual SQL
// operation by platform admin via /admin/tenants/[id].
const VALID_ROLES = new Set(["dispatcher", "master"]);

export async function POST(req: Request) {
  // STORY-079 — same-origin guard.
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

  type Body = { email?: unknown; role?: unknown };
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body.role === "string" ? body.role : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }
  if (!VALID_ROLES.has(role)) {
    return NextResponse.json(
      {
        error:
          "Role must be dispatcher or master. Co-owner invitations are not allowed via API — contact support to add a second owner.",
      },
      { status: 400 },
    );
  }

  // Resolve active tenant + verify caller is its Owner. RLS on
  // invitations would block the insert anyway, but a clean 403 is a
  // better UX than a generic database error.
  const tenantId = (user.app_metadata as { tenant_id?: string } | undefined)
    ?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: "tenant_missing" }, { status: 400 });
  }
  const { data: caller, error: callerErr } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (callerErr || !caller) {
    return NextResponse.json({ error: "Membership lookup failed" }, { status: 500 });
  }
  if (caller.role !== "owner") {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }

  // STORY-052 G4 — gate on team_members quota (active members +
  // pending invitations). Owner-friendly RU error so the Settings UI
  // can show "Достигнут лимит N членов команды на текущем тарифе"
  // without parsing.
  try {
    await assertQuotaAvailable(supabase, tenantId, "team_members");
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json(
        {
          error: "quota_exceeded",
          kind: err.kind,
          current: err.current,
          limit: err.limit,
          message: `Достигнут лимит ${err.limit} ${quotaKindLabelRu(err.kind)} на текущем тарифе.`,
        },
        { status: 402 }, // Payment Required
      );
    }
    throw err;
  }

  // 192 bits of entropy → 32 url-safe characters after base64url.
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: inv, error: insErr } = await supabase
    .from("invitations")
    .insert({
      tenant_id: tenantId,
      email,
      role,
      invited_by_user_id: user.id,
      token,
      expires_at: expiresAt,
    })
    .select("id, expires_at")
    .single();
  if (insErr || !inv) {
    return NextResponse.json(
      { error: insErr?.message ?? "insert failed" },
      { status: 500 },
    );
  }

  // Build the accept URL from the request origin so dev/prod both work.
  const origin = new URL(req.url).origin;
  const url = `${origin}/invite/${token}`;
  return NextResponse.json({
    inviteId: inv.id,
    url,
    expiresAt: inv.expires_at,
  });
}
