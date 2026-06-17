"use client";

// v809 — multi-select facet section (КОМАНДА / МЕТКА / ТЕГ). Each value
// is a pill row with a colour dot + contextual count. Count-0 unselected
// values render dimmed. Tapping toggles the value (live).

import { Check } from "@babun/shared/icons";
import { haptic } from "@/lib/haptics";
import type { FacetOption } from "./types";

interface FacetSectionProps {
  options: FacetOption[];
  selected: string[];
  counts: Record<string, number>;
  onToggle: (value: string) => void;
}

export function FacetSection({
  options,
  selected,
  counts,
  onToggle,
}: FacetSectionProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {options.map((opt) => {
        const on = selected.includes(opt.value);
        const count = counts[opt.value] ?? 0;
        const dimmed = !on && count === 0;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              haptic("tap");
              onToggle(opt.value);
            }}
            className={`flex items-center gap-2.5 h-11 px-3 rounded-[12px] border transition press-scale ${
              on
                ? "bg-[var(--accent-tint)] border-[var(--accent)]"
                : "bg-[var(--surface-card-secondary)] border-transparent active:bg-[var(--fill-quaternary)]"
            } ${dimmed ? "opacity-40" : ""}`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: opt.color }}
            />
            <span
              className={`flex-1 min-w-0 text-left text-[14px] font-medium truncate ${
                on ? "text-[var(--accent)]" : "text-[var(--label)]"
              }`}
            >
              {opt.label}
            </span>
            <span className="text-[12px] tabular-nums text-[var(--label-tertiary)] shrink-0">
              {count}
            </span>
            {on && (
              <span className="text-[var(--accent)] shrink-0 animate-check-pop">
                <Check size={16} strokeWidth={2.6} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
