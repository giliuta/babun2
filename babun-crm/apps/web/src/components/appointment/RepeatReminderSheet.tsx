"use client";

import { useMemo, useState } from "react";
import { addMonthsYYYYMMDD } from "@/lib/recurring";

interface RepeatReminderSheetProps {
  open: boolean;
  clientName: string;
  serviceSummary: string;
  lastDate: string;
  onClose: () => void;
  onConfirm: (months: number, note: string) => void;
}

// Centred popup (per product rule — never a bottom sheet). Offers four
// common intervals for HVAC A/C work: 3 months (filter), 6 months
// (seasonal cleaning), 12 months (annual service), custom. Shows the
// computed next-call-date so the dispatcher can sanity-check before
// confirming.
const PRESETS: { months: number; label: string; hint: string }[] = [
  { months: 3, label: "Через 3 мес", hint: "фильтр, быстрая чистка" },
  { months: 6, label: "Через 6 мес", hint: "сезонная чистка" },
  { months: 12, label: "Через 1 год", hint: "годовое обслуживание" },
];

export default function RepeatReminderSheet({
  open,
  clientName,
  serviceSummary,
  lastDate,
  onClose,
  onConfirm,
}: RepeatReminderSheetProps) {
  const [months, setMonths] = useState(6);
  const [note, setNote] = useState("");

  const nextDate = useMemo(
    () => addMonthsYYYYMMDD(lastDate, months),
    [lastDate, months]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[360px] bg-[var(--surface-card)] rounded-[20px] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-3 border-b border-[var(--separator)]">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
            Напомнить о повторе
          </div>
          <div className="mt-1 text-[17px] font-semibold tracking-tight text-[var(--label)]">
            {clientName}
          </div>
          {serviceSummary && (
            <div className="text-[13px] text-[var(--label-secondary)] truncate mt-0.5">
              {serviceSummary}
            </div>
          )}
        </div>

        <div className="px-4 pt-3 pb-2 space-y-2">
          {PRESETS.map((p) => (
            <button
              key={p.months}
              type="button"
              onClick={() => setMonths(p.months)}
              className={`w-full flex items-center justify-between px-3 py-3 min-h-[48px] rounded-[14px] border transition ${
                months === p.months
                  ? "bg-[var(--accent-tint)] border-[var(--accent)]"
                  : "bg-[var(--surface-card)] border-[var(--separator)] active:bg-[var(--fill-quaternary)]"
              }`}
            >
              <div className="text-left">
                <div className="text-[15px] font-semibold text-[var(--label)]">
                  {p.label}
                </div>
                <div className="text-[12px] text-[var(--label-secondary)]">{p.hint}</div>
              </div>
              <div className="text-[12px] font-medium text-[var(--label-tertiary)] tabular-nums">
                {addMonthsYYYYMMDD(lastDate, p.months).slice(5)}
              </div>
            </button>
          ))}
        </div>

        <div className="px-4 pt-1 pb-2">
          <label className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
            Заметка (необязательно)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="например: проверить пульт"
            className="mt-1 w-full h-11 px-3.5 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
          />
        </div>

        <div className="px-4 pt-1 pb-2 text-[13px] text-[var(--label-secondary)] text-center">
          Напомним <span className="font-semibold text-[var(--label)] tabular-nums">{nextDate}</span>
        </div>

        <div className="px-4 pb-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--label)] text-[15px] font-medium active:bg-[var(--fill-secondary)]"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(months, note);
              onClose();
            }}
            className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.99]"
          >
            Создать
          </button>
        </div>
      </div>
    </div>
  );
}
