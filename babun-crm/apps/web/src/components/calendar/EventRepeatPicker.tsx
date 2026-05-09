"use client";

// STORY-056 — Bottom-sheet picker for repeat rule on the unified
// EventSheet. Replaces the inline RepeatPickerRow with a single
// tappable row + a sheet that opens on tap.
//
// Reuses the existing PersonalEventRepeat shape so persisted
// appointments don't need a migration. The "Завершить" date row
// stays at the bottom of the sheet, mirroring iOS Calendar.

import { useState } from "react";
import SheetShell from "@/components/ui/SheetShell";
import type { PersonalEventRepeat } from "@babun/shared/local/appointments";

interface EventRepeatPickerProps {
  open: boolean;
  onClose: () => void;
  value: PersonalEventRepeat;
  onChange: (next: PersonalEventRepeat) => void;
}

interface RepeatOption {
  value: PersonalEventRepeat["kind"];
  label: string;
}

const OPTIONS: RepeatOption[] = [
  { value: "none", label: "Не повторять" },
  { value: "daily", label: "Ежедневно" },
  { value: "weekdays", label: "По будням (Пн–Пт)" },
  { value: "weekly", label: "Каждую неделю" },
  { value: "biweekly", label: "Каждые 2 недели" },
  { value: "monthly", label: "Каждый месяц" },
  { value: "yearly", label: "Каждый год" },
];

export function formatRepeatLabel(v: PersonalEventRepeat): string {
  const opt = OPTIONS.find((o) => o.value === v.kind);
  return opt?.label ?? "Не повторять";
}

export default function EventRepeatPicker({
  open,
  onClose,
  value,
  onChange,
}: EventRepeatPickerProps) {
  const [draft, setDraft] = useState<PersonalEventRepeat>(value);

  const setKind = (k: PersonalEventRepeat["kind"]) => {
    if (k === "none") {
      setDraft({ kind: "none" });
      return;
    }
    const until = "until" in draft && draft.until ? draft.until : undefined;
    setDraft({ kind: k, until } as PersonalEventRepeat);
  };

  const setUntil = (next: string | undefined) => {
    if (draft.kind === "none") return;
    setDraft({ kind: draft.kind, until: next } as PersonalEventRepeat);
  };

  const handleConfirm = () => {
    onChange(draft);
    onClose();
  };

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      title="Повтор"
      subtitle="Как часто событие повторяется"
      height="auto"
      footer={
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.99] transition"
        >
          Готово
        </button>
      }
    >
      <div className="divide-y divide-[var(--separator)] bg-[var(--surface-card)]">
        {OPTIONS.map((opt) => {
          const active = draft.kind === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setKind(opt.value)}
              className={`w-full flex items-center justify-between px-4 py-3 min-h-[48px] text-[15px] active:bg-[var(--fill-quaternary)] transition ${
                active
                  ? "text-[var(--accent)] font-semibold"
                  : "text-[var(--label)]"
              }`}
            >
              <span>{opt.label}</span>
              {active && (
                <span className="text-[var(--accent)] text-[16px] font-semibold">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      {draft.kind !== "none" && (
        <div
          className="mt-3 px-4 py-3 bg-[var(--surface-card)] flex items-center gap-2"
          style={{ WebkitUserSelect: "text", userSelect: "text" } as React.CSSProperties}
        >
          <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--label-secondary)] w-[80px] shrink-0">
            Завершить
          </div>
          <input
            type="date"
            value={"until" in draft && draft.until ? draft.until : ""}
            onChange={(e) => setUntil(e.target.value || undefined)}
            className="flex-1 h-10 px-3 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
          />
          {"until" in draft && draft.until && (
            <button
              type="button"
              onClick={() => setUntil(undefined)}
              className="text-[13px] font-semibold text-[var(--accent)] px-2 py-1 active:opacity-60"
            >
              Снять
            </button>
          )}
        </div>
      )}
    </SheetShell>
  );
}
