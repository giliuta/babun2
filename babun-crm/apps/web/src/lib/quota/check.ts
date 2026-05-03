// STORY-052 G4 — server-side quota guards.
//
// Single helper used by createClient + createAppointment + /api/invite
// to refuse over-quota writes BEFORE the INSERT. Returns a typed
// result; callers throw a `QuotaExceededError` so the UI can surface
// a friendly RU message instead of an opaque DB error.
//
// Quota matrix lives in Postgres (tenant_quota_* helpers from
// STORY-052 G1) — this module is the TypeScript glue that pairs the
// helper with the live count.
//
// "appointments per month" semantics: count rows whose `created_at`
// falls in the current calendar month (UTC). NOT rows whose `date`
// is in this month — that would let a tenant rotate-spam by booking
// future months and confuse the meter.
//
// "team_members" semantics: active rows in `tenant_members` PLUS
// pending rows in `invitations` (accepted_at IS NULL, expires_at >
// now()). Otherwise an Owner could invite 100 people and have them
// all accept past the quota.
//
// A direct PostgREST hit on the table (a future Edge Function with
// service-role) bypasses these checks. Logged STORY-052b backlog:
// add Postgres BEFORE INSERT triggers as the defense-in-depth layer.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@babun/shared/db/database.types";

type DbSupabase = SupabaseClient<Database>;

export type QuotaKind = "clients" | "appointments_month" | "team_members";

export class QuotaExceededError extends Error {
  readonly code = "quota_exceeded" as const;
  constructor(
    public readonly kind: QuotaKind,
    public readonly current: number,
    public readonly limit: number,
  ) {
    super(`quota_exceeded: ${kind} ${current}/${limit}`);
    this.name = "QuotaExceededError";
  }
}

/** Fetch the tenant's quota for `kind` from the SQL helpers. */
async function fetchQuota(
  supabase: DbSupabase,
  tenantId: string,
  kind: QuotaKind,
): Promise<number> {
  const fnName = (
    {
      clients: "tenant_quota_clients",
      appointments_month: "tenant_quota_appointments_month",
      team_members: "tenant_quota_team_members",
    } as const
  )[kind];
  // Cast through `any` — generated DB types haven't been regenerated
  // since STORY-052 G1 (logged in STORY-052b cleanup).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb.rpc(fnName, { t_id: tenantId });
  if (error) throw new Error(`quota lookup ${fnName}: ${error.message}`);
  return Number(data ?? 0);
}

/** Returns the live count for `kind`. */
async function fetchCount(
  supabase: DbSupabase,
  tenantId: string,
  kind: QuotaKind,
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  if (kind === "clients") {
    const { count, error } = await sb
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    if (error) throw new Error(`count clients: ${error.message}`);
    return count ?? 0;
  }

  if (kind === "appointments_month") {
    // Calendar-month boundary in UTC. Tenant timezone (Europe/Nicosia)
    // is close enough to UTC that the off-by-2-3-hours boundary
    // doesn't matter for billing accuracy — and using UTC keeps the
    // count deterministic across server regions.
    const monthStart = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
    ).toISOString();
    const { count, error } = await sb
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", monthStart);
    if (error) throw new Error(`count appointments: ${error.message}`);
    return count ?? 0;
  }

  if (kind === "team_members") {
    const { count: members, error: mErr } = await sb
      .from("tenant_members")
      .select("user_id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    if (mErr) throw new Error(`count members: ${mErr.message}`);

    const { count: pending, error: iErr } = await sb
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString());
    if (iErr) throw new Error(`count invitations: ${iErr.message}`);

    return (members ?? 0) + (pending ?? 0);
  }

  throw new Error(`unknown quota kind: ${kind as string}`);
}

/** Throws QuotaExceededError if creating ONE more row of `kind` would
 *  exceed the tenant's quota. Use BEFORE the INSERT in repo wrappers. */
export async function assertQuotaAvailable(
  supabase: DbSupabase,
  tenantId: string,
  kind: QuotaKind,
): Promise<void> {
  const [limit, current] = await Promise.all([
    fetchQuota(supabase, tenantId, kind),
    fetchCount(supabase, tenantId, kind),
  ]);
  if (current >= limit) {
    throw new QuotaExceededError(kind, current, limit);
  }
}

/** Friendly RU label for the UI's "approaching limit" toast and the
 *  hard-cap error message. */
export function quotaKindLabelRu(kind: QuotaKind): string {
  switch (kind) {
    case "clients":
      return "клиентов";
    case "appointments_month":
      return "записей в этом месяце";
    case "team_members":
      return "членов команды";
  }
}
