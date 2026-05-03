// STORY-054 G3 → STORY-053a — wipe device-local data on auth state
// changes that imply "this device should not see the previous
// account's data".
//
// Mounted in the ROOT LAYOUT (not DashboardClientLayout) because
// SIGNED_OUT events fire during /login and /onboarding redirect
// chains that live outside /dashboard/*. Root layout always renders
// → safer net against data leak when a user logs out then logs back
// in as a different account on the same device.
//
// The wipe targets two persistent stores:
//   1. IndexedDB — STORY-054 cache (clients, appointments, tags,
//      sync queue, sync meta).
//   2. localStorage — legacy reference books (masters, teams,
//      cities, equipment, location-labels, sms-templates,
//      expense-categories, services, services-categories) plus the
//      STORY-007 client-draft cleanup key. These keys are NOT
//      tenant-scoped on disk, so without an explicit wipe Tenant B
//      logging in on the same browser would see Tenant A's masters
//      and teams (the multi-tenant leak STORY-053a was tracking).

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cacheClearAll } from "@babun/shared/db/cache";

const LEGACY_LOCAL_KEYS = [
  // masters.ts
  "babun-masters",
  "babun-teams",
  // services.ts (two keys — service definitions + categories)
  "babun-services",
  "babun-service-categories",
  // sms-templates.ts
  "babun-sms-templates",
  // expense-categories.ts
  "babun-expense-categories",
  // equipment.ts
  "babun-equipment",
  // cities.ts
  "babun2:settings:cities",
  // location-labels.ts
  "babun2:settings:location-labels",
  // STORY-007 leftover (DCL cleans this on mount; clean here too
  // so a logout doesn't leave it behind for the next account).
  "babun-draft-clients",
  // Phase I37 stubbed "current master" (DCL: CURRENT_MASTER_KEY).
  "babun2:current-master",
] as const;

function clearLegacyLocalStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_LOCAL_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Safari private mode / quota-full / locked storage — swallow
      // and continue. The next account login will overwrite read
      // paths if the user actually saves anything.
    }
  }
}

export function attachAuthClearListener(): () => void {
  const supabase = getSupabaseBrowser();
  const { data } = supabase.auth.onAuthStateChange(async (event) => {
    if (event !== "SIGNED_OUT") return;
    // Synchronous localStorage wipe first — it's the fast win and
    // doesn't await anything. IDB wipe follows.
    clearLegacyLocalStorage();
    try {
      await cacheClearAll();
    } catch (err) {
      // Storage may be unavailable in private mode / quota-full;
      // log + carry on. Worst case the next session sees old rows
      // until they're realtime-overwritten or the user reloads.
      // eslint-disable-next-line no-console
      console.warn("auth-clear: cacheClearAll failed", err);
    }
  });
  return () => data.subscription.unsubscribe();
}
