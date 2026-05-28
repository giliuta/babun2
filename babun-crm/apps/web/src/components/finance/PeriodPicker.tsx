"use client";

// Six-tab period switcher for /finances. Compact pill row that sits
// in the sticky finance header. «Произвольно» is parked for now — the
// custom date-range picker comes in Phase D.

import {
  PERIOD_LABELS,
  PERIOD_ORDER,
  type PeriodKind,
} from "@/lib/finance/period";

interface PeriodPickerProps {
  value: PeriodKind;
  onChange: (kind: PeriodKind) => void;
}

export default function PeriodPicker({ value, onChange }: PeriodPickerProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto py-1 px-1 -mx-1">
      {PERIOD_ORDER.map((kind) => {
        const active = value === kind;
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onChange(kind)}
            disabled={kind === "custom"}
            className={`flex-shrink-0 h-7 px-3 rounded-full text-[12px] font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              active
                ? "bg-[var(--accent)] text-[var(--label-on-accent)] border-transparent"
                : "bg-[var(--surface-card)] text-[var(--label)] border-[var(--separator)]"
            }`}
          >
            {PERIOD_LABELS[kind]}
          </button>
        );
      })}
    </div>
  );
}
