"use client";

import { useEffect, useRef } from "react";

/**
 * STORY-056 — adaptive Sheet shell.
 *
 * On mobile (<1024 px) it renders as a full-screen card sliding in from
 * the right or bottom — the existing PWA behaviour every existing
 * `*Sheet` component already implements.
 *
 * On desktop (≥1024 px) it renders as a centred modal with backdrop,
 * fixed width controlled by `size`, rounded corners, and a soft shadow.
 *
 * It does NOT impose a header / footer — children own the inner
 * layout.  All this component does is:
 *  - mount/unmount based on `open`
 *  - trap Esc to close (default)
 *  - close on backdrop click on desktop
 *  - hand the appropriate Tailwind classes to its child wrapper so the
 *    same JSX renders correctly in either form factor
 *
 * Why not a portal?  Existing sheets are already rendered at the
 * document root via React tree position; nothing in the codebase relies
 * on z-index ordering by DOM source order.  Keeping it inline avoids
 * focus-trap / SSR-window-mismatch headaches and matches the
 * CreateClientModal pattern that's been in production since
 * STORY-036.
 */

export type SheetSize = "sm" | "md" | "lg" | "xl";

const SIZE_TO_WIDTH: Record<SheetSize, string> = {
  sm: "lg:w-[400px]",
  md: "lg:w-[480px]",
  lg: "lg:w-[640px]",
  xl: "lg:w-[720px]",
};

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Desktop modal width.  Mobile is always fullscreen. Default md (480 px). */
  size?: SheetSize;
  /** When false, Esc / backdrop click do not close.  Use only for
   *  destructive or wizard flows that need an explicit Cancel button. */
  dismissable?: boolean;
  /** Extra classes for the inner card.  Layout/scroll concerns live
   *  inside children — Sheet only enforces the shell. */
  className?: string;
  /** Vertical scroll inside the card (most sheets want this).  When
   *  the child manages its own scroll regions, set to false. */
  scrollable?: boolean;
  /** Highest z-index in the design system today is 80 (notifications).
   *  Sheets default to 70.  Override only for nested sheets. */
  zIndex?: number;
  children: React.ReactNode;
}

export default function Sheet({
  open,
  onClose,
  size = "md",
  dismissable = true,
  className = "",
  scrollable = true,
  zIndex = 70,
  children,
}: SheetProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Esc-to-close.  Mounted only while the sheet is open so a closed
  // sheet never grabs the key from underlying UI.
  useEffect(() => {
    if (!open || !dismissable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismissable, onClose]);

  if (!open) return null;

  const widthClass = SIZE_TO_WIDTH[size];

  return (
    <div
      // Mobile: fullscreen card pinned to all four edges, no backdrop
      //         (the card itself covers the screen, matching every
      //         existing *Sheet's expectation).
      // Desktop: dimmed backdrop, content centered.
      className="fixed inset-0 flex flex-col bg-[var(--surface-card)] lg:items-center lg:justify-center lg:bg-black/40 lg:p-6"
      style={{ zIndex }}
      onClick={(e) => {
        // Backdrop click closes ONLY on desktop — on mobile the entire
        // surface IS the card, so clicking it would close immediately.
        if (!dismissable) return;
        if (e.target !== e.currentTarget) return;
        onClose();
      }}
    >
      <div
        ref={cardRef}
        className={`flex flex-col h-full lg:h-auto lg:max-h-[85vh] ${widthClass} lg:rounded-2xl lg:bg-[var(--surface-card)] lg:shadow-[var(--shadow-sheet)] lg:overflow-hidden ${
          scrollable ? "overflow-y-auto lg:overflow-y-auto" : ""
        } ${className}`}
        // Stop bubbling so a click inside the card doesn't trigger the
        // backdrop close on the parent.
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
