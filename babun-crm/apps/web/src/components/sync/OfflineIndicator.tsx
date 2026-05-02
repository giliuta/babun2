"use client";

// STORY-054 G4 — top-center status pill that surfaces the two
// offline-first signals the user actually needs to know about:
//
//   1. We're offline. Phrase: «Без сети». Gray pill, no action.
//   2. We're online but the queue still has pending writes. Phrase:
//      «Синхронизация: N» while count > 0. Blue pill, tappable to
//      open the SyncQueuePanel for inspection / manual retry.
//
// Online + empty queue → render nothing. The pill is intentionally
// chrome-less in the happy path so the dashboard stays calm.
//
// Z-index: 55 — sits above the static layout (BottomTabBar @ 40,
// EdgeGuards @ 50) but BELOW any modal sheet (70+) and below the
// UndoToast pill (60), so an active "Отменить" toast wins focus.
//
// Phone-first: pinned to safe-area-inset-top so the iOS status bar
// doesn't crash into it. Width capped at min(92vw, 220px) — same
// rhythm as UndoToast. Tap target is the whole pill.

import { useEffect, useState } from "react";
import { useIsOnline } from "@/lib/sync/network";
import { useQueueDepth } from "@/lib/sync/queue-events";
import SyncQueuePanel from "./SyncQueuePanel";

export default function OfflineIndicator() {
  // G4b — defer all client-only state (navigator.onLine, IDB queue
  // depth) until after hydration. Returning null on the server +
  // first client render keeps the SSR HTML and the first client
  // tree identical — no React #418 hydration mismatch when the
  // network/queue state would otherwise diverge between the two.
  const [mounted, setMounted] = useState(false);
  // The setState-in-effect pattern is the canonical Next.js
  // hydration-safe gate: server + first client render both see
  // `mounted=false` → return null → no hydration mismatch. The
  // post-hydration rerender then reads navigator.onLine + IDB
  // queue depth and shows the real pill. Lint rule is overly
  // broad for this specific case.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const online = useIsOnline();
  const depth = useQueueDepth();
  const [panelOpen, setPanelOpen] = useState(false);

  if (!mounted) return null;

  // Happy path — render nothing.
  if (online && depth === 0) return null;

  const isOffline = !online;
  const label = isOffline ? "Без сети" : `Синхронизация: ${depth}`;
  const tappable = !isOffline; // queue panel only useful when online

  const pillBase =
    "pointer-events-auto inline-flex items-center gap-2 px-3 h-7 rounded-full text-[12px] font-semibold leading-none shadow-[0_4px_12px_-4px_rgba(0,0,0,0.18)] transition";
  const pillStyle = isOffline
    ? "bg-[var(--surface-card-secondary)] text-[var(--label-secondary)]"
    : "bg-[var(--system-blue)] text-white active:opacity-70";

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="fixed left-1/2 -translate-x-1/2 z-[55] pointer-events-none"
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 8px)",
        }}
      >
        {tappable ? (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className={`${pillBase} ${pillStyle}`}
          >
            <Dot />
            {label}
          </button>
        ) : (
          <div className={`${pillBase} ${pillStyle}`}>
            <Dot dim />
            {label}
          </div>
        )}
      </div>
      {panelOpen && <SyncQueuePanel onClose={() => setPanelOpen(false)} />}
    </>
  );
}

function Dot({ dim = false }: { dim?: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-block w-1.5 h-1.5 rounded-full"
      style={{
        background: dim ? "currentColor" : "white",
        opacity: dim ? 0.6 : 0.85,
      }}
    />
  );
}
