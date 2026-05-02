// STORY-054 G2 — network availability detector.
//
// Single source of truth for "are we online?" — `navigator.onLine`
// plus a subscriber model so non-React callers (the replayer, the
// SW, the offline banner) can react. React callers should use the
// `useIsOnline()` hook below; the cache layer / replayer use
// `subscribeNetwork()` + `isOnline()` directly.
//
// Caveat: `navigator.onLine` lies on captive portals and DNS-only
// failures (returns `true` while requests fail). The replayer
// belt-and-suspenders this by treating any 5xx / network error as
// "offline-equivalent" — falls back to queue, retries on next
// reconnect signal.

import { useEffect, useState } from "react";

type Listener = (online: boolean) => void;
const listeners = new Set<Listener>();
let attached = false;

function ensureAttached(): void {
  if (attached || typeof window === "undefined") return;
  attached = true;
  const broadcast = () => {
    const v = navigator.onLine;
    listeners.forEach((cb) => {
      try {
        cb(v);
      } catch {
        /* ignore subscriber errors */
      }
    });
  };
  window.addEventListener("online", broadcast);
  window.addEventListener("offline", broadcast);
}

export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true; // SSR optimistic
  return navigator.onLine;
}

export function subscribeNetwork(cb: Listener): () => void {
  ensureAttached();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useIsOnline(): boolean {
  const [online, setOnline] = useState<boolean>(() => isOnline());
  useEffect(() => subscribeNetwork(setOnline), []);
  return online;
}
