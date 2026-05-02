// STORY-054 G4 — sync queue change notifier + React hook.
//
// IndexedDB has no native change events, so we layer a tiny pub/sub
// on top. Producers (cached-wrapper offline enqueue paths, replayer
// per-op success/failure) call `emitQueueChange()` after they
// mutate `sync_queue`. Consumers (`useQueueDepth()` hook in the
// OfflineIndicator + SyncQueuePanel) re-poll `queueDepth()` on each
// emit.
//
// Safety net: a low-frequency 5s poll catches any edge case where a
// producer forgets to emit (e.g. third-party library writing
// directly to IDB, or a future cached store added without wiring).
// 5 s on a phone PWA is invisible to users and the IDB count call
// is sub-millisecond, so the cost is negligible.
//
// Cross-tab: NOT propagated. Each tab has its own subscriber set
// and polls its own IDB handle. The 5s safety poll picks up writes
// from other tabs of the same origin within 5s, which matches the
// user's mental model of "I made a change in another tab — refresh
// to see it." We can layer BroadcastChannel later if a real cross-
// tab use-case appears (e.g. user has dashboard open in two tabs
// and wants the badge to stay in sync without refresh).

import { useEffect, useState } from "react";
import {
  queueDepth,
  enqueueOp,
  removeOp,
  bumpAttempt,
  getCache,
  type QueuedOp,
} from "@babun/shared/db/cache";

type Listener = () => void;
const listeners = new Set<Listener>();

/** Producers call this after enqueueOp / removeOp / bumpAttempt. */
export function emitQueueChange(): void {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      /* ignore subscriber errors */
    }
  });
}

export function subscribeQueueChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// ─── Producer wrappers ────────────────────────────────────────────
// Thin shims around the cache-layer queue primitives that fire the
// pub/sub event after the IDB write succeeds. UI code (the cached
// wrappers in this folder + the replayer) goes through these rather
// than the raw cache exports so the badge updates instantly without
// waiting for the 5-s safety poll.

export async function enqueueOpAndEmit(
  op: Omit<QueuedOp, "id" | "created_at" | "attempts">,
): Promise<void> {
  await enqueueOp(op);
  emitQueueChange();
}

export async function removeOpAndEmit(id: number): Promise<void> {
  await removeOp(id);
  emitQueueChange();
}

export async function bumpAttemptAndEmit(
  id: number,
  error: string,
): Promise<void> {
  await bumpAttempt(id, error);
  emitQueueChange();
}

/** Manual-retry from the SyncQueuePanel: reset attempts + clear
 *  last_error so the next drain pass picks the op up fresh. */
export async function resetOpAttemptsAndEmit(id: number): Promise<void> {
  const db = await getCache();
  const op = await db.get("sync_queue", id);
  if (!op) return;
  // last_error is optional in QueuedOp; rebuild without it instead
  // of writing `undefined` (idb keeps `undefined` properties around).
  const { last_error: _ignored, ...rest } = op;
  void _ignored;
  const next: QueuedOp = { ...rest, attempts: 0 };
  await db.put("sync_queue", next);
  emitQueueChange();
}

const POLL_INTERVAL_MS = 5_000;

/** React hook — returns the current sync queue depth. Resubscribes
 *  on emit, plus a 5s safety poll. Returns 0 during SSR. */
export function useQueueDepth(): number {
  const [depth, setDepth] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const n = await queueDepth();
        if (!cancelled) setDepth(n);
      } catch {
        // IDB not available (SSR / private mode) — leave at 0.
      }
    };
    void refresh();
    const unsub = subscribeQueueChange(() => void refresh());
    const id = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      unsub();
      window.clearInterval(id);
    };
  }, []);

  return depth;
}
