// Edge middleware — runs on Vercel's edge network before any server
// component, before any Node runtime. Sub-millisecond on the hot path.
//
// Job: short-circuit anonymous (or stale-cookied) traffic to
// /dashboard/* without paying for the full server-component render +
// Supabase round-trip. The dashboard layout still validates the
// session via Supabase on the authenticated path — middleware only
// handles "no auth cookie at all" and "cookie obviously expired".
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

  const cookies = req.cookies.getAll();

  // Supabase SSR splits big tokens across `sb-<ref>-auth-token.0`,
  // `.1` chunks. Concatenate by sorted name so we can decode the
  // assembled JWT below.
  const authParts = cookies
    .filter((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (authParts.length === 0) {
    return redirectToLogin(req, pathname);
  }

  const raw = authParts.map((c) => c.value).join("");
  const accessToken = extractAccessToken(raw);
  if (!accessToken) {
    return redirectToLogin(req, pathname);
  }

  // Decode the JWT payload (no signature check — RLS validates it for
  // real on every DB query). If the exp claim has already passed,
  // bounce to /login at the edge instead of letting the layout do
  // a wasted Supabase auth.getUser round-trip just to discover the
  // same thing.
  const claims = decodeJwtPayload(accessToken);
  if (!claims) return redirectToLogin(req, pathname);
  if (typeof claims.exp === "number" && claims.exp * 1000 < Date.now()) {
    return redirectToLogin(req, pathname);
  }

  return NextResponse.next();
}

function redirectToLogin(req: NextRequest, fromPath: string): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  // Preserve the originally-requested path so /login can bounce the
  // user back after a successful re-auth.
  url.searchParams.set("next", fromPath);
  return NextResponse.redirect(url);
}

interface JwtPayload {
  exp?: number;
  sub?: string;
}

function decodeJwtPayload(jwt: string): JwtPayload | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    // atob is available in the edge runtime (V8 isolates) and decodes
    // base64 → binary string. The binary string is then UTF-8 decoded
    // via TextDecoder for safety with non-ASCII claims (rare, but
    // possible if a future version of Supabase puts business name
    // bytes in the JWT).
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

function extractAccessToken(raw: string): string | null {
  // Cookie body shapes Supabase has used:
  //   • Plain JSON array — `["<jwt>", "<refresh>", ...]`
  //   • base64-prefixed: `base64-<base64-of-the-array>`
  // Either way, the access token is index 0 of the parsed array.
  let payload: unknown;
  try {
    if (raw.startsWith("base64-")) {
      const b64 = raw.slice("base64-".length);
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const json = new TextDecoder().decode(bytes);
      payload = JSON.parse(json);
    } else {
      payload = JSON.parse(raw);
    }
  } catch {
    return null;
  }
  if (!Array.isArray(payload) || typeof payload[0] !== "string") return null;
  return payload[0];
}

export const config = {
  // Match the dashboard tree. Everything else (login, register, public
  // landing, _next/*, /api/*) skips the middleware entirely.
  matcher: ["/dashboard/:path*"],
};
