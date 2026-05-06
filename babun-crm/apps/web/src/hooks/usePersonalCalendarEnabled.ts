"use client";

// STORY-073 — read tenants.personal_calendar_enabled for the active
// session's tenant. Used by the calendar page to fork the empty
// state. Defaults to `true` while loading so an already-on tenant
// doesn't see a flash of the fork-state on slow networks.

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function usePersonalCalendarEnabled(): {
  enabled: boolean;
  loaded: boolean;
  refresh: () => Promise<void>;
} {
  const [enabled, setEnabled] = useState(true);
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
        .select("personal_calendar_enabled")
        .eq("id", tenantId)
        .maybeSingle();
      if (data) setEnabled(Boolean(data.personal_calendar_enabled));
    } catch {
      /* ignore — defaults to true */
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return { enabled, loaded, refresh };
}
