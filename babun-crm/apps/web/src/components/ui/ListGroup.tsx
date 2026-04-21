"use client";

import type { ReactNode } from "react";

interface ListGroupProps {
  /** Uppercase caption above the card. Optional — some groups are
   *  headerless (the first group on a screen often is). */
  title?: string;
  /** Fine-print explanation under the card. */
  footer?: string;
  children: ReactNode;
  /** Extra classes applied to the outer wrapper (spacing overrides). */
  className?: string;
}

// iOS grouped-list section. Composes three slots — caption · card ·
// footnote — at the exact weights Apple ships. Rows live inside
// `children`; the card handles its own rounded-2xl clipping and
// subtle shadow so rows don't have to carry border radii.
export default function ListGroup({
  title,
  footer,
  children,
  className,
}: ListGroupProps) {
  return (
    <div className={className}>
      {title && (
        <div className="px-4 pb-2 text-[11px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
          {title}
        </div>
      )}
      <div className="bg-[var(--surface-card)] rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
        {children}
      </div>
      {footer && (
        <div className="px-4 pt-2 text-[11px] text-[var(--label-tertiary)] leading-snug">
          {footer}
        </div>
      )}
    </div>
  );
}
