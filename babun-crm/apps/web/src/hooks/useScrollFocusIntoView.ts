"use client";

import { useEffect } from "react";

/**
 * useScrollFocusIntoView — scrolls focused input/textarea into view
 * inside a scrollable container.
 *
 * Why: iOS Safari raises the keyboard 300–340 px when an input gains
 * focus. If the input sits in the bottom third of a fixed-height
 * modal (AppointmentSheet at 92 vh ≈ 820 px on iPhone 13 Pro), the
 * keyboard occludes it and the user types blind. The fixed-height
 * sheet's `overflow-y-auto` container doesn't auto-scroll on focus
 * because the input is technically inside the visible viewport — it
 * only becomes hidden once the keyboard rises.
 *
 * Approach: listen to `focusin` events bubbling from any input or
 * textarea inside the scrollable container. After one rAF (so iOS
 * has time to start animating the keyboard up), call
 * `scrollIntoView({block: "center"})` on the focused element. iOS
 * Safari respects this even mid-keyboard-animation.
 *
 * Belt-and-braces: also listen to `visualViewport.resize`. When the
 * keyboard rises mid-scroll-flow (e.g. user typed, scrolled, typed
 * again), the resize event fires and we re-center on the currently
 * focused element if it's inside our container.
 *
 * Apply once per modal — pass the ref to the scroll container, NOT
 * to individual inputs.
 */
export function useScrollFocusIntoView(
  scrollContainerRef: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const isEditable = (el: Element | null): el is HTMLElement =>
      el instanceof HTMLElement &&
      (el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable);

    const center = (el: HTMLElement) => {
      // One rAF lets iOS Safari start raising the keyboard before we
      // measure, so scrollIntoView lands on the post-keyboard layout.
      requestAnimationFrame(() => {
        try {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        } catch {
          // Older Safari without smooth scroll falls back silently.
        }
      });
    };

    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as Element | null;
      if (!isEditable(t)) return;
      if (!container.contains(t)) return;
      center(t);
    };

    const onViewportResize = () => {
      const active = document.activeElement;
      if (!isEditable(active)) return;
      if (!container.contains(active)) return;
      // Wait a tick — visualViewport.resize fires before iOS finishes
      // the keyboard animation, and scrollIntoView during the
      // animation is jittery on iOS 16/17. 80 ms is the sweet spot.
      window.setTimeout(() => center(active), 80);
    };

    container.addEventListener("focusin", onFocusIn);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", onViewportResize);

    return () => {
      container.removeEventListener("focusin", onFocusIn);
      vv?.removeEventListener("resize", onViewportResize);
    };
  }, [scrollContainerRef]);
}
