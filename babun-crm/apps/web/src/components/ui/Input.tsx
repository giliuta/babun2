"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  label?: string;
  /** Help text shown under the input in small grey. */
  hint?: string;
  /** Right-aligned accessory (icon button, unit, etc). */
  trailing?: ReactNode;
  required?: boolean;
  className?: string;
}

// Telegram-style text input. Resting state is fill-tertiary on a
// grouped background; focused state lifts to surface-card with an
// accent border. Label/hint mirror the pattern used inside Telegram's
// settings sheets. `forwardRef` keeps it compatible with
// react-hook-form and native DOM handlers.
const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, trailing, required, className = "", ...rest },
  ref
) {
  return (
    <label className="block">
      {label && (
        <span className="block text-[12px] font-medium text-[var(--label-secondary)] mb-1.5 uppercase tracking-wider">
          {label}
          {required && (
            <span className="text-[var(--system-red)] ml-0.5">*</span>
          )}
        </span>
      )}
      <span className="relative block">
        <input
          ref={ref}
          {...rest}
          className={`w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition ${trailing ? "pr-12" : ""} ${className}`}
        />
        {trailing && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
            {trailing}
          </span>
        )}
      </span>
      {hint && (
        <span className="block text-[12px] text-[var(--label-secondary)] mt-1.5 leading-snug">
          {hint}
        </span>
      )}
    </label>
  );
});

export default Input;
