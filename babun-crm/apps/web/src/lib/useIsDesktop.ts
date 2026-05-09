"use client";

import { useMediaQuery } from "@/lib/useMediaQuery";

/**
 * STORY-056 — single source of truth for the mobile↔desktop breakpoint.
 *
 * Returns `true` on viewports ≥ 1024 px (Tailwind `lg`). The breakpoint
 * mirrors the existing `lg:` classes scattered across the layout so a
 * JS-driven branch (e.g. "render Modal vs Sheet") and a CSS-driven one
 * (e.g. `lg:hidden`) flip at the same width.
 *
 * Hook returns `false` during SSR + the first client paint so the
 * server-rendered HTML matches the mobile layout that a non-JS / slow
 * device would see; `useEffect` then flips it on desktop.
 */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
