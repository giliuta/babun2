"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}

// Counts from 0 up to `value` when it first mounts, and animates on
// subsequent changes. Uses requestAnimationFrame, no deps. Falls back
// to rendering the target instantly when the user prefers reduced
// motion.
export default function AnimatedNumber({
  value,
  duration = 600,
  format,
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const prevValueRef = useRef(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(value);
      prevValueRef.current = value;
      return;
    }

    const start = prevValueRef.current;
    const delta = value - start;
    if (delta === 0) return;

    let raf = 0;
    const t0 = performance.now();
    // easeOutCubic
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const elapsed = now - t0;
      const t = Math.min(1, elapsed / duration);
      const next = start + delta * ease(t);
      setDisplay(next);
      if (t < 1) raf = requestAnimationFrame(tick);
      else prevValueRef.current = value;
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const text = format ? format(display) : Math.round(display).toString();
  return <span className={className}>{text}</span>;
}
