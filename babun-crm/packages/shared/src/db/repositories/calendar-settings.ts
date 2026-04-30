// Calendar settings repository — STORY-044.
//
// One row per tenant (PRIMARY KEY = tenant_id). The trigger from
// 20260430_005 inserts a default row at signup; the 20260430_005
// backfill covers existing tenants. So getCalendarSettings always
// finds a row in steady state.
//
// updateCalendarSettings uses a single upsert (`ON CONFLICT (tenant_id)
// DO UPDATE`) so a race between two devices both editing the
// settings simultaneously is serialised at the DB level — last write
// wins, no duplicate rows.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import type {
  CalendarSettings,
} from "../../local/calendar-settings";
import { DEFAULT_CALENDAR_SETTINGS } from "../../local/calendar-settings";

type DbSupabase = SupabaseClient<Database>;
type Row = Database["public"]["Tables"]["calendar_settings"]["Row"];

function rowToSettings(r: Row): CalendarSettings {
  // Validate grid_step at the type boundary — the DB check constraint
  // already restricts to 15/30/60, so the cast is safe.
  const grid = r.grid_step as 15 | 30 | 60;
  return {
    startHour: r.start_hour,
    endHour: r.end_hour,
    gridStep: grid,
    weekStart: r.week_start as "monday" | "sunday",
    timezone: r.timezone,
    bufferMinutes: r.buffer_minutes,
    hideCancelled: r.hide_cancelled,
    allowOvertime: r.allow_overtime,
  };
}

/** Always returns settings — falls back to the locked defaults if no
 *  row exists yet (shouldn't happen post-trigger + backfill, but the
 *  guard keeps callers happy during the transition). */
export async function getCalendarSettings(
  supabase: DbSupabase,
  tenantId: string,
): Promise<CalendarSettings> {
  const { data, error } = await supabase
    .from("calendar_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(`getCalendarSettings: ${error.message}`);
  if (!data) return DEFAULT_CALENDAR_SETTINGS;
  return rowToSettings(data);
}

/** Upsert the singleton. Partial updates are fine — caller passes
 *  only the fields they want to change; the rest are preserved by
 *  PostgREST's `merge-duplicates` resolution. */
export async function updateCalendarSettings(
  supabase: DbSupabase,
  tenantId: string,
  patch: Partial<CalendarSettings>,
): Promise<CalendarSettings> {
  const insert: Database["public"]["Tables"]["calendar_settings"]["Insert"] = {
    tenant_id: tenantId,
  };
  if (patch.startHour !== undefined) insert.start_hour = patch.startHour;
  if (patch.endHour !== undefined) insert.end_hour = patch.endHour;
  if (patch.gridStep !== undefined) insert.grid_step = patch.gridStep;
  if (patch.weekStart !== undefined) insert.week_start = patch.weekStart;
  if (patch.timezone !== undefined) insert.timezone = patch.timezone;
  if (patch.bufferMinutes !== undefined) insert.buffer_minutes = patch.bufferMinutes;
  if (patch.hideCancelled !== undefined) insert.hide_cancelled = patch.hideCancelled;
  if (patch.allowOvertime !== undefined) insert.allow_overtime = patch.allowOvertime;

  const { data, error } = await supabase
    .from("calendar_settings")
    .upsert(insert, { onConflict: "tenant_id" })
    .select("*")
    .single();
  if (error) throw new Error(`updateCalendarSettings: ${error.message}`);
  return rowToSettings(data);
}
