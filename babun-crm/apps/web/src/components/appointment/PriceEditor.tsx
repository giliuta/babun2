"use client";

import { useState } from "react";
import type { Discount } from "@/lib/appointments";

interface PriceEditorProps {
  catalogPrice: number;
  currentPricePerUnit: number;
  currentDiscount?: Discount | null;
  onApply: (pricePerUnit: number, discount: Discount | null) => void;
  onClose: () => void;
}

const DISCOUNT_REASONS = ["Постоянный", "VIP", "Промо"];

// Inline editor внутри строки услуги. Три варианта:
//  1) Своя цена — просто число (перезаписывает pricePerUnit)
//  2) Скидка суммой — Discount { type: 'fixed', value }
//  3) Скидка процентом — Discount { type: 'percent', value }
// Применяется к конкретной услуге (AppointmentService.discount).
export default function PriceEditor({
  catalogPrice,
  currentPricePerUnit,
  currentDiscount,
  onApply,
  onClose,
}: PriceEditorProps) {
  const [mode, setMode] = useState<"price" | "fixed" | "percent">(
    currentDiscount
      ? currentDiscount.type === "fixed"
        ? "fixed"
        : "percent"
      : "price"
  );
  const [priceStr, setPriceStr] = useState(String(currentPricePerUnit));
  const [valueStr, setValueStr] = useState(
    currentDiscount ? String(currentDiscount.value) : ""
  );
  const [reason, setReason] = useState(currentDiscount?.reason ?? "");

  const handleApply = () => {
    if (mode === "price") {
      const n = Number(priceStr) || 0;
      onApply(n, null);
    } else {
      const v = Number(valueStr) || 0;
      onApply(catalogPrice, {
        type: mode === "fixed" ? "fixed" : "percent",
        value: v,
        reason: reason.trim() || undefined,
      });
    }
    onClose();
  };

  return (
    <div className="mt-2 p-3 rounded-xl bg-white border border-slate-200 space-y-2.5">
      <div className="text-[11px] text-slate-500">
        Стандартная: <span className="font-semibold">{catalogPrice}€/шт</span>
      </div>

      <div className="inline-flex rounded-lg bg-slate-100 p-1 text-[12px] font-semibold">
        <ModeBtn label="Своя цена" active={mode === "price"} onClick={() => setMode("price")} />
        <ModeBtn label="€ Скидка" active={mode === "fixed"} onClick={() => setMode("fixed")} />
        <ModeBtn label="% Скидка" active={mode === "percent"} onClick={() => setMode("percent")} />
      </div>

      {mode === "price" ? (
        <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 h-11 border border-slate-200">
          <span className="text-[14px] text-slate-400">€</span>
          <input
            type="number"
            inputMode="decimal"
            value={priceStr}
            onChange={(e) => setPriceStr(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="0"
            className="flex-1 bg-transparent text-[16px] font-bold text-slate-900 tabular-nums focus:outline-none"
          />
          <span className="text-[11px] text-slate-400 uppercase">за шт</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 h-11 border border-slate-200">
            <span className="text-[14px] text-slate-400">
              {mode === "fixed" ? "€" : "%"}
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={valueStr}
              onChange={(e) => setValueStr(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0"
              className="flex-1 bg-transparent text-[16px] font-bold text-slate-900 tabular-nums focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <div className="text-[11px] text-slate-500">Причина</div>
            <div className="flex gap-1.5 flex-wrap">
              {DISCOUNT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`h-8 px-2.5 rounded-lg text-[12px] font-semibold transition ${
                    reason === r
                      ? "bg-violet-600 text-white"
                      : "bg-slate-100 text-slate-700"
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
              className="w-full h-9 px-3 rounded-lg bg-white border border-slate-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-10 rounded-lg bg-slate-100 text-[13px] font-semibold text-slate-700 active:bg-slate-200"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="flex-[2] h-10 rounded-lg bg-violet-600 text-white text-[13px] font-semibold active:scale-[0.99]"
        >
          Применить
        </button>
      </div>
    </div>
  );
}

function ModeBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-md transition ${
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
      }`}
    >
      {label}
    </button>
  );
}
