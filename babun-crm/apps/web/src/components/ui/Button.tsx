"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { haptic } from "@/lib/haptics";

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

// Telegram-style button.
//
// primary     — accent-blue pill + white label, the confirm action
//               ("Сохранить", "Войти", "Подключить устройство"). Always pill.
// secondary   — neutral fill, for dismiss/cancel. Pill.
// tinted      — accent-tint bg, accent text (Telegram uses this for
//               inline suggestions like "Открыть чат").
// ghost       — label-only, accent text.
// destructive — red text, no fill. Paired with ConfirmDialog for
//               "Удалить", "Выйти".
//
// Sizes: sm (36h) · md (44h) · lg (50h). Primary buttons in the
// Telegram UI are always pill-shaped regardless of size.
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
      ? "h-9 px-4 text-[14px]"
      : size === "lg"
        ? "h-[50px] px-6 text-[17px]"
        : "h-11 px-5 text-[15px]";

  // STORY-081 — disabled token. Filled variants get a real
  // fill-tertiary + label-tertiary state (mirrors `.pill-primary:disabled`
  // in globals.css). Text-only variants just dim the label. Avoids the
  // "faded enabled button" look that opacity-only produces and stops
  // users from repeat-tapping a button that won't respond.
  const variantCls = {
    primary:
      "bg-[var(--accent)] text-[var(--label-on-accent)] font-semibold rounded-[var(--radius-pill)] active:bg-[var(--accent-pressed)] press-spring shadow-[var(--shadow-fab)] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] disabled:shadow-none",
    secondary:
      "bg-[var(--fill-tertiary)] text-[var(--label)] font-semibold rounded-[var(--radius-pill)] active:bg-[var(--fill-secondary)] press-spring disabled:text-[var(--label-tertiary)]",
    tinted:
      "bg-[var(--accent-tint)] text-[var(--accent)] font-semibold rounded-[var(--radius-pill)] active:bg-[var(--fill-secondary)] press-spring disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)]",
    ghost:
      "text-[var(--accent)] font-medium rounded-[10px] active:bg-[var(--fill-quaternary)] press-scale disabled:text-[var(--label-tertiary)]",
    destructive:
      "text-[var(--system-red)] font-semibold rounded-[10px] active:bg-[rgba(255,59,48,0.1)] press-scale disabled:text-[var(--label-tertiary)]",
  }[variant];

  // v319 — haptic on every button press.  Variant maps to feedback
  // strength so destructive actions feel chunkier than ghost taps.
  const hapticOnTap: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (rest.disabled) return;
    if (variant === "destructive") haptic("warning");
    else if (variant === "primary") haptic("medium");
    else haptic("light");
    rest.onClick?.(e);
  };

  return (
    <button
      type="button"
      {...rest}
      onClick={hapticOnTap}
      className={`inline-flex items-center justify-center gap-2 ${sizeCls} ${variantCls} ${fullWidth ? "w-full" : ""} disabled:cursor-not-allowed disabled:pointer-events-none ${className}`}
    >
      {leadingIcon}
      {children}
    </button>
  );
}
