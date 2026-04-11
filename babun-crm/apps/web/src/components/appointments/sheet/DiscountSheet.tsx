"use client";

import { useEffect, useState } from "react";
import BottomSheet from "./BottomSheet";

interface DiscountSheetProps {
  open: boolean;
  onClose: () => void;
  subtotal: number; // сумма из услуг
  discount: number; // текущая скидка в EUR
  onConfirm: (next: number) => void;
}

export default function DiscountSheet({
  open,
  onClose,
  subtotal,
  discount,
  onConfirm,
}: DiscountSheetProps) {
  const [value, setValue] = useState(discount);
  const [mode, setMode] = useState<"amount" | "percent">("amount");

  useEffect(() => {
    if (open) {
      setValue(discount);
      setMode("amount");
    }
  }, [open, discount]);

  const final = Math.max(0, subtotal - value);

  const handleMode = (next: "amount" | "percent") => {
    if (next === mode) return;
    if (next === "percent") {
      // Convert current amount to percent
      const pct = subtotal > 0 ? Math.round((value / subtotal) * 100) : 0;
      setValue(pct);
    } else {
      // Convert percent back to amount
      const amt = Math.round((value / 100) * subtotal);
      setValue(amt);
    }
    setMode(next);
  };

  const handleConfirm = () => {
    const amt =
      mode === "percent"
        ? Math.round((value / 100) * subtotal)
        : value;
    onConfirm(Math.max(0, Math.min(subtotal, amt)));
    onClose();
  };

  const displayedDiscountAmount =
    mode === "percent"
      ? Math.round((value / 100) * subtotal)
      : value;
  const displayedFinal = Math.max(0, subtotal - displayedDiscountAmount);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Скидка"
      footer={
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full h-14 bg-indigo-600 text-white rounded-xl font-semibold text-[15px] active:scale-[0.98] transition"
        >
          Применить
        </button>
      }
    >
      <div className="p-4 space-y-5">
        {/* Summary */}
        <div className="bg-indigo-50 rounded-xl p-4 space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-gray-600">Из услуг</span>
            <span className="text-[15px] font-medium text-gray-900 tabular-nums">
              {subtotal} €
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-gray-600">Скидка</span>
            <span className="text-[15px] font-medium text-red-600 tabular-nums">
              − {displayedDiscountAmount} €
            </span>
          </div>
          <div className="border-t border-indigo-200 my-1" />
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold text-gray-900">Итого</span>
            <span className="text-[22px] font-bold text-indigo-700 tabular-nums">
              {displayedFinal} €
            </span>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
          <button
            type="button"
            onClick={() => handleMode("amount")}
            className={`flex-1 h-10 rounded-lg text-[13px] font-semibold transition ${
              mode === "amount"
                ? "bg-white text-indigo-700 shadow"
                : "text-gray-500"
            }`}
          >
            EUR
          </button>
          <button
            type="button"
            onClick={() => handleMode("percent")}
            className={`flex-1 h-10 rounded-lg text-[13px] font-semibold transition ${
              mode === "percent"
                ? "bg-white text-indigo-700 shadow"
                : "text-gray-500"
            }`}
          >
            %
          </button>
        </div>

        {/* Value input */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5 px-1">
            Размер скидки
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={value}
              onChange={(e) => setValue(Math.max(0, Number(e.target.value) || 0))}
              className="flex-1 h-14 px-4 bg-gray-100 rounded-xl text-[17px] font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
            />
            <span className="text-[17px] text-gray-500">
              {mode === "amount" ? "€" : "%"}
            </span>
          </div>
        </div>

        {value > 0 && (
          <button
            type="button"
            onClick={() => setValue(0)}
            className="w-full h-11 text-[13px] font-medium text-red-600 active:scale-[0.98]"
          >
            Убрать скидку
          </button>
        )}

        {/* Subtotal line just for clarity */}
        <div className="text-center text-[11px] text-gray-400">
          Финальная сумма — {displayedFinal} €
        </div>
        <div className="hidden">{final}</div>
      </div>
    </BottomSheet>
  );
}
