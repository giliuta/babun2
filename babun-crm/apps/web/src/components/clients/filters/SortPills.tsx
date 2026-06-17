"use client";

// v809 — ПОРЯДОК section: single-select 2-column pills mapping to the
// 4 existing SortKeys. Selected = accent-tint + accent border + check.

import { Check } from "@babun/shared/icons";
import { haptic } from "@/lib/haptics";
import type { SortKey } from "./useClientFilters";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Недавние",
  name: "Имя",
  revenue: "Доход",
  equipment: "A/C",
};

const ORDER: SortKey[] = ["recent", "name", "revenue", "equipment"];

interface SortPillsProps {
  value: SortKey;
  onChange: (next: SortKey) => void;
}

export function SortPills({ value, onChange }: SortPillsProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ORDER.map((k) => {
        const active = value === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => {
              haptic("tap");
              onChange(k);
            }}
            className={`h-11 px-3 rounded-[12px] text-[14px] font-semibold flex items-center justify-center gap-1.5 border transition press-scale ${
              active
                ? "bg-[var(--accent-tint)] border-[var(--accent)] text-[var(--accent)]"
                : "bg-[var(--surface-card-secondary)] border-transparent text-[var(--label)] active:bg-[var(--fill-quaternary)]"
            }`}
          >
            {active && (
              <span className="animate-check-pop">
                <Check size={14} strokeWidth={2.6} />
              </span>
            )}
            {SORT_LABELS[k]}
          </button>
        );
      })}
    </div>
  );
}
