// STORY-062 — single source of truth for the placeholder Babun mark
// (the blue rounded square with a white "B"). Used by IOSInstallPrompt,
// pwa/InstallPrompt, SplashScreen, and DemoDataSection. Final designed
// mark drops in via a one-file swap here — no hunting through the four
// call sites that shared the inline gradient.
//
// The Edge-runtime icon files (`src/app/icon.tsx`, `apple-icon.tsx`)
// can't import from React-component land (different runtime contract,
// different import surface). They're documented inline as PLACEHOLDER
// and use the same gradient stops; future logo swap touches both this
// file AND those two files in lockstep.

import type { CSSProperties } from "react";

interface BabunMarkProps {
  /** Side length in px for the square container. */
  size?: number;
  /** Optional override for the corner radius — defaults to a 28% of
   *  size which matches iOS squircle proportions. */
  radius?: number;
  /** Inline style overrides — used by the splash for shadow tuning. */
  style?: CSSProperties;
  className?: string;
}

// References the canonical brand-mark gradient declared in globals.css
// (--brand-mark-grad). When the designed mark lands, swap this constant
// AND the matching token in globals.css together.
const GRADIENT = "var(--brand-mark-grad)";

export function BabunMark({
  size = 48,
  radius,
  style,
  className,
}: BabunMarkProps) {
  const r = radius ?? Math.round(size * 0.28);
  // "B" glyph scales relative to size. 44% reads on every tile size
  // we use today (32, 48, 64, 80).
  const fontSize = Math.round(size * 0.44);

  return (
    <div
      aria-hidden
      className={
        className ??
        "flex items-center justify-center text-white font-bold tracking-tight shrink-0"
      }
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: GRADIENT,
        fontSize,
        lineHeight: 1,
        fontFamily:
          "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        color: "#FFFFFF",
        ...style,
      }}
    >
      B
    </div>
  );
}
