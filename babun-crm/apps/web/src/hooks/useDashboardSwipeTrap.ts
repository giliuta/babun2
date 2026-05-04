"use client";

// STORY-064 — defeat iOS PWA edge-swipe back/forward gestures on
// dashboard tab roots.
//
// The 24-px EdgeGuard strips in DashboardClientLayout block touch
// events before iOS converts them into a system gesture. That works
// for left-edge swipes but the right edge continued to navigate on
// some devices — likely because iOS reads forward-history gestures
// at the OS level before the strip's touchstart can preventDefault,
// AND because OLD history entries from before STORY-064 (when tabs
// used router.push) still sit in the user's session history.
//
// This hook adds a second-level guard via the history API:
//   1. On mount inside a dashboard tab root, push a sentinel state.
//   2. On popstate that targets that sentinel (no modal stack
//      depth, no real navigation intent), push the sentinel again.
//      The browser ends up on the same URL with the same content;
//      the swipe gesture becomes a no-op.
//
// Coexistence with history-stack.ts (modal back handler):
//   * Modal pushes its own state ON TOP of our sentinel. When the
//     user swipes, modal handler runs first and unregisters itself.
//   * If no modal is open, our sentinel handles popstate.
//   * Deep routes inside the dashboard (e.g. /dashboard/clients/[id])
//     are NOT trapped — they have legitimate "back to list"
//     semantics. The trap only arms on top-level tab roots.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { modalStackDepth } from "@/lib/history-stack";

const TAB_ROOT_PATHS = new Set<string>([
  "/dashboard",
  "/dashboard/clients",
  "/dashboard/chats",
  "/dashboard/finances",
  "/dashboard/recurring",
  "/dashboard/settings",
]);

const SENTINEL_KEY = "babunDashboardTrap";

interface SentinelState {
  [SENTINEL_KEY]?: true;
}

export function useDashboardSwipeTrap(): void {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!TAB_ROOT_PATHS.has(pathname)) return;

    // Push the sentinel once when we land on a tab root. Doing this
    // unconditionally on every pathname change is the right shape
    // because when the user navigates between tab roots the sentinel
    // gets refreshed for the new path.
    const state: SentinelState = { [SENTINEL_KEY]: true };
    try {
      window.history.pushState(state, "");
    } catch {
      // SecurityError in some sandboxed contexts — fall through
      // without trapping. Better to allow swipe than to crash.
      return;
    }

    const onPopState = (ev: PopStateEvent) => {
      // Modals own popstate first. If a modal is open, let
      // history-stack handle it — modalStackDepth() is the source
      // of truth.
      if (modalStackDepth() > 0) return;

      // Re-push the sentinel. Browser ends up back at the same URL
      // immediately, gesture becomes a no-op.
      try {
        window.history.pushState({ [SENTINEL_KEY]: true }, "");
      } catch {
        // ignore
      }
      void ev;
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [pathname]);
}
