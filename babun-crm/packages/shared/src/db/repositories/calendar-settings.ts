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
  // v493 — personal_labels round-trip. Old rows (pre-migration
  // 20260513_001) lack the column; the typed Row may not even have
  // it. Read defensively via an indexed cast so the repo still works
  // against an outdated Supabase project.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawLabels = (r as any).personal_labels;
  const personalLabels: string[] | undefined = Array.isArray(rawLabels)
    ? rawLabels.filter((x: unknown): x is string => typeof x === "string")
    : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawDefault = (r as any).personal_default_label;
  const personalDefaultLabel: string | undefined =
    typeof rawDefault === "string" && rawDefault.length > 0
      ? rawDefault
      : undefined;
  return {
    startHour: r.start_hour,
    endHour: r.end_hour,
    gridStep: grid,
    weekStart: r.week_start as "monday" | "sunday",
    timezone: r.timezone,
    bufferMinutes: r.buffer_minutes,
    hideCancelled: r.hide_cancelled,
    allowOvertime: r.allow_overtime,
    // v449 — round-trip work / scroll-open hours through Supabase.
    // Older rows return null here; the caller's sanitizer fills them
    // with the visible-range defaults so the form never crashes.
    // Indexed cast: the production schema doesn't expose these columns
    // (the migration that adds them is queued separately), so the
    // regenerated database.types stripped them. The graceful-fallback
    // below still strips writes on 42703 if the column is missing.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    workStartHour: ((r as any).work_start_hour ?? undefined) as number | undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    workEndHour: ((r as any).work_end_hour ?? undefined) as number | undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scrollOpenHour: ((r as any).scroll_open_hour ?? undefined) as number | undefined,
    personalLabels,
    personalDefaultLabel,
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
  // Indexed cast — see rowToSettings for context. The graceful-fallback
  // below strips these on 42703 if the column isn't deployed yet.
  if (patch.workStartHour !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (insert as any).work_start_hour = patch.workStartHour;
  }
  if (patch.workEndHour !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (insert as any).work_end_hour = patch.workEndHour;
  }
  if (patch.scrollOpenHour !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (insert as any).scroll_open_hour = patch.scrollOpenHour;
  }
  // v493 — round-trip personalLabels / personalDefaultLabel. Written
  // through an indexed cast since older builds of `database.types`
  // may not have the columns yet. The graceful-fallback below strips
  // them on 42703 («column does not exist») and retries.
  if (patch.personalLabels !== undefined) {
    // Empty array → null so the Supabase column reads as «no
    // personal labels» on next fetch. Without this an explicit
    // delete-all action left the column = [...stale] forever.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (insert as any).personal_labels =
      patch.personalLabels.length > 0 ? patch.personalLabels : null;
  }
  if (patch.personalDefaultLabel !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (insert as any).personal_default_label =
      patch.personalDefaultLabel && patch.personalDefaultLabel.length > 0
        ? patch.personalDefaultLabel
        : null;
  }

  const { data, error } = await supabase
    .from("calendar_settings")
    .upsert(insert, { onConflict: "tenant_id" })
    .select("*")
    .single();

  // v449 — graceful fallback when the 20260507_001 migration hasn't
  // been applied to the target Supabase project yet. PostgREST
  // returns 42703 ("column ... does not exist"); strip the new
  // fields and retry once. localStorage already has the full save,
  // so the user's edits aren't lost — they just don't cross-sync
  // until the migration runs.
  // v493 — same pattern extended to personal_labels / personal_default_label
  // for tenants on older Supabase deploys.
  if (error) {
    const isMissingCol =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).code === "42703" ||
      /work_start_hour|work_end_hour|scroll_open_hour|personal_labels|personal_default_label/i.test(
        error.message,
      );
    if (isMissingCol) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (insert as any).work_start_hour;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (insert as any).work_end_hour;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (insert as any).scroll_open_hour;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (insert as any).personal_labels;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (insert as any).personal_default_label;
      const retry = await supabase
        .from("calendar_settings")
        .upsert(insert, { onConflict: "tenant_id" })
        .select("*")
        .single();
      if (retry.error)
        throw new Error(`updateCalendarSettings: ${retry.error.message}`);
      return rowToSettings(retry.data);
    }
    throw new Error(`updateCalendarSettings: ${error.message}`);
  }
  return rowToSettings(data);
}
