// Day extras repository — STORY-044.
//
// Normalised: one row per `DayExtra` line item, keyed by the synthetic
// `id` UUID. The local UI shape groups them by `<teamId>:<date>` so
// `listDayExtras` reduces rows back to that map; `setDayExtras`
// REPLACES the entire list for a (team, date) atomically (delete +
// reinsert) — matches STORY-042 A1 nested-collection contract.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import type {
  DayExtra,
  DayExtraKind,
  DayExtrasMap,
  ExpenseCategoryKey,
} from "../../local/day-extras";
import { dayExtrasKey } from "../../local/day-extras";

type DbSupabase = SupabaseClient<Database>;
type Row = Database["public"]["Tables"]["day_extras"]["Row"];

function rowToExtra(r: Row): DayExtra {
  const category = r.category as ExpenseCategoryKey | null;
  return {
    id: r.id,
    name: r.name,
    amount: Number(r.amount ?? 0),
    kind: r.kind as DayExtraKind,
    ...(category ? { category } : {}),
  };
}

export async function listDayExtras(
  supabase: DbSupabase,
  tenantId: string,
): Promise<DayExtrasMap> {
  const { data, error } = await supabase
    .from("day_extras")
    .select("*")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(`listDayExtras: ${error.message}`);
  const map: DayExtrasMap = {};
  for (const r of (data ?? []) as Row[]) {
    const key = dayExtrasKey(r.team_id, r.date);
    if (!map[key]) map[key] = [];
    map[key].push(rowToExtra(r));
  }
  return map;
}

/** Replace the entire list for a single (tenant, team, date). The
 *  delete + insert runs as two PostgREST calls — see STORY-044 A1
 *  comment about nested replace semantics. For atomicity across
 *  many (team, date) pairs use the `import_schedule` RPC. */
export async function setDayExtras(
  supabase: DbSupabase,
  tenantId: string,
  teamId: string,
  date: string,
  extras: DayExtra[],
): Promise<void> {
  const { error: delErr } = await supabase
    .from("day_extras")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("team_id", teamId)
    .eq("date", date);
  if (delErr) throw new Error(`setDayExtras (delete): ${delErr.message}`);
  if (extras.length === 0) return;
  const rows = extras.map((e) => ({
    id: e.id,
    tenant_id: tenantId,
    team_id: teamId,
    date,
    name: e.name,
    amount: e.amount,
    kind: e.kind,
    category: e.category ?? null,
  }));
  const { error: insErr } = await supabase.from("day_extras").insert(rows);
  if (insErr) throw new Error(`setDayExtras (insert): ${insErr.message}`);
}
