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

// Telegram grouped-list section. Composes three slots — caption ·
// card · footnote. Card clips rows to `--radius-card` (10 px) and
// carries almost no shadow (Telegram cards lay flat on the grouped
// background unlike iOS HIG). Rows inside use the `.row-separator`
// utility for 56-px-inset hairlines between them.
export default function ListGroup({
  title,
  footer,
  children,
  className,
}: ListGroupProps) {
  return (
    <div className={className}>
      {title && (
        <div className="px-4 pb-1.5 text-[13px] font-normal text-[var(--label-secondary)] uppercase tracking-wider">
          {title}
        </div>
      )}
      <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] overflow-hidden shadow-[var(--shadow-card)]">
        {children}
      </div>
      {footer && (
        <div className="px-4 pt-1.5 text-[12px] text-[var(--label-secondary)] leading-snug">
          {footer}
        </div>
      )}
    </div>
  );
}
