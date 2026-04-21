"use client";

interface IOSSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

// Telegram-style switch — 46×28 track, accent-blue on-state (Telegram
// uses the brand colour for switches, not iOS green). Name kept as
// IOSSwitch for backwards import compatibility across the codebase.
export default function IOSSwitch({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
}: IOSSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-[46px] h-[28px] rounded-full transition-colors flex-shrink-0 ${
        checked ? "bg-[var(--accent)]" : "bg-[var(--fill-primary)]"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      <span
        className={`absolute top-[2px] left-[2px] w-6 h-6 bg-white rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}
