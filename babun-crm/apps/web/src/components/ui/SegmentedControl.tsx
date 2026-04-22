"use client";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  /** Stretch the control to fill its container. Default true. */
  fullWidth?: boolean;
}

// Telegram segmented control — grey fill track with a raised
// surface-card pill behind the active option (same pattern as iOS
// but retuned against the Telegram palette). Used for the
// "День / 3 дня / Неделя" calendar picker and similar view toggles.
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  fullWidth = true,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`inline-flex rounded-[9px] bg-[var(--fill-tertiary)] p-[2px] ${fullWidth ? "w-full" : ""}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex-1 h-8 rounded-[7px] text-[13px] font-semibold transition ${
              active
                ? "bg-[var(--surface-card)] text-[var(--label)] shadow-[var(--shadow-card)]"
                : "text-[var(--label-secondary)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
