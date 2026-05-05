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
  // STORY-072 follow-up — chats / appointments / schedule / etc.
  // were missing from this list, causing demo or previous-tenant
  // data to leak into a fresh signup on the same browser.
  "babun-chats",
  "babun-appointments",
  "babun-day-cities",
  "babun-day-extras",
  "babun-recurring",
  "babun-team-schedules",
  "babun-waitlist",
  "babun:company-info",
  // CSV import resume state — not tenant-fatal but ought not survive
  // a logout either.
  "babun:import:active",
] as const;

// Prefix-based wipe for keys we know are tenant-scoped but generated
// dynamically (e.g. business-blocks: "babun-block-open:{kind}",
// per-tenant tutorials hints: "babun:hint-*", per-tenant unread
// trackers etc). Cheaper than an explicit list and survives new
// keys being added without remembering to update this file.
const PREFIX_WIPE = ["babun-block-open:", "babun:hint-", "babun:tutorial-"];

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
  // Prefix sweep — copy keys first because removeItem mutates the
  // index during iteration on some browsers.
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (PREFIX_WIPE.some((p) => k.startsWith(p))) toRemove.push(k);
    }
    for (const k of toRemove) window.localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

// Track the last user_id we observed in this browser. Wipe runs when
// either (a) we go to SIGNED_OUT, or (b) SIGNED_IN with a different
// user_id than last time — covering the "register a new account
// without logging out first" path.
const LAST_USER_KEY = "babun:auth:last-user-id";

async function performWipe(): Promise<void> {
  clearLegacyLocalStorage();
  try {
    await cacheClearAll();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("auth-clear: cacheClearAll failed", err);
  }
}

export function attachAuthClearListener(): () => void {
  const supabase = getSupabaseBrowser();
  const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_OUT") {
      try { window.localStorage.removeItem(LAST_USER_KEY); } catch {}
      await performWipe();
      return;
    }
    if (event === "SIGNED_IN" && session?.user?.id) {
      let prev: string | null = null;
      try { prev = window.localStorage.getItem(LAST_USER_KEY); } catch {}
      const next = session.user.id;
      if (prev && prev !== next) {
        // Different account on the same browser — wipe before stamping
        // the new id so the new tenant doesn't inherit the previous
        // tenant's localStorage / IDB state.
        await performWipe();
      }
      try { window.localStorage.setItem(LAST_USER_KEY, next); } catch {}
    }
  });
  return () => data.subscription.unsubscribe();
}
