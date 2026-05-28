"use client";

import type { ReactNode } from "react";

interface AppointmentRowProps {
  /** Small uppercase section label shown above the value. */
  label: string;
  /** Primary display text. Not rendered when `hint` or `children` is provided. */
  value?: string;
  /** Secondary text below the value. */
  sub?: string;
  /** When true, the value is rendered in accent colour (empty-state CTA). */
  accent?: boolean;
  /** Tap handler — makes the row interactive and shows a › chevron. */
  onTap?: () => void;
  /** Optional right-side accessory element (e.g. nav icon button). Takes
   *  precedence over the auto chevron. */
  rightAccessory?: ReactNode;
  /** Non-tappable hint shown instead of `value` (faint, italic-ish). */
  hint?: string;
  /** Embedded content below the label, replaces value+sub. */
  children?: ReactNode;
  /** Force-show (true) or force-hide (false) chevron. Default: show when
   *  onTap is set and rightAccessory is absent. */
  showChevron?: boolean;
}

// Reusable row component for the unified appointment form card.
// Renders: small uppercase label + main content (value text OR children)
// + optional sub-line + optional chevron/right accessory.
export default function AppointmentRow({
  label,
  value,
  sub,
  accent = false,
  onTap,
  rightAccessory,
  hint,
  children,
  showChevron,
}: AppointmentRowProps) {
  const chevron =
    showChevron !== undefined
      ? showChevron
      : Boolean(onTap) && !rightAccessory;

  const content = (
    <div className="flex-1 min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-tertiary)] mb-0.5">
        {label}
      </div>
      {children ? (
        children
      ) : hint ? (
        <div className="text-[13px] text-[var(--label-secondary)] leading-snug">
          {hint}
        </div>
      ) : (
        <div
          className={`text-[15px] font-semibold truncate leading-snug ${
            accent ? "text-[var(--accent)]" : "text-[var(--label)]"
          }`}
        >
          {value ?? ""}
        </div>
      )}
      {sub && (
        <div className="text-[12px] text-[var(--label-secondary)] truncate mt-0.5">
          {sub}
        </div>
      )}
    </div>
  );

  const rightSide =
    rightAccessory || chevron ? (
      <div className="flex items-center gap-1 flex-shrink-0 pl-2">
        {rightAccessory}
        {chevron && (
          <span className="text-[var(--label-quaternary)]">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
        )}
      </div>
    ) : null;

  if (onTap) {
    return (
      <button
        type="button"
        onClick={onTap}
        className="w-full flex items-center gap-2 px-4 py-3 text-left active:bg-[var(--fill-quaternary)] transition"
      >
        {content}
        {rightSide}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-3">
      {content}
      {rightSide}
    </div>
  );
}
