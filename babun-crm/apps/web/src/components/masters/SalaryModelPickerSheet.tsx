"use client";

import { useEffect } from "react";
import { Check, X } from "lucide-react";
import {
  SALARY_MODEL_HINTS,
  SALARY_MODEL_LABELS,
  type SalaryModel,
} from "@/lib/masters";
import { haptic } from "@/lib/haptics";

interface SalaryModelPickerSheetProps {
  open: boolean;
  value: SalaryModel;
  onSelect: (next: SalaryModel) => void;
  onClose: () => void;
}

const ORDER: SalaryModel[] = [
  "percent_of_team",
  "percent_of_own",
  "per_visit",
  "monthly",
  "hourly",
  "hybrid",
  "none",
];

export default function SalaryModelPickerSheet({
  open,
  value,
  onSelect,
  onClose,
}: SalaryModelPickerSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const pick = (next: SalaryModel) => {
    haptic("tap");
    onSelect(next);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col overflow-hidden max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--separator)]">
          <div className="text-[17px] font-semibold tracking-tight text-[var(--label)]">
            Модель оплаты
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[var(--separator)]">
          {ORDER.map((m) => {
            const active = value === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => pick(m)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                  active
                    ? "bg-[var(--accent-tint)]"
                    : "active:bg-[var(--fill-quaternary)]"
                }`}
              >
                <span className="flex-1 min-w-0">
                  <span
                    className={`block text-[15px] ${
                      active
                        ? "text-[var(--accent)] font-semibold"
                        : "text-[var(--label)] font-medium"
                    }`}
                  >
                    {SALARY_MODEL_LABELS[m]}
                  </span>
                  <span className="block text-[12px] text-[var(--label-tertiary)] leading-snug mt-0.5">
                    {SALARY_MODEL_HINTS[m]}
                  </span>
                </span>
                {active && (
                  <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
