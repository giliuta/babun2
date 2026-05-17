"use client";

import { IOSSwitch } from "@/components/ui";

// v612 — Edit-mode cancellation toggle + preset reason picker.
// Hidden in create (per Sprint #4 §2 — can't cancel a record that
// doesn't exist yet) and once the record is completed. Extracted
// from AppointmentSheet as part of §9 decomposition.

const CANCEL_PRESETS = [
  "Клиент перенёс",
  "Не дозвонились",
  "Погода",
  "Нет материала",
  "Клиент не на месте",
  "Другое",
] as const;

interface CancelToggleBlockProps {
  cancelFlag: boolean;
  cancelReason: string;
  onFlagChange: (next: boolean) => void;
  onReasonChange: (next: string) => void;
}

export default function CancelToggleBlock({
  cancelFlag,
  cancelReason,
  onFlagChange,
  onReasonChange,
}: CancelToggleBlockProps) {
  return (
    <>
      <div className="px-4 pt-3 flex items-center justify-between">
        <div>
          <div className="text-[15px] font-semibold text-[var(--label)]">
            Запись отменена
          </div>
          <div className="text-[12px] text-[var(--label-secondary)]">
            Клиент отказался от услуги
          </div>
        </div>
        <IOSSwitch
          checked={cancelFlag}
          onChange={onFlagChange}
          ariaLabel="Запись отменена"
        />
      </div>
      {cancelFlag && (
        <div className="px-4 pt-2">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--system-red)] mb-1.5">
            Причина отмены
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {CANCEL_PRESETS.map((preset) => {
              const active = cancelReason === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onReasonChange(active ? "" : preset)}
                  className={`px-3 h-8 rounded-full text-[13px] font-semibold transition active:scale-[0.97] ${
                    active
                      ? "bg-[var(--system-red)] text-white"
                      : "bg-[var(--fill-tertiary)] text-[var(--label)] border border-[var(--separator)]"
                  }`}
                >
                  {preset}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={cancelReason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Или своя причина…"
            className="w-full h-11 px-3.5 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
          />
        </div>
      )}
    </>
  );
}
