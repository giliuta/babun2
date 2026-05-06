// Server-side tenant resolution, optimised to ZERO Supabase round-trips
// on the hot path.
//
// Old shape (pre-v419) made 1-3 sequential Supabase queries on every
// /dashboard navigation:
//   1. supabase.auth.getUser() — ~200-500ms each network round-trip
//   2. tenant_members lookup if jwtTenantId missing — ~150-300ms
//   3. tenants name + onboarded_at lookup — ~150-300ms
// Total: 500-1100ms before the page started rendering. Even with
// React `cache()` deduplicating WITHIN a render, every navigation paid
// the bill again.
//
// New shape (v419):
//   1. Parse the Supabase auth cookie ourselves — no network call.
//      Read userId, email, email_confirmed_at, tenant_id straight from
//      the JWT app_metadata. Signature is validated by RLS on every
//      DB query anyway; trusting the cookie for routing decisions
//      buys us 0ms vs 200-500ms for getUser().
//   2. tenant name + onboarded_at fetched via `unstable_cache` with
//      a 60s TTL, keyed by tenantId. After the first fetch in a
//      minute, subsequent navigations read it from Next.js's in-memory
//      cache — 0ms.
//   3. Falls back to the old Supabase queries only when the cookie is
//      missing or malformed (logout in progress, fresh signup race).
//
// Net effect: hot-path navigations cost ~0ms of network instead of
// 500-1100ms, and the render starts almost immediately.

import { cache } from "react";
import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { getSupabaseServer } from "./server";

export interface TenantContext {
  userId: string;
  userEmail: string;
  emailConfirmed: boolean;
  tenantId: string;
  tenantName: string;
  onboardedAt: string | null;
}

interface DecodedJwt {
  sub?: string;
  email?: string;
  email_confirmed_at?: string;
  app_metadata?: { tenant_id?: string };
  user_metadata?: { email_confirmed_at?: string };
  exp?: number;
}

/** Resolves the active user + tenant for server components.
 *
 * Returns `null` when there's no usable session — callers redirect to
 * /login. Never throws on auth failure; only on truly unexpected errors
 * so the dev sees the bug. */
export const getTenantContext = cache(
  async (): Promise<TenantContext | null> => {
    // Try the fast path first — read identity straight from the cookie
    // JWT, no Supabase round-trip. Falls back to the old Supabase path
    // when the JWT is missing / malformed / expired.
    const fast = await tryFastPath();
    if (fast) return fast;
    return slowPath();
  },
);

// ── Fast path: parse Supabase auth cookie locally ────────────────

async function tryFastPath(): Promise<TenantContext | null> {
  const claims = await readJwtClaims();
  if (!claims) return null;

  const userId = claims.sub;
  const userEmail = claims.email ?? "";
  const emailConfirmed =
    Boolean(claims.email_confirmed_at) ||
    Boolean(claims.user_metadata?.email_confirmed_at);
  const tenantId = claims.app_metadata?.tenant_id;
  if (!userId || !tenantId) return null;

  const tenant = await getCachedTenant(tenantId);
  if (!tenant) return null;

  return {
    userId,
    userEmail,
    emailConfirmed,
    tenantId: tenant.id,
    tenantName: tenant.name,
    onboardedAt: tenant.onboarded_at ?? null,
  };
}

// ── Slow path: full Supabase auth + tenants query (fallback) ─────

async function slowPath(): Promise<TenantContext | null> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const jwtTenantId = (user.app_metadata as { tenant_id?: string } | undefined)
    ?.tenant_id;
  let activeTenantId = jwtTenantId ?? null;
  if (!activeTenantId) {
    const { data: membership } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    activeTenantId = membership?.tenant_id ?? null;
  }
  if (!activeTenantId) return null;

  const tenant = await getCachedTenant(activeTenantId);
  if (!tenant) return null;

  return {
    userId: user.id,
    userEmail: user.email ?? "",
    emailConfirmed: Boolean(user.email_confirmed_at),
    tenantId: tenant.id,
    tenantName: tenant.name,
    onboardedAt: tenant.onboarded_at ?? null,
  };
}

// ── Helpers ──────────────────────────────────────────────────────

async function readJwtClaims(): Promise<DecodedJwt | null> {
  let cookieStore;
  try {
    cookieStore = await cookies();
  } catch {
    return null;
  }
  const all = cookieStore.getAll();

  // Supabase SSR may split a long token into base.0 / base.1 chunks.
  // Re-assemble: collect every cookie whose name ends with -auth-token
  // or -auth-token.<n>, sort by suffix, concat values. Single-cookie
  // case is handled by the same code (just one entry).
  const authParts = all
    .filter((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (authParts.length === 0) return null;
  const raw = authParts.map((c) => c.value).join("");

  // The cookie value is a JSON-stringified array:
  //   [accessToken, refreshToken, providerToken, providerRefreshToken, user]
  // Parse and pull out the access token (index 0). When parsing fails
  // we fall through to the slow path.
  let parsed: unknown;
  try {
    // Older versions of @supabase/ssr base64-encoded the cookie body
    // and prefixed it with "base64-". Strip the prefix when present.
    const trimmed = raw.startsWith("base64-")
      ? Buffer.from(raw.slice("base64-".length), "base64").toString("utf-8")
      : raw;
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const accessToken = parsed[0];
  if (typeof accessToken !== "string") return null;

  const claims = decodeJwtPayload(accessToken);
  if (!claims) return null;

  // Bail on expired tokens — middleware already guards /dashboard for
  // missing cookies, but an expired token could slip past until the
  // browser refreshes. Slow path will see no session and redirect.
  if (claims.exp && claims.exp * 1000 < Date.now()) return null;

  return claims;
}

function decodeJwtPayload(jwt: string): DecodedJwt | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    // base64url → base64 → utf-8 → JSON
    const b64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = Buffer.from(padded, "base64").toString("utf-8");
    return JSON.parse(payload) as DecodedJwt;
  } catch {
    return null;
  }
}

interface CachedTenant {
  id: string;
  name: string;
  onboarded_at: string | null;
}

// `unstable_cache` keys by both the cache key string and any parameters.
// 60-second TTL is short enough that name/onboarded_at edits show up
// quickly, long enough that bursts of navigations within a session
// share one query result. Tagged so server actions can revalidateTag
// after writes.
const getCachedTenant = unstable_cache(
  async (tenantId: string): Promise<CachedTenant | null> => {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase
      .from("tenants")
      .select("id, name, onboarded_at")
      .eq("id", tenantId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      name: data.name,
      onboarded_at: data.onboarded_at ?? null,
    };
  },
  ["tenant-context"],
  { revalidate: 60, tags: ["tenant"] },
);
