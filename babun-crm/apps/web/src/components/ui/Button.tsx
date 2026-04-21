"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "tinted";
type Size = "md" | "lg" | "sm";

interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  /** Lucide icon to the left of label. */
  leadingIcon?: ReactNode;
  className?: string;
  children: ReactNode;
}

// iOS-style button primitives.
//
// primary     — violet fill + white label, the "Сохранить" / "Войти"
//               confirm action. Max one per row.
// secondary   — neutral filled button, for dismiss / cancel
// tinted      — accent-tinted pill (translucent violet); iOS uses
//               this for "open in app" / "reset" style
// ghost       — transparent, label-only; used for "Отмена" in modals
// destructive — rose label, ghost bg; the "Удалить" pattern
//
// Sizes map to iOS control heights: 32 (sm), 44 (md default), 50 (lg).
export default function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  leadingIcon,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const sizeCls =
    size === "sm"
      ? "h-8 px-3 text-[13px] rounded-[8px]"
      : size === "lg"
        ? "h-[50px] px-6 text-[17px] rounded-[12px]"
        : "h-11 px-5 text-[15px] rounded-[10px]";

  const variantCls = {
    primary:
      "bg-[var(--accent)] text-white font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] transition",
    secondary:
      "bg-[var(--fill-tertiary)] text-[var(--label)] font-medium active:bg-[var(--fill-secondary)] transition",
    tinted:
      "bg-[var(--accent-tint)] text-[var(--accent)] font-semibold active:bg-[var(--accent-tint)]/70 transition",
    ghost:
      "text-[var(--label-secondary)] font-medium active:bg-[var(--fill-quaternary)] transition",
    destructive:
      "text-[var(--system-red)] font-medium active:bg-[rgba(255,59,48,0.1)] transition",
  }[variant];

  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-2 ${sizeCls} ${variantCls} ${fullWidth ? "w-full" : ""} disabled:opacity-40 disabled:pointer-events-none ${className}`}
    >
      {leadingIcon}
      {children}
    </button>
  );
}
