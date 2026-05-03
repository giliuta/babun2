"use client";

import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /** Visual weight.
   *  · `"muted"`      (default) — neutral fill, used for "filter
   *    returned no rows" and similar transient empties.
   *  · `"prominent"`  — accent-tinted icon disc, slightly larger,
   *    used for first-run welcomes ("Создай первого клиента") and
   *    other moments where the empty state is the primary CTA on
   *    the screen. Matches the inline EmptyState style that lived
   *    in /dashboard/masters and /dashboard/teams before STORY-059
   *    consolidated them here. */
  variant?: "muted" | "prominent";
}

// Unified empty state used across clients, chats, waitlist, finances,
// reports, masters, teams, and the calendar grid. Tokens only —
// respects dark theme.
export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
  variant = "muted",
}: EmptyStateProps) {
  const prominent = variant === "prominent";
  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className}`}
    >
      {icon && (
        <div
          className={
            prominent
              ? "w-16 h-16 rounded-full bg-[var(--accent-tint)] flex items-center justify-center text-[var(--accent)] mb-3"
              : "w-14 h-14 rounded-full bg-[var(--fill-tertiary)] flex items-center justify-center text-[var(--label-tertiary)] mb-3"
          }
        >
          {icon}
        </div>
      )}
      <h3 className="text-[17px] font-semibold text-[var(--label)]">{title}</h3>
      {description && (
        <p className="mt-1 text-[14px] text-[var(--label-secondary)] max-w-xs leading-snug">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
