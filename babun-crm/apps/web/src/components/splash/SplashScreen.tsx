"use client";

/* eslint-disable react-hooks/set-state-in-effect */
// The setState calls inside the mount effect are flagged by the lint
// rule. Same hydration-from-external-system pattern as
// usePwaInstallState / OfflineIndicator: we read sessionStorage on the
// client and surface visibility to React. No subscription form fits.

// STORY-057 — in-app launch splash with typewriter wordmark.
//
// Distinct from the OS-level PWA splash (`apple-touch-startup-image`,
// background_color from manifest) — that one shows during the iOS
// PWA cold-launch BEFORE the page paints. This component renders an
// in-app overlay AFTER the page hydrates, plays a short typewriter
// animation ("Babun & {tenant}"), then fades out and unmounts.
//
// Cadence — armed once per browser session via sessionStorage. Cold
// open of a fresh tab plays the splash; a hot reload in the same
// tab does not (sessionStorage is tab-scoped). Tab close clears the
// flag so the next cold open replays.
//
// Edge cases:
//   · tenantName empty / mid-onboarding → wordmark falls back to "Babun"
//   · tenantName > 20 chars → truncate to 17 + "..."
//   · SSR → component returns null on the server; client decides on mount
//
// Animation budget: ~80ms per char + ~500ms hold + ~250ms fade out.
// "Babun & AirFix" (14 chars) ≈ 1.87s end-to-end.

import { useEffect, useRef, useState } from "react";

const SESSION_KEY = "babun:splash-shown";
const CHAR_INTERVAL_MS = 80;
const HOLD_MS = 500;
const HOLD_REDUCED_MS = 800;
const FADE_MS = 250;
const MAX_TENANT_CHARS = 20;

interface Props {
  /** Live tenant name from DashboardClientLayout server prop. May be
   *  empty during onboarding — we fall back to "Babun" alone. */
  tenantName: string;
}

export function SplashScreen({ tenantName }: Props) {
  const [phase, setPhase] = useState<
    "ssr" | "typing" | "hold" | "fade" | "done"
  >("ssr");
  const [typed, setTyped] = useState("");
  const targetRef = useRef("");
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let shown = false;
    try {
      shown = window.sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      // private mode / quota — treat as "not shown" so the user gets
      // a splash instead of nothing.
    }
    if (shown) {
      setPhase("done");
      return;
    }
    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // best-effort — losing the flag means next reload replays the
      // splash, which is annoying but not broken.
    }

    const target = buildTarget(tenantName);
    targetRef.current = target;

    // Respect prefers-reduced-motion — skip typewriter animation per
    // WCAG / Apple HIG. Reveal the full wordmark immediately and
    // hold slightly longer (800 ms vs 500 ms) so the user still
    // perceives a deliberate moment, not a flash.
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    reducedMotionRef.current = reduced;

    if (reduced) {
      setTyped(target);
      setPhase("hold");
    } else {
      setPhase("typing");
    }
  }, [tenantName]);

  // Typewriter loop — one char per CHAR_INTERVAL_MS until we hit the
  // target string, then move to the explicit "hold" phase so reduced-
  // motion users (who jump straight to "hold") share the same exit
  // path.
  useEffect(() => {
    if (phase !== "typing") return;
    const target = targetRef.current;
    if (typed.length >= target.length) {
      setPhase("hold");
      return;
    }
    const t = window.setTimeout(() => {
      setTyped(target.slice(0, typed.length + 1));
    }, CHAR_INTERVAL_MS);
    return () => window.clearTimeout(t);
  }, [phase, typed]);

  // Hold phase — wait, then start the fade. Reduced-motion uses a
  // longer hold to compensate for the skipped typing animation.
  useEffect(() => {
    if (phase !== "hold") return;
    const dur = reducedMotionRef.current ? HOLD_REDUCED_MS : HOLD_MS;
    const t = window.setTimeout(() => setPhase("fade"), dur);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Fade phase — start the CSS transition, then unmount after it
  // settles. Two RAFs aren't strictly needed since opacity transitions
  // run regardless of mount order; a single setTimeout is enough.
  useEffect(() => {
    if (phase !== "fade") return;
    const t = window.setTimeout(() => setPhase("done"), FADE_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === "ssr" || phase === "done") return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#EFEFF4] transition-opacity"
      style={{
        opacity: phase === "fade" ? 0 : 1,
        transitionDuration: `${FADE_MS}ms`,
        // Ignore touches once we're fading — let them reach the
        // dashboard underneath without waiting for unmount.
        pointerEvents: phase === "fade" ? "none" : "auto",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      aria-hidden="true"
    >
      {/* PLACEHOLDER mark — same gradient as icon.svg / apple-icon.tsx
          / install prompts (STORY-056 unified blue). Swap for the real
          designed mark in STORY-062 along with the other surfaces. */}
      <div
        className="w-20 h-20 rounded-[20px] flex items-center justify-center text-white text-[42px] font-bold tracking-tight shadow-[0_8px_24px_rgba(31,102,215,0.25)]"
        style={{
          background: "linear-gradient(135deg, #1F66D7 0%, #1850A8 100%)",
        }}
      >
        B
      </div>

      <div
        className="mt-6 font-sans text-[20px] font-semibold text-[var(--label)] tracking-tight"
        // Reserve a stable line height during typing so the cursor
        // doesn't make the layout jump as characters land.
        style={{ minHeight: 26 }}
      >
        {typed}
        <span
          className="inline-block w-[2px] h-[20px] ml-[2px] align-[-3px] bg-[#1F66D7]"
          style={{
            animation:
              phase === "typing"
                ? "babun-splash-blink 1s steps(2) infinite"
                : "none",
            opacity: phase === "typing" ? 1 : 0,
          }}
        />
      </div>

      {/* Cursor blink keyframe — local to this component. Defining it
          inline avoids polluting globals.css with a one-off. */}
      <style>{`
        @keyframes babun-splash-blink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function buildTarget(tenantName: string): string {
  const trimmed = tenantName.trim();
  if (!trimmed) return "Babun";
  const display =
    trimmed.length > MAX_TENANT_CHARS
      ? trimmed.slice(0, MAX_TENANT_CHARS - 3) + "..."
      : trimmed;
  return `Babun & ${display}`;
}
