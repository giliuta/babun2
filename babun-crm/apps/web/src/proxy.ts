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

async function sha256HexBytes(bytes: Uint8Array): Promise<string> {
  // Cast: Uint8Array is a valid BufferSource at runtime; the strict
  // ArrayBufferLike vs ArrayBuffer incompatibility is a TS-only quirk.
  const buf = await crypto.subtle.digest(
    "SHA-256",
    bytes as unknown as ArrayBuffer,
  );
  const out = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < out.length; i++) {
    hex += out[i].toString(16).padStart(2, "0");
  }
  return hex;
}

// Decode the base64 part of `Basic <b64>` into the original *bytes* of
// `login:password`. We hash bytes directly — going through a JS string
// + TextEncoder would mangle non-ASCII passwords (atob returns a
// binary string whose code units are bytes, but TextEncoder UTF-8-
// encodes code points, doubling high-byte chars).
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i) & 0xff;
  return bytes;
}

// Tail diagnostics — first/last 4 chars of a hex-ish string.
function tail(s: string): string {
  if (s.length <= 8) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
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

  const expectedRaw = process.env.BASIC_AUTH_HASH;
  const expected = expectedRaw?.trim().toLowerCase();
  if (!expected) {
    console.log("[proxy] no BASIC_AUTH_HASH env var", {
      defined: typeof expectedRaw !== "undefined",
      rawLen: expectedRaw?.length ?? 0,
    });
    return new NextResponse(
      "BASIC_AUTH_HASH not configured. Set it in Vercel project env vars.",
      { status: 500 },
    );
  }

  const header = req.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("basic ")) {
    console.log("[proxy] no/wrong auth header", {
      hasHeader: header.length > 0,
      headerStart: header.slice(0, 6),
    });
    return challenge();
  }

  let credBytes: Uint8Array;
  try {
    credBytes = base64ToBytes(header.slice(6).trim());
  } catch (err) {
    console.log("[proxy] base64 decode failed", {
      msg: err instanceof Error ? err.message : String(err),
    });
    return challenge();
  }
  // Find the colon byte (0x3a) — must be exactly the format login:password.
  let colonIdx = -1;
  for (let i = 0; i < credBytes.length; i++) {
    if (credBytes[i] === 0x3a) {
      colonIdx = i;
      break;
    }
  }
  if (colonIdx <= 0 || colonIdx === credBytes.length - 1) {
    console.log("[proxy] bad creds shape", {
      bytes: credBytes.length,
      colonIdx,
    });
    return challenge();
  }

  const actual = (await sha256HexBytes(credBytes)).toLowerCase();
  const ok = timingSafeEqual(actual, expected);
  console.log("[proxy] auth check", {
    ok,
    expectedLen: expected.length,
    actualLen: actual.length,
    expectedTail: tail(expected),
    actualTail: tail(actual),
    credBytesLen: credBytes.length,
    loginLen: colonIdx,
    pwdLen: credBytes.length - colonIdx - 1,
  });
  if (!ok) {
    return challenge();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon|icon.svg|manifest|sw.js|apple-icon).*)",
  ],
};
