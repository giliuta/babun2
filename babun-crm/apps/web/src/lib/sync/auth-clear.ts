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
  // STORY-072 leak audit follow-up — clients, client-tags, finance
  // brigades / members were not in the original list. Caused
  // previous-tenant data to surface on a fresh signup in the same
  // browser even after the tenant_sms_config / chats fixes.
  "babun-clients",
  "babun-client-tags",
  "babun2:finance:brigades",
  "babun2:finance:brigade_members",
] as const;

// STORY-078 — Switched from explicit-list maintenance to a
// prefix-sweep on three namespaces. Every Babun-owned localStorage
// key starts with one of these, and any new module that adds storage
// is automatically caught (no more "we forgot to add the key to the
// wipe list" follow-up commits). The KEEP list pins the device-level
// PWA state we DO want to survive an account switch (install banner
// dismissal, last-used view mode, push notif consent).
const TENANT_PREFIXES = ["babun-", "babun2:", "babun:"];
const KEEP_KEYS = new Set([
  "babun-pwa-install-dismissed",
  "babun-push-prompt-dismissed-at",
  "babun-view-mode",
  "babun-session-count",
  // Leak-guard identity stamps — must SURVIVE a logout wipe so the next
  // sign-in still has the previous identity to compare against (the
  // different-user wipe + the owner-guard). Without this a fast logout
  // would drop them and the next account couldn't be detected as
  // different. Literals match LAST_USER_KEY / CACHE_OWNER_KEY below.
  "babun:auth:last-user-id",
  "babun:cache-owner",
]);

function clearLegacyLocalStorage(): void {
  if (typeof window === "undefined") return;
  // Belt-and-suspenders explicit list (untouched) — still runs in
  // case a key in TENANT_PREFIXES list collides with KEEP_KEYS
  // somewhere in legacy storage.
  for (const key of LEGACY_LOCAL_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Safari private mode / quota-full / locked storage — swallow.
    }
  }
  // Prefix sweep — copy keys first because removeItem mutates the
  // index during iteration on some browsers.
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (KEEP_KEYS.has(k)) continue;
      if (TENANT_PREFIXES.some((p) => k.startsWith(p))) toRemove.push(k);
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
// Tenant that owns the local cache on THIS device. The owner-guard
// (DashboardClientLayout) stamps it on mount and refuses to render /
// back up another tenant's cache — defence-in-depth for the
// cross-tenant leak below.
export const CACHE_OWNER_KEY = "babun:cache-owner";

async function performWipe(): Promise<void> {
  clearLegacyLocalStorage();
  try {
    await cacheClearAll();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("auth-clear: cacheClearAll failed", err);
  }
}

/** Full local wipe for an INTENTIONAL logout — call before signOut so
 *  the next account (or anyone on a shared device) never inherits this
 *  account's cached data. Drops the user + cache-owner stamps too so
 *  the next sign-in starts from a clean slate. */
export function wipeLocalData(): void {
  // Fast logout: clear the localStorage data mirrors SYNCHRONOUSLY
  // (instant) and fire the heavy IndexedDB clear in the BACKGROUND. The
  // identity stamps survive (KEEP_KEYS) so the next sign-in's leak
  // guards still detect a different account and AWAIT the IDB clear
  // before showing any data — so logout itself never blocks on it.
  clearLegacyLocalStorage();
  void cacheClearAll();
}

/** Defence-in-depth tenant-owner guard. Stamps the tenant that owns
 *  this device's cache; if a DIFFERENT tenant is seen (an account
 *  switch the SIGNED_IN listener missed — e.g. a cold PWA start that
 *  emits INITIAL_SESSION rather than SIGNED_IN), wipes localStorage +
 *  IDB and returns true so the caller reloads into a clean state.
 *  NEVER wipes on a first-ever load (owner unset) — only on a concrete
 *  mismatch — so it can't cause data loss for legitimate sessions. */
export async function enforceCacheOwner(
  tenantId: string | null,
): Promise<boolean> {
  if (typeof window === "undefined" || !tenantId) return false;
  let owner: string | null = null;
  try { owner = window.localStorage.getItem(CACHE_OWNER_KEY); } catch {}
  if (owner && owner !== tenantId) {
    clearLegacyLocalStorage();
    try { await cacheClearAll(); } catch {}
    try { window.localStorage.setItem(CACHE_OWNER_KEY, tenantId); } catch {}
    return true;
  }
  if (owner !== tenantId) {
    try { window.localStorage.setItem(CACHE_OWNER_KEY, tenantId); } catch {}
  }
  return false;
}

export function attachAuthClearListener(): () => void {
  const supabase = getSupabaseBrowser();
  const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
    // v504 — CRITICAL: SIGNED_OUT used to unconditionally wipe
    // localStorage + IDB. That was the right defence against
    // cross-tenant data leak, but Supabase fires SIGNED_OUT for far
    // more than intentional logouts:
    //
    //   * Refresh-token request fails during cold start on a flaky
    //     network (very common on iOS PWA after a backgrounded app
    //     is relaunched — the cached JWT is near-expired, Supabase
    //     auto-refreshes, refresh hits a connection blip → SIGNED_OUT
    //     fires, then SIGNED_IN once the retry succeeds milliseconds
    //     later).
    //   * iOS Safari storage eviction can drop the auth localStorage
    //     entry → next session check sees no token → SIGNED_OUT.
    //   * Hot-reload during dev or a tab freeze on iOS can also
    //     produce a spurious SIGNED_OUT/SIGNED_IN pair.
    //
    // The user reported repeated total data loss after closing and
    // reopening the PWA — calendar empty, brigades gone, labels
    // vanished. That's exactly the spurious-SIGNED_OUT path nuking
    // every localStorage key under `babun-*`, `babun:*`, `babun2:*`.
    //
    // The cross-tenant leak this guarded against only happens when
    // a DIFFERENT user signs in on the same browser. That branch
    // (SIGNED_IN with prev !== next) already wipes correctly. So the
    // SIGNED_OUT-triggered wipe was strictly extra — and strictly
    // harmful — for every other case.
    //
    // We still clear LAST_USER_KEY on SIGNED_OUT, but DELIBERATELY
    // don't wipe local data. The next SIGNED_IN re-establishes the
    // user_id stamp; if it's a different account, the leak-protection
    // wipe fires there. If it's the same account (or the same one
    // returning after a network blip), nothing was lost.
    if (event === "SIGNED_OUT") {
      // CROSS-TENANT LEAK FIX: do NOT clear LAST_USER_KEY here. Clearing
      // it made the next SIGNED_IN see prev=null and SKIP the
      // different-user wipe — so logging out of account A then into
      // account B on the same device let B inherit A's cached data
      // (appointments rendered from the un-wiped IndexedDB cache; A's
      // reference books even got saved into B's tenant_state backup).
      // Keeping the stamp lets the SIGNED_IN branch below compare A vs B
      // and wipe ONLY when they differ — a same-user return after a
      // spurious/auto signout still matches → no wipe, no data loss
      // (the v504 concern stays addressed). Intentional logout already
      // wipes via signOut()→wipeLocalData().
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
