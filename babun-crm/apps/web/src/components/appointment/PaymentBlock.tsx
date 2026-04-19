"use client";

import { useState } from "react";
import type { AppointmentPayment } from "@/lib/appointments";
import { formatEUR } from "@/lib/money";

interface PaymentBlockProps {
  total: number;
  onPay: (payment: AppointmentPayment) => void;
}

// Блок 9 (status === pending). Три варианта: Нал / Карта / Сплит +
// счёт компании мелкой ссылкой. При выборе сплита поле «Наличкой»
// вводится, «Картой» считается автоматически.
export default function PaymentBlock({ total, onPay }: PaymentBlockProps) {
  const [splitOpen, setSplitOpen] = useState(false);
  const [cashStr, setCashStr] = useState("");
  const now = () => new Date().toISOString();

  const payAll = (method: "cash" | "card") => {
    onPay({
      method,
      cashAmount: method === "cash" ? total : 0,
      cardAmount: method === "card" ? total : 0,
      paid_at: now(),
    });
  };

  const cashVal = Number(cashStr) || 0;
  const cardVal = Math.max(0, total - cashVal);
  const splitValid = cashVal > 0 && cashVal < total;

  const payInvoice = () => {
    onPay({
      method: "invoice",
      cashAmount: 0,
      cardAmount: 0,
      paid_at: now(),
    });
  };

  const paySplit = () => {
    if (!splitValid) return;
    onPay({
      method: "split",
      cashAmount: cashVal,
      cardAmount: cardVal,
      paid_at: now(),
    });
  };

  return (
    <div className="px-4 pt-3 space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        Оплата · {formatEUR(total)}
      </div>

      {/* Compact payment buttons row */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => payAll("cash")}
          className="h-9 rounded-lg bg-emerald-500 text-white text-[12px] font-semibold active:bg-emerald-600 flex items-center justify-center gap-1"
        >
          💵 Нал
        </button>
        <button
          type="button"
          onClick={() => payAll("card")}
          className="h-9 rounded-lg bg-sky-500 text-white text-[12px] font-semibold active:bg-sky-600 flex items-center justify-center gap-1"
        >
          💳 Карта
        </button>
        <button
          type="button"
          onClick={() => setSplitOpen((v) => !v)}
          className="h-9 rounded-lg bg-white border border-slate-200 text-[12px] font-semibold text-slate-700 active:bg-slate-50 flex items-center justify-center gap-1"
        >
          ↕ Сплит
        </button>
      </div>

      {splitOpen && (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-20 text-[12px] text-slate-600">Наличкой</span>
            <div className="flex-1 flex items-center gap-1 bg-white rounded-lg border border-slate-200 px-2 h-10">
              <span className="text-[14px] text-slate-400">€</span>
              <input
                type="number"
                inputMode="decimal"
                value={cashStr}
                onChange={(e) => setCashStr(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0"
                className="flex-1 bg-transparent text-[15px] font-bold text-slate-900 tabular-nums focus:outline-none placeholder-slate-300"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 text-[12px] text-slate-600">Картой</span>
            <div className="flex-1 flex items-center gap-1 bg-white rounded-lg border border-slate-200 px-2 h-10">
              <span className="text-[14px] text-slate-400">€</span>
              <div className="flex-1 text-[15px] font-bold text-slate-900 tabular-nums">
                {cardVal}
              </div>
              <span className="text-[10px] text-slate-400 uppercase">авто</span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-200">
            <span className="text-[12px] text-slate-600">Итого</span>
            <span className="text-[14px] font-bold text-slate-900 tabular-nums">
              {formatEUR(total)}
            </span>
          </div>
          <button
            type="button"
            onClick={paySplit}
            disabled={!splitValid}
            className="w-full h-11 rounded-lg bg-violet-600 text-white text-[13px] font-semibold active:scale-[0.99] disabled:bg-slate-300 disabled:text-slate-500"
          >
            Подтвердить сплит
          </button>
        </div>
      )}

      {/* Invoice link — quiet */}
      <button
        type="button"
        onClick={payInvoice}
        className="w-full text-[12px] text-slate-500 active:text-slate-700 py-2"
      >
        📄 Выставить счёт компании →
      </button>
    </div>
  );
}
