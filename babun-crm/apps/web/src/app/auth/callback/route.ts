// Auth callback for Supabase email links (password recovery,
// signup confirmation, magic link). Handles two flows:
//
//   1. token_hash + type — the modern server-side OTP verification
//      flow recommended for Next.js Server Components. Email template
//      links here directly with `?token_hash={{ .TokenHash }}&type=...`.
//      Works cross-device (no PKCE verifier required).
//
//   2. code — PKCE exchange for OAuth providers. Email recovery
//      flows used to land here when the email template was the
//      default `{{ .ConfirmationURL }}` — but that path delivered
//      tokens via URL hash fragment, which can't be read server-side
//      and broke updateUser() afterwards. Migrated to (1) in
//      STORY-040 hotfix; this branch stays for OAuth.
//
// Either branch sets the auth cookie via @supabase/ssr's setAll
// adapter and then redirects to `?next=...`.

import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get("token_hash");
  const type = req.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const code = req.nextUrl.searchParams.get("code");
  // STORY-073 — default landing is the calendar, not the clients list.
  // Calendar is the daily-driver surface; the dashboard layout will
  // bounce to /onboarding if onboarded_at is null.
  const next = req.nextUrl.searchParams.get("next") ?? "/dashboard";

  if (tokenHash && type) {
    const supabase = await getSupabaseServer();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=link_expired`, req.url),
      );
    }
    return NextResponse.redirect(new URL(next, req.url));
  }

  if (code) {
    const supabase = await getSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=link_expired`, req.url),
      );
    }
    return NextResponse.redirect(new URL(next, req.url));
  }

  // Neither token_hash nor code — this URL was hit without the
  // expected query params. Send the user back to login.
  return NextResponse.redirect(new URL("/login?error=link_invalid", req.url));
}
