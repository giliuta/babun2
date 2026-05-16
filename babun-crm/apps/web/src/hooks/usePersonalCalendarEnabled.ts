"use client";

// STORY-073 — read tenants.personal_calendar_enabled for the active
// session's tenant. Used by the calendar page to fork the empty
// state. Defaults to `true` while loading so an already-on tenant
// doesn't see a flash of the fork-state on slow networks.
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
  const [enabled, setEnabled] = useState(true);
  const [onboardedAt, setOnboardedAt] = useState<string | null>(null);
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
        setEnabled(Boolean(data.personal_calendar_enabled));
        setOnboardedAt(
          typeof data.onboarded_at === "string" ? data.onboarded_at : null,
        );
      }
    } catch {
      /* ignore — defaults to true / null */
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return { enabled, loaded, onboardedAt, refresh };
}
