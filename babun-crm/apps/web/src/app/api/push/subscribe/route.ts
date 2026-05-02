// STORY-053b — POST /api/push/subscribe.
//
// Body: { endpoint, keys: { p256dh, auth }, deviceLabel }
// Auth: required (cookie-based via getSupabaseServer).
// Behaviour: upsert one row in public.push_subscriptions per
// (user_id, endpoint). Idempotent — re-subscribing with the same
// endpoint is a no-op.
//
// We resolve tenant_id server-side from the caller's JWT (jwt
// app_metadata.tenant_id) or the first tenant_members row, never
// trusting whatever the client sends.

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

interface SubscribeBody {
  endpoint?: unknown;
  keys?: unknown;
  deviceLabel?: unknown;
}

export async function POST(req: Request) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SubscribeBody;
  try {
    body = (await req.json()) as SubscribeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  if (!endpoint || !endpoint.startsWith("http")) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }

  if (typeof body.keys !== "object" || body.keys === null) {
    return NextResponse.json({ error: "keys required" }, { status: 400 });
  }
  const keys = body.keys as Record<string, unknown>;
  if (typeof keys.p256dh !== "string" || typeof keys.auth !== "string") {
    return NextResponse.json(
      { error: "keys.p256dh and keys.auth required as strings" },
      { status: 400 },
    );
  }

  const deviceLabel =
    typeof body.deviceLabel === "string" && body.deviceLabel.length > 0
      ? body.deviceLabel.slice(0, 60)
      : null;

  // Resolve tenant from JWT or first membership.
  const jwtTenantId = (user.app_metadata as { tenant_id?: string } | undefined)
    ?.tenant_id;
  let tenantId: string | null = jwtTenantId ?? null;
  if (!tenantId) {
    const { data: membership } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    tenantId = membership?.tenant_id ?? null;
  }
  if (!tenantId) {
    return NextResponse.json({ error: "tenant_missing" }, { status: 400 });
  }

  // Idempotent upsert by (user_id, endpoint). On conflict do nothing —
  // a re-subscribe with the same endpoint is a no-op. If the browser
  // refreshed its endpoint, the old row stays until /unsubscribe deletes
  // it; the new one inserts cleanly because (user_id, endpoint) differs.
  //
  // The cast bypasses the generated `database.types.ts` not knowing
  // about `push_subscriptions` yet — types regenerate on the next
  // `npm run db:types` and this cast can be removed then.
  const row = {
    tenant_id: tenantId,
    user_id: user.id,
    endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
    device_label: deviceLabel,
  };
  const { error: insertErr } = await (supabase.from("push_subscriptions") as unknown as {
    upsert: (
      values: typeof row,
      options: { onConflict: string; ignoreDuplicates: boolean },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(row, { onConflict: "user_id,endpoint", ignoreDuplicates: true });

  if (insertErr) {
    return NextResponse.json(
      { error: `subscribe failed: ${insertErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
