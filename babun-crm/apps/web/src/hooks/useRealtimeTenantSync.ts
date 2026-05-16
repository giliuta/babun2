"use client";

// STORY-048 — Generic Supabase Realtime sync hook for tenant-scoped
// tables. One channel per (tenant, table) pair, filtered server-side
// by `tenant_id=eq.<id>`. RLS on the underlying SELECT policy is
// applied to every broadcast event by Supabase Realtime v2, so
// cross-tenant leakage is impossible even if the filter is forged.
//
// Reconnect handling: if the channel ever transitions to CLOSED or
// CHANNEL_ERROR (network blip, token rotation, iOS PWA background),
// we set `wasDisconnected` on a ref. The next SUBSCRIBED transition
// fires `onResync()` so the caller refetches the table to backfill
// any events missed during the gap. After that it resets — steady-
// state subscribed events do NOT trigger resync.
//
// Dedupe semantics live in the *caller's* INSERT/UPDATE/DELETE
// handlers (we don't have access to the local state here). The
// recommended pattern:
//   onInsert(row): setState(prev => prev.find(r => r.id === row.id) ? prev : [...prev, row])
//   onUpdate(row): setState(prev => prev.map(r => r.id === row.id
//                    ? (r.updated_at && row.updated_at && r.updated_at >= row.updated_at ? r : row)
//                    : r))
//   onDelete({ id }): setState(prev => prev.filter(r => r.id !== id))

import { useEffect, useRef } from "react";
import type {
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from "@supabase/supabase-js";
import type { Database } from "@babun/shared/db/database.types";

type DbSupabase = SupabaseClient<Database>;

export interface RealtimeSyncOptions<TRow extends { id: string }> {
  supabase: DbSupabase;
  /** Public-schema table name. Must match a published table. */
  table: string;
  /** Active tenant. When null, the hook does nothing (logged-out
   *  / pre-onboarding states). */
  tenantId: string | null;
  /** Easy off-switch from the caller (e.g. while initial fetch is
   *  in flight, to avoid races between hydration and live events). */
  enabled?: boolean;
  onInsert: (row: TRow) => void;
  onUpdate: (row: TRow) => void;
  /** DELETE events ship just `{ id }` reliably. With REPLICA IDENTITY
   *  FULL the full OLD row is included, but callers should not depend
   *  on anything beyond `id`. */
  onDelete: (oldRow: { id: string }) => void;
  /** Fires after a reconnect (or on the very first SUBSCRIBED if
   *  caller passes initialResync). Caller should refetch the full
   *  list to backfill anything missed during the disconnect. */
  onResync?: () => void;
}

export function useRealtimeTenantSync<TRow extends { id: string }>(
  options: RealtimeSyncOptions<TRow>,
): void {
  const {
    supabase,
    table,
    tenantId,
    enabled = true,
    onInsert,
    onUpdate,
    onDelete,
    onResync,
  } = options;

  // Pin handlers so the effect doesn't re-subscribe whenever the
  // caller passes new closures every render. Refs always point at
  // the latest closure, but the channel survives across renders.
  const handlersRef = useRef({ onInsert, onUpdate, onDelete, onResync });
  handlersRef.current = { onInsert, onUpdate, onDelete, onResync };

  // Reconnect tracking — see file header comment for semantics.
  const wasDisconnectedRef = useRef(false);

  // v506 — per-hook-instance suffix on the channel name. Two consumers
  // of the same table (e.g. Sidebar's recurring-badge + the recurring
  // inbox page itself) were colliding on identical channel names
  // `tenant:<id>:<table>`; supabase-js v2 errors on the second
  // .subscribe() and the page crashed. Each hook instance now gets its
  // own channel so the same tenant+table can be observed by N callers
  // without stepping on each other.
  const instanceIdRef = useRef(Math.random().toString(36).slice(2, 8));

  useEffect(() => {
    if (!enabled || !tenantId) return;

    const channelName = `tenant:${tenantId}:${table}:${instanceIdRef.current}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload: RealtimePostgresChangesPayload<TRow>) => {
          if (payload.eventType === "INSERT") {
            handlersRef.current.onInsert(payload.new as TRow);
          } else if (payload.eventType === "UPDATE") {
            handlersRef.current.onUpdate(payload.new as TRow);
          } else if (payload.eventType === "DELETE") {
            const oldRow = payload.old as { id?: string } | null;
            if (oldRow?.id) {
              handlersRef.current.onDelete({ id: oldRow.id });
            }
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (wasDisconnectedRef.current) {
            handlersRef.current.onResync?.();
            wasDisconnectedRef.current = false;
          }
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          wasDisconnectedRef.current = true;
        }
        // TIMED_OUT is treated as a transient state — the SDK
        // auto-retries; a subsequent SUBSCRIBED transitions through
        // the wasDisconnected branch above.
      });

    return () => {
      void supabase.removeChannel(channel);
    };
    // We deliberately exclude the handler refs from deps — handlers
    // are stable via the ref pattern above. Re-subscribing every
    // render would tear the connection up and down and burn tokens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, table, tenantId, enabled]);
}
