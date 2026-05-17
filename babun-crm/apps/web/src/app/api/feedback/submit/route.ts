// Beta #52 (CRM Core brief) — public feedback submission endpoint.
//
// POST /api/feedback/submit
// Body: { token, stars, comment? }
//
// The route is a thin wrapper around the SECURITY DEFINER RPC
// `submit_rating(p_token, p_stars, p_comment)` from migration _007.
// The RPC re-validates the token (existence + unused + non-expired),
// inserts master_ratings under the function owner's privileges, and
// the existing AFTER INSERT trigger consume_rating_token (also
// SECURITY DEFINER) marks the token used_at = now().
//
// Anonymous access — no auth required. The token IS the auth.
//
// tenant_id / master_id used to live in the request body (a legacy
// of the pre-RPC architecture where the route did the lookup
// itself). The RPC reads them directly from master_rating_tokens, so
// the client no longer needs to send them; we still accept them in
// the body for back-compat with cached clients but ignore them.

import { NextResponse } from "next/server";
import { getSupabaseAnonServer } from "@/lib/supabase/anon-server";

interface Body {
  token?: unknown;
  stars?: unknown;
  comment?: unknown;
}

function statusForCode(code: string): number {
  switch (code) {
    case "ok":
      return 200;
    case "bad_token_format":
    case "stars_out_of_range":
    case "comment_too_long":
      return 400;
    case "token_not_found":
      return 404;
    case "token_already_used":
    case "token_expired":
      return 410;
    default:
      return 500;
  }
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const stars = typeof body.stars === "number" ? Math.round(body.stars) : 0;
  const comment =
    typeof body.comment === "string" && body.comment.trim().length > 0
      ? body.comment.trim().slice(0, 1000)
      : null;

  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }
  if (stars < 1 || stars > 5) {
    return NextResponse.json({ error: "stars_out_of_range" }, { status: 400 });
  }
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(token)) {
    return NextResponse.json({ error: "bad_token_format" }, { status: 400 });
  }

  const sb = getSupabaseAnonServer();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).rpc("submit_rating", {
    p_token: token,
    p_stars: stars,
    p_comment: comment,
  });

  if (error) {
    return NextResponse.json(
      { error: "rpc_failed", detail: error.message },
      { status: 500 },
    );
  }
  // The RPC returns a table — Supabase parses to either array or
  // first-row depending on builder; accept both.
  const row = Array.isArray(data) ? data[0] : data;
  const ok = Boolean(row?.ok);
  const code = typeof row?.code === "string" ? row.code : "unknown";

  if (ok) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: code }, { status: statusForCode(code) });
}
