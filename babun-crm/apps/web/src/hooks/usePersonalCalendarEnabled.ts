"use client";

// STORY-073 — read tenants.personal_calendar_enabled for the active
// session's tenant. Used by the calendar page to fork the empty
// state.
//
// v668 — flicker fix. Previously `useState(true)` meant every page
// load showed the personal calendar pill briefly until the async
// Supabase fetch resolved. For a tenant who disabled personal
// calendar (the common case after onboarding), this manifested as
// «Мой календарь» chip flashing in for ~200–500 ms on every mount —
// reported by the user as «опять появился мой календарь».
//
// New behaviour: synchronously seed from a localStorage cache of the
// last known value. First visit ever falls back to the DB column's
// default (false), matching what new tenants see in production. After
// the async fetch lands the value is rewritten to cache for the next
// mount. The net effect: zero flash for any tenant that has loaded
// the dashboard at least once.
//
// v515 P0 #2.3 — also surfaces `onboardedAt` so the calendar's
// first-run gate (FirstRunCalendarChoice) doesn't re-prompt a tenant
// who already made their choice during onboarding. Reproduction
// before the fix: pick «Календарь для команды» on the wizard →
// «Сохраняем…» → land on /dashboard → see the binary-choice screen
// again because `personal_calendar_enabled=false && teams.length=0`
// matched the gate. Now the gate also requires `!onboardedAt`.

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

const CACHE_KEY = "babun2:personal-cal-enabled";
const CACHE_KEY_ONBOARDED = "babun2:onboarded-at";

function readCachedEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (raw === null) return false; // matches DB default for fresh signups
    return raw === "true";
  } catch {
    return false;
  }
}

function readCachedOnboardedAt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CACHE_KEY_ONBOARDED);
  } catch {
    return null;
  }
}

export interface PersonalCalendarState {
  enabled: boolean;
  loaded: boolean;
  /** ISO timestamp of tenants.onboarded_at, or null when the user
   *  hasn't completed onboarding yet. A non-null value means the
   *  user has made the personal-vs-team decision and we should NOT
   *  re-prompt them via FirstRunCalendarChoice. */
  onboardedAt: string | null;
  refresh: () => Promise<void>;
}

export function usePersonalCalendarEnabled(): PersonalCalendarState {
  // v668 — lazy initializer reads the last known value from
  // localStorage. SSR-safe via the typeof window guard inside the
  // helper. New users hit DB default (false); returning users see
  // their actual state instantly with no flicker.
  const [enabled, setEnabled] = useState<boolean>(() => readCachedEnabled());
  const [onboardedAt, setOnboardedAt] = useState<string | null>(() =>
    readCachedOnboardedAt(),
  );
  const [loaded, setLoaded] = useState(false);

  const refresh = async () => {
    try {
      const sb = getSupabaseBrowser();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return;
      const tenantId =
        (user.app_metadata as { tenant_id?: string } | undefined)?.tenant_id ?? null;
      if (!tenantId) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (sb as any)
        .from("tenants")
        .select("personal_calendar_enabled, onboarded_at")
        .eq("id", tenantId)
        .maybeSingle();
      if (data) {
        const nextEnabled = Boolean(data.personal_calendar_enabled);
        const nextOnboardedAt =
          typeof data.onboarded_at === "string" ? data.onboarded_at : null;
        setEnabled(nextEnabled);
        setOnboardedAt(nextOnboardedAt);
        // v668 — write-through to localStorage so the next mount
        // bypasses the flicker entirely.
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(CACHE_KEY, nextEnabled ? "true" : "false");
            if (nextOnboardedAt) {
              window.localStorage.setItem(CACHE_KEY_ONBOARDED, nextOnboardedAt);
            } else {
              window.localStorage.removeItem(CACHE_KEY_ONBOARDED);
            }
          } catch {
            // ignore — quota / private-mode failures are non-fatal.
          }
        }
      }
    } catch {
      /* ignore — defaults to cached value or false */
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return { enabled, loaded, onboardedAt, refresh };
}
