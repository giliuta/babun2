"use client";

interface IOSSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

// iOS system switch — 46×28 with emerald-500 on-state. Matches the
// native UISwitch track and knob proportions. Never use violet here;
// iOS switches are always green when on. See docs/design-language.md.
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
        checked ? "bg-[var(--system-green)]" : "bg-slate-300"
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
