// TODO(STORY-037): remove this entire proxy after Auth is in place.
//
// Temporary HTTP Basic Auth gate for non-development environments.
// Until real Supabase Auth lands (STORY-037) and tenant RLS lands
// (STORY-038), the deployed instance is publicly readable. This
// proxy closes the front door from random visitors.
//
// Next.js 16 renamed the `middleware` file convention to `proxy`.
//
// Behaviour:
//   * NODE_ENV=development → no gate.
//   * BASIC_AUTH_HASH not set + non-development → 500 (fail closed,
//     signals deploy misconfiguration immediately).
//   * Static assets and the service worker are exempt so the lock
//     screen itself can render and the SW can update.
//   * Compares sha256(`login:password`) with BASIC_AUTH_HASH using a
//     constant-time string compare to prevent timing leaks.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PREFIXES = [
  "/_next/static",
  "/_next/image",
  "/favicon",
  "/icon.svg",
  "/manifest",
  "/sw.js",
  "/apple-icon",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function challenge(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Babun", charset="UTF-8"' },
  });
}

export async function proxy(req: NextRequest) {
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  if (isPublic(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const expected = process.env.BASIC_AUTH_HASH?.trim().toLowerCase();
  if (!expected) {
    return new NextResponse(
      "BASIC_AUTH_HASH not configured. Set it in Vercel project env vars.",
      { status: 500 },
    );
  }

  const header = req.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("basic ")) {
    return challenge();
  }

  let creds: string;
  try {
    creds = atob(header.slice(6).trim());
  } catch {
    return challenge();
  }
  if (!creds.includes(":")) {
    return challenge();
  }

  const actual = (await sha256Hex(creds)).toLowerCase();
  if (!timingSafeEqual(actual, expected)) {
    return challenge();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon|icon.svg|manifest|sw.js|apple-icon).*)",
  ],
};
