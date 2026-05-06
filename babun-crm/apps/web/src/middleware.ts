// Edge middleware — runs on Vercel's edge network before any server
// component, before any Node runtime. Sub-millisecond on the hot path.
//
// Job: short-circuit anonymous traffic to /dashboard/* without paying
// for the full server-component render + Supabase round-trip. The
// dashboard layout still validates the session via Supabase on the
// authenticated path — middleware only handles "no auth cookie at all".
//
// What we DO NOT do here:
//   • Validate the JWT signature — that needs the Supabase JWT secret
//     and would slow every request. RLS on the DB validates it on
//     every query anyway, so a forged cookie buys an attacker only a
//     UI shell with no data behind it.
//   • Read the tenant. Tenant resolution is in tenant-context.ts and
//     uses React `cache()` so it dedups within a request.
//   • Block /api/*. API routes do their own auth in their handlers.

import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIX = "/dashboard";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only guard /dashboard. /login, /register, /onboarding, /api, static
  // assets all pass through untouched.
  if (!pathname.startsWith(PROTECTED_PREFIX)) {
    return NextResponse.next();
  }

  // Supabase SSR sets a cookie of the form `sb-<project-ref>-auth-token`.
  // Sometimes split across multiple `.0`, `.1` chunks for big tokens.
  // Either form is fine for our purposes — we just need ANY auth cookie
  // to exist before we hand the request to the server-component layout.
  const cookies = req.cookies.getAll();
  const hasAuthCookie = cookies.some(
    (c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"),
  );

  if (!hasAuthCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Match the dashboard tree. Everything else (login, register, public
  // landing, _next/*, /api/*) skips the middleware entirely.
  matcher: ["/dashboard/:path*"],
};
