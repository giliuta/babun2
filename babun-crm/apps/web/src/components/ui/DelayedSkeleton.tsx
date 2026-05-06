"use client";

// STORY-082 polish — delayed-skeleton.
//
// Renders children only if `show` has been true continuously for at
// least `delayMs`. The classic "skeleton flash" anti-pattern (data
// loads in 50-200 ms, skeleton appears for 1 frame, content swaps in)
// is the most-disliked loading style in iOS HIG and shows up
// strongest on tenants with empty caches.
//
// Pattern: if real loading finishes inside the threshold the skeleton
// never renders. If it doesn't, the skeleton appears smoothly.

import { useEffect, useState } from "react";

interface Props {
  show: boolean;
  delayMs?: number;
  children: React.ReactNode;
}

export function DelayedSkeleton({ show, delayMs = 300, children }: Props) {
  const [render, setRender] = useState(false);

  useEffect(() => {
    if (!show) {
      setRender(false);
      return;
    }
    const t = window.setTimeout(() => setRender(true), delayMs);
    return () => window.clearTimeout(t);
  }, [show, delayMs]);

  if (!show || !render) return null;
  return <>{children}</>;
}
