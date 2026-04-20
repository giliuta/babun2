"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

interface PressableButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  haptic?: boolean;
}

// Tiny wrapper that gives any button a uniform press feel — scale-95 on
// active, subtle tactile vibration on tap (iOS PWA respects `vibrate`
// when the site is installed). Falls back to noop on platforms without
// the API. Everything else is passed through: className, onClick, type…
const PressableButton = forwardRef<HTMLButtonElement, PressableButtonProps>(
  function PressableButton(
    { children, haptic = true, onClick, className = "", ...rest },
    ref
  ) {
    const handle = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (haptic && typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate?.(8);
        } catch {
          // Some browsers throw when called without a user gesture.
        }
      }
      onClick?.(e);
    };
    return (
      <button
        ref={ref}
        onClick={handle}
        className={`active:scale-[0.96] transition-transform duration-100 ${className}`}
        {...rest}
      >
        {children}
      </button>
    );
  }
);

export default PressableButton;
