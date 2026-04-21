"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ChipProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  active?: boolean;
  leadingIcon?: ReactNode;
  className?: string;
  children: ReactNode;
}

// Telegram filter chip. Active state uses accent fill + white label;
// idle is a soft fill-tertiary pill (no border — Telegram never
// borders chips). Height 32 matches the search-bar stack so two
// rows of chips sit cleanly under the global search.
export default function Chip({
  active = false,
  leadingIcon,
  className = "",
  children,
  ...rest
}: ChipProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center gap-1 h-8 px-3.5 rounded-full text-[13px] font-semibold transition ${
        active
          ? "bg-[var(--accent)] text-white"
          : "bg-[var(--fill-primary)] text-[var(--label)] active:bg-[var(--fill-secondary)]"
      } ${className}`}
    >
      {leadingIcon}
      {children}
    </button>
  );
}
