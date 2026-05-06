// Edge middleware — runs on Vercel's edge before any server component.
//
// Job: short-circuit fully-anonymous traffic to /dashboard/*. The
// dashboard layout still validates the session via Supabase, so all
// middleware does is keep someone WITHOUT any auth cookie from
// triggering a server-component render just to bounce them.
//
// What we DO NOT do:
//   • Decode the JWT and check `exp`. We tried that in v420 and hit
//     a redirect loop on iPhone PWAs whose access_token had expired
//     but whose refresh_token was still valid: middleware kept saying
//     "expired" while /login's getUser() refreshed the token and
//     bounced back to /dashboard. Cleaner to let the layout (which
//     calls supabase.auth.getUser, the only place with proper refresh
//     semantics) make the call.
//   • Validate the JWT signature — RLS on the DB validates it on
//     every query anyway.
//   • Block /api/*. API routes do their own auth.

import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIX = "/dashboard";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith(PROTECTED_PREFIX)) {
    return NextResponse.next();
  }

  // Just check the cookie exists. Cheap at the edge, lets us redirect
  // anonymous users away from /dashboard without starting a server
  // -component render.
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
  matcher: ["/dashboard/:path*"],
};
