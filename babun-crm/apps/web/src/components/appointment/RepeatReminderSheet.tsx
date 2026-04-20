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
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[360px] bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-3 border-b border-slate-100">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Напомнить о повторе
          </div>
          <div className="mt-1 text-[15px] font-semibold text-slate-900">
            {clientName}
          </div>
          {serviceSummary && (
            <div className="text-[12px] text-slate-500 truncate mt-0.5">
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
              className={`w-full flex items-center justify-between px-3 py-3 rounded-xl border transition ${
                months === p.months
                  ? "bg-violet-50 border-violet-300"
                  : "bg-white border-slate-200 active:bg-slate-50"
              }`}
            >
              <div className="text-left">
                <div className="text-[14px] font-semibold text-slate-900">
                  {p.label}
                </div>
                <div className="text-[11px] text-slate-500">{p.hint}</div>
              </div>
              <div className="text-[11px] font-medium text-slate-400 tabular-nums">
                {addMonthsYYYYMMDD(lastDate, p.months).slice(5)}
              </div>
            </button>
          ))}
        </div>

        <div className="px-4 pt-1 pb-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Заметка (необязательно)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="например: проверить пульт"
            className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-violet-400"
          />
        </div>

        <div className="px-4 pt-1 pb-2 text-[12px] text-slate-500 text-center">
          Напомним <span className="font-semibold text-slate-700 tabular-nums">{nextDate}</span>
        </div>

        <div className="px-4 pb-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-slate-100 text-slate-700 text-[14px] font-medium active:bg-slate-200"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(months, note);
              onClose();
            }}
            className="flex-1 h-11 rounded-xl bg-violet-600 text-white text-[14px] font-semibold active:scale-[0.99]"
          >
            Создать
          </button>
        </div>
      </div>
    </div>
  );
}
