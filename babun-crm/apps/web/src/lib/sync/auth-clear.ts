// STORY-054 G3 — wipe IndexedDB on auth state changes that imply
// "this device should not see the previous account's data".
//
// Mounted in the ROOT LAYOUT (not DashboardClientLayout) because
// SIGNED_OUT events fire during /login and /onboarding redirect
// chains that live outside /dashboard/*. Root layout always renders
// → safer net against data leak when a user logs out then logs back
// in as a different account on the same device.
//
// The actual cache wipe runs BEFORE any UI state update (we don't
// rely on React effects in routes — we listen to the Supabase auth
// stream directly). This guarantees a fast logout-then-other-login
// sequence cannot expose stale rows from the previous tenant
// through cached IDB reads.

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { cacheClearAll } from "@babun/shared/db/cache";

export function attachAuthClearListener(): () => void {
  const supabase = getSupabaseBrowser();
  const { data } = supabase.auth.onAuthStateChange(async (event) => {
    if (event !== "SIGNED_OUT") return;
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
