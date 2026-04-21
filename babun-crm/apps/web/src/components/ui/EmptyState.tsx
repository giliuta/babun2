"use client";

import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

// Unified empty state used across clients, chats, waitlist, finances,
// reports. A muted circular icon, a title, optional description, and
// an optional call-to-action. Tokens only — respects dark theme.
export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className}`}
    >
      {icon && (
        <div className="w-14 h-14 rounded-full bg-[var(--fill-tertiary)] flex items-center justify-center text-[var(--label-tertiary)] mb-3">
          {icon}
        </div>
      )}
      <h3 className="text-[17px] font-semibold text-[var(--label)]">{title}</h3>
      {description && (
        <p className="mt-1 text-[14px] text-[var(--label-secondary)] max-w-xs">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
