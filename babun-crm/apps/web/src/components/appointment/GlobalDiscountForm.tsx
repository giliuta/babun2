"use client";

import { useState } from "react";
import type { Discount } from "@/lib/appointments";

interface GlobalDiscountFormProps {
  discount: Discount | null;
  onChange: (next: Discount | null) => void;
}

const REASONS = ["Постоянный", "VIP", "Промо"];
// Ручной ввод % остаётся через переключатель €/% — но типичный кейс
// в сервисе (клиент просит «сделай скидку 10 евро») — это fixed €.
const FIXED_AMOUNT_PRESETS = [5, 10, 15, 20];

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
          <div className="flex items-center gap-2 bg-[rgba(255,59,48,0.08)] border border-[rgba(255,59,48,0.25)] rounded-xl px-3 py-2">
            <div className="flex-1 text-[13px] text-[var(--system-red)] font-semibold">
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
              className="text-[12px] font-semibold text-[var(--system-red)] active:opacity-60 px-2"
            >
              Изменить
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-[12px] font-semibold text-[var(--label-secondary)] active:opacity-60 px-1"
              aria-label="Убрать"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full h-10 rounded-xl border-2 border-dashed border-[var(--separator)] text-[13px] font-semibold text-[var(--label-secondary)] active:bg-[var(--fill-tertiary)]"
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
      <div className="p-3 rounded-xl bg-[var(--surface-card)] border-2 border-[rgba(255,59,48,0.35)] space-y-2.5">
        <div className="text-[12px] font-semibold text-[var(--label)]">
          Скидка на всю запись
        </div>
        <div className="inline-flex rounded-lg bg-[var(--fill-primary)] p-1 text-[12px] font-semibold">
          <button
            type="button"
            onClick={() => setType("fixed")}
            className={`px-3 py-1 rounded-md ${
              type === "fixed" ? "bg-white shadow-sm text-[var(--label)]" : "text-[var(--label-secondary)]"
            }`}
          >
            € Сумма
          </button>
          <button
            type="button"
            onClick={() => setType("percent")}
            className={`px-3 py-1 rounded-md ${
              type === "percent" ? "bg-white shadow-sm text-[var(--label)]" : "text-[var(--label-secondary)]"
            }`}
          >
            % Процент
          </button>
        </div>
        {/* Quick chips — самые частые суммы в сервисе на Кипре. Тап
            чипса ставит fixed-€ режим и значение одним движением. */}
        <div className="flex gap-1.5 flex-wrap">
          {FIXED_AMOUNT_PRESETS.map((n) => {
            const active = type === "fixed" && Number(value) === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setType("fixed");
                  setValue(String(n));
                }}
                className={`h-8 px-3 rounded-lg text-[13px] font-semibold tabular-nums transition ${
                  active
                    ? "bg-[var(--system-red)] text-white"
                    : "bg-[var(--fill-primary)] text-[var(--label)] active:bg-[var(--fill-secondary)]"
                }`}
              >
                −€{n}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 bg-[var(--fill-tertiary)] rounded-lg px-3 h-11 border border-[var(--separator)]">
          <span className="text-[14px] text-[var(--label-tertiary)]">
            {type === "fixed" ? "€" : "%"}
          </span>
          <input
            type="number"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="0"
            className="flex-1 bg-transparent text-[16px] font-bold text-[var(--label)] tabular-nums focus:outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <div className="text-[11px] text-[var(--label-secondary)]">Причина</div>
          <div className="flex gap-1.5 flex-wrap">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`h-8 px-2.5 rounded-lg text-[12px] font-semibold ${
                  reason === r ? "bg-[var(--system-red)] text-white" : "bg-[var(--fill-primary)] text-[var(--label)]"
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
            className="w-full h-9 px-3 rounded-lg bg-[var(--surface-card)] border border-[var(--separator)] text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--system-red)]"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 h-10 rounded-lg bg-[var(--fill-primary)] text-[13px] font-semibold text-[var(--label)]"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={apply}
            className="flex-[2] h-10 rounded-lg bg-[var(--system-red)] text-white text-[13px] font-semibold active:scale-[0.99]"
          >
            Применить
          </button>
        </div>
      </div>
    </div>
  );
}
