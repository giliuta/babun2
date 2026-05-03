"use client";

// STORY-052 G6 — `useTenantQuota()` — single source of truth for the
// tenant's plan + quota matrix + live usage counts on the client.
//
// Caching strategy:
//   * Fetch on mount.
//   * Refresh on `window` focus (cheap; covers cross-tab + sleep/wake).
//   * Expose a `refresh()` callback for post-create hooks (clients +
//     appointments + invite mutations call it after a successful write).
//
// We deliberately skip realtime. Quota state staleness up to ~minute
// is acceptable for v1 — server-side gates (G4) reject any actually-
// over-limit write, and the UI nudges via banners + button disable.
// Realtime would add complexity without changing behaviour.

import { useCallback, useEffect, useState } from "react";
import {
  getTenantQuotaSummary,
  type QuotaSnapshot,
} from "@/app/dashboard/settings/billing/quota-action";

export interface UseTenantQuotaResult {
  /** null while the first fetch is in flight or after a hard error. */
  snapshot: QuotaSnapshot | null;
  /** True only during the very first fetch (subsequent refreshes
   *  don't flip back to true so the UI doesn't flicker). */
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTenantQuota(): UseTenantQuotaResult {
  const [snapshot, setSnapshot] = useState<QuotaSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await getTenantQuotaSummary();
      if (r.ok) {
        setSnapshot(r.data);
        setError(null);
      } else {
        setError(r.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return { snapshot, loading, error, refresh };
}
