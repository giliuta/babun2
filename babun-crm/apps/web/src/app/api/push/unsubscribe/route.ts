// STORY-053b — POST /api/push/unsubscribe.
//
// Body: { endpoint }
// Auth: required.
// Behaviour: delete the matching row in public.push_subscriptions.
// RLS guarantees the user can only delete their own subscriptions, so
// even if a caller sends another user's endpoint it will not affect them.

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/lib/http/csrf";

interface UnsubscribeBody {
  endpoint?: unknown;
}

export async function POST(req: Request) {
  // STORY-080 — same-origin guard. CSRF-driven unsubscribe blocks
  // notifications without the user's consent.
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

  let body: UnsubscribeBody;
  try {
    body = (await req.json()) as UnsubscribeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }

  const { error: deleteErr } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (deleteErr) {
    return NextResponse.json(
      { error: `unsubscribe failed: ${deleteErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
