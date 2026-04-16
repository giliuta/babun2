"use client";

import { useState } from "react";
import type { Discount } from "@/lib/appointments";

interface GlobalDiscountFormProps {
  discount: Discount | null;
  onChange: (next: Discount | null) => void;
}

const REASONS = ["Постоянный", "VIP", "Промо"];

// Блок 8: «Скидка на всё». В свёрнутом виде — кнопка
// «🏷 Добавить скидку на всё» / бейдж «🏷 −10%».
// При тапе раскрывается форма.
export default function GlobalDiscountForm({
  discount,
  onChange,
}: GlobalDiscountFormProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"fixed" | "percent">(
    discount?.type ?? "percent"
  );
  const [value, setValue] = useState(discount ? String(discount.value) : "");
  const [reason, setReason] = useState(discount?.reason ?? "");

  if (!open) {
    return (
      <div className="px-4 pt-3">
        {discount ? (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            <div className="flex-1 text-[13px] text-rose-700 font-semibold">
              🏷{" "}
              {discount.type === "percent"
                ? `Скидка ${discount.value}%`
                : `Скидка −€${discount.value}`}
              {discount.reason && ` · ${discount.reason}`}
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setType(discount.type);
                setValue(String(discount.value));
                setReason(discount.reason ?? "");
              }}
              className="text-[12px] font-semibold text-rose-600 active:opacity-60 px-2"
            >
              Изменить
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-[12px] font-semibold text-slate-500 active:opacity-60 px-1"
              aria-label="Убрать"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full h-10 rounded-xl border-2 border-dashed border-slate-300 text-[13px] font-semibold text-slate-600 active:bg-slate-50"
          >
            🏷 Добавить скидку на всё
          </button>
        )}
      </div>
    );
  }

  const apply = () => {
    const v = Number(value) || 0;
    if (v <= 0) {
      onChange(null);
      setOpen(false);
      return;
    }
    onChange({ type, value: v, reason: reason.trim() || undefined });
    setOpen(false);
  };

  return (
    <div className="px-4 pt-3">
      <div className="p-3 rounded-xl bg-white border-2 border-rose-300 space-y-2.5">
        <div className="text-[12px] font-semibold text-slate-700">
          Скидка на всю запись
        </div>
        <div className="inline-flex rounded-lg bg-slate-100 p-1 text-[12px] font-semibold">
          <button
            type="button"
            onClick={() => setType("fixed")}
            className={`px-3 py-1 rounded-md ${
              type === "fixed" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
            }`}
          >
            € Сумма
          </button>
          <button
            type="button"
            onClick={() => setType("percent")}
            className={`px-3 py-1 rounded-md ${
              type === "percent" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
            }`}
          >
            % Процент
          </button>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 h-11 border border-slate-200">
          <span className="text-[14px] text-slate-400">
            {type === "fixed" ? "€" : "%"}
          </span>
          <input
            type="number"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="0"
            className="flex-1 bg-transparent text-[16px] font-bold text-slate-900 tabular-nums focus:outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <div className="text-[11px] text-slate-500">Причина</div>
          <div className="flex gap-1.5 flex-wrap">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`h-8 px-2.5 rounded-lg text-[12px] font-semibold ${
                  reason === r ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Свой текст"
            className="w-full h-9 px-3 rounded-lg bg-white border border-slate-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 h-10 rounded-lg bg-slate-100 text-[13px] font-semibold text-slate-700"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={apply}
            className="flex-[2] h-10 rounded-lg bg-rose-500 text-white text-[13px] font-semibold active:scale-[0.99]"
          >
            Применить
          </button>
        </div>
      </div>
    </div>
  );
}
