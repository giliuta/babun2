"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ChipProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  active?: boolean;
  leadingIcon?: ReactNode;
  className?: string;
  children: ReactNode;
}

// iOS-style filter chip. Active state uses the accent fill; idle
// state is white on a subtle `separator` border. Height is 32 so two
// rows of chips fit the same visual block as a single input.
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
          : "bg-[var(--surface-card)] text-[var(--label)] border border-[var(--separator)] active:bg-[var(--fill-quaternary)]"
      } ${className}`}
    >
      {leadingIcon}
      {children}
    </button>
  );
}
