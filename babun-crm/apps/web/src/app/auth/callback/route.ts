// PKCE callback — Supabase redirects here after the user clicks an
// email link (password recovery, magic-link login). We exchange the
// `code` param for a real session, then forward to `?next=...`.
//
// This is a route handler (not a page), so it runs server-side and
// has access to cookies via @supabase/ssr — that's what writes the
// auth cookie back to the browser.

import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next") ?? "/dashboard/clients";

  if (code) {
    const supabase = await getSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?err=callback-failed`, req.url),
      );
    }
  }

  return NextResponse.redirect(new URL(next, req.url));
}
