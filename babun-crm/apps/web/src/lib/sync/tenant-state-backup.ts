// v505 — kitchen-sink backup of localStorage-only entities to Supabase.
//
// Background: teams / masters / services / sms-templates / expense-categories
// / equipment / cities / location-labels never had their own Supabase tables —
// they live only in localStorage. v504 stopped the auth-clear listener from
// wiping them on spurious SIGNED_OUT, but ANY other path that clears
// localStorage (iOS Safari storage eviction, the user clearing site data, a
// corrupted Cache API entry, even a bug we haven't found yet) would lose them
// permanently.
//
// This module mirrors all of them into `public.tenant_state.prototype_state`
// (one jsonb blob per tenant). On dashboard mount, if a local store is empty
// but the server blob has data, we restore. Subsequent local writes trigger a
// debounced save back to the blob.
//
// The blob is intentionally "kitchen sink" — one round-trip per change,
// no per-entity granularity. Cheap to implement; granular per-table
// migrations can come later once the data model is stable.

import type { SupabaseClient } from "@supabase/supabase-js";
import { reportSyncError, clearSyncError } from "./sync-error-bus";
import {
  loadMasters,
  loadTeams,
  saveMasters,
  saveTeams,
  type Master,
  type Team,
} from "@babun/shared/local/masters";
import {
  loadServices,
  loadCategories,
  saveServices,
  saveCategories,
  type Service,
  type ServiceCategory,
} from "@babun/shared/local/services";
import {
  loadTemplates,
  saveTemplates,
  type SmsTemplate,
} from "@babun/shared/local/sms-templates";
import {
  loadExpenseCategories,
  saveExpenseCategories,
  type ExpenseCategory,
} from "@babun/shared/local/expense-categories";
import {
  loadEquipment,
  saveEquipment,
  type Equipment,
} from "@babun/shared/local/equipment";
import {
  loadCities,
  saveCities,
  type City,
} from "@babun/shared/local/cities";
import {
  loadLocationLabels,
  saveLocationLabels,
  type LocationLabel,
} from "@babun/shared/local/location-labels";
import {
  loadCalendarSettings,
  saveCalendarSettings,
  DEFAULT_CALENDAR_SETTINGS,
  type CalendarSettings,
} from "@babun/shared/local/calendar-settings";
import {
  loadDayCities,
  saveDayCities,
  type DayCityMap,
} from "@babun/shared/local/day-cities";

export interface PrototypeState {
  masters?: Master[];
  teams?: Team[];
  services?: Service[];
  serviceCategories?: ServiceCategory[];
  smsTemplates?: SmsTemplate[];
  expenseCategories?: ExpenseCategory[];
  equipment?: Equipment[];
  cities?: City[];
  locationLabels?: LocationLabel[];
  /** v662 — extra backup for settings that have their own Supabase
   *  tables but historically have wiped on transient empty fetches.
   *  Included as belt-and-braces: if the per-table fetch returns
   *  empty AND localStorage is also empty, we can still restore from
   *  this snapshot. */
  calendarSettings?: CalendarSettings;
  dayCities?: DayCityMap;
}

export function collectLocalState(): PrototypeState {
  return {
    masters: loadMasters(),
    teams: loadTeams(),
    services: loadServices(),
    serviceCategories: loadCategories(),
    smsTemplates: loadTemplates(),
    expenseCategories: loadExpenseCategories(),
    equipment: loadEquipment(),
    cities: loadCities(),
    locationLabels: loadLocationLabels(),
    calendarSettings: loadCalendarSettings(),
    dayCities: loadDayCities(),
  };
}

export async function fetchTenantState(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<PrototypeState | null> {
  const { data, error } = await supabase
    .from("tenant_state")
    .select("prototype_state")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("[tenant-state] fetch failed", error);
    reportSyncError(error);
    return null;
  }
  if (!data?.prototype_state) return null;
  return data.prototype_state as PrototypeState;
}

export async function saveTenantState(
  supabase: SupabaseClient,
  tenantId: string,
  state: PrototypeState,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("tenant_state") as any).upsert(
    {
      tenant_id: tenantId,
      prototype_state: state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" },
  );
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("[tenant-state] save failed", error);
    reportSyncError(error);
    return;
  }
  // Success — clear any previously surfaced error so the red pill
  // disappears as soon as the next save lands.
  clearSyncError();
}

/** Restore any locally-empty store from the server blob.
 *  Returns true when at least one store was actually restored — the caller
 *  can use that to trigger a state refresh so the dashboard sees the new data
 *  without a page reload. */
export function restoreEmptyStoresFromBlob(blob: PrototypeState): boolean {
  let restored = false;
  if (loadMasters().length === 0 && blob.masters?.length) {
    saveMasters(blob.masters);
    restored = true;
  }
  if (loadTeams().length === 0 && blob.teams?.length) {
    saveTeams(blob.teams);
    restored = true;
  }
  if (loadServices().length === 0 && blob.services?.length) {
    saveServices(blob.services);
    restored = true;
  }
  if (loadCategories().length === 0 && blob.serviceCategories?.length) {
    saveCategories(blob.serviceCategories);
    restored = true;
  }
  if (loadTemplates().length === 0 && blob.smsTemplates?.length) {
    saveTemplates(blob.smsTemplates);
    restored = true;
  }
  if (loadExpenseCategories().length === 0 && blob.expenseCategories?.length) {
    saveExpenseCategories(blob.expenseCategories);
    restored = true;
  }
  if (loadEquipment().length === 0 && blob.equipment?.length) {
    saveEquipment(blob.equipment);
    restored = true;
  }
  if (loadCities().length === 0 && blob.cities?.length) {
    saveCities(blob.cities);
    restored = true;
  }
  if (loadLocationLabels().length === 0 && blob.locationLabels?.length) {
    saveLocationLabels(blob.locationLabels);
    restored = true;
  }
  // v662 — restore calendar settings + day-cities from the blob when
  // the per-table fetches haven't filled them. The check for "empty"
  // here is "matches DEFAULT" — that's the only state we'd want to
  // clobber, since real user-edited settings differ from defaults.
  if (blob.calendarSettings) {
    const current = loadCalendarSettings();
    const looksDefault =
      JSON.stringify(current) === JSON.stringify(DEFAULT_CALENDAR_SETTINGS);
    if (looksDefault) {
      saveCalendarSettings(blob.calendarSettings);
      restored = true;
    }
  }
  if (blob.dayCities && Object.keys(blob.dayCities).length > 0) {
    const current = loadDayCities();
    if (Object.keys(current).length === 0) {
      saveDayCities(blob.dayCities);
      restored = true;
    }
  }
  return restored;
}

// Debounced save — collapses bursts of mutations into a single network round
// trip. 1.2 s gives enough headroom for batched form saves (e.g. brigade
// editor) without making the user wait long enough to close the tab and lose
// the write.
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleTenantStateSave(
  supabase: SupabaseClient,
  tenantId: string,
): void {
  // CROSS-TENANT LEAK FIX: never back up another tenant's local data.
  // If this device's cache is stamped for a DIFFERENT tenant than the
  // one we're saving for, refuse — the owner-guard wipes + reloads, and
  // this stops the un-wiped reference books from leaking into the new
  // tenant's tenant_state blob in the meantime. (Key must match
  // CACHE_OWNER_KEY in lib/sync/auth-clear.ts; kept as a literal here to
  // avoid an import cycle in the sync path.)
  try {
    if (typeof window !== "undefined") {
      const owner = window.localStorage.getItem("babun:cache-owner");
      if (owner && owner !== tenantId) return;
    }
  } catch {
    /* storage unavailable — fall through and save */
  }
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void saveTenantState(supabase, tenantId, collectLocalState());
  }, 1200);
}
