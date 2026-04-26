"use client";

import { useState } from "react";
import { Banknote, CreditCard, ArrowLeftRight, FileText } from "lucide-react";
import type { AppointmentPayment } from "@/lib/appointments";
import { formatEUR } from "@babun/shared/common/utils/money";

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
      <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
        Оплата · {formatEUR(total)}
      </div>

      {/* Compact payment buttons row */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => payAll("cash")}
          className="h-11 rounded-[10px] bg-[var(--system-green)] text-[var(--label-on-accent)] text-[13px] font-semibold active:opacity-90 flex items-center justify-center gap-1.5"
        >
          <Banknote size={16} strokeWidth={2} /> Нал
        </button>
        <button
          type="button"
          onClick={() => payAll("card")}
          className="h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[13px] font-semibold active:bg-[var(--accent-pressed)] flex items-center justify-center gap-1.5"
        >
          <CreditCard size={16} strokeWidth={2} /> Карта
        </button>
        <button
          type="button"
          onClick={() => setSplitOpen((v) => !v)}
          className="h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[13px] font-semibold text-[var(--label)] active:bg-[var(--fill-secondary)] flex items-center justify-center gap-1.5"
        >
          <ArrowLeftRight size={16} strokeWidth={2} /> Сплит
        </button>
      </div>

      {splitOpen && (
        <div className="p-3 rounded-[14px] bg-[var(--fill-tertiary)] border border-[var(--separator)] space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-20 text-[13px] text-[var(--label-secondary)]">Наличкой</span>
            <div className="flex-1 flex items-center gap-1 bg-[var(--surface-card)] rounded-[10px] border border-[var(--separator)] px-2 h-11">
              <span className="text-[15px] text-[var(--label-tertiary)]">€</span>
              <input
                type="number"
                inputMode="decimal"
                value={cashStr}
                onChange={(e) => setCashStr(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0"
                className="flex-1 bg-transparent text-[15px] font-bold text-[var(--label)] tabular-nums focus:outline-none placeholder:text-[var(--label-tertiary)]"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 text-[13px] text-[var(--label-secondary)]">Картой</span>
            <div className="flex-1 flex items-center gap-1 bg-[var(--surface-card)] rounded-[10px] border border-[var(--separator)] px-2 h-11">
              <span className="text-[15px] text-[var(--label-tertiary)]">€</span>
              <div className="flex-1 text-[15px] font-bold text-[var(--label)] tabular-nums">
                {cardVal}
              </div>
              <span className="text-[12px] text-[var(--label-tertiary)] uppercase">авто</span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-[var(--separator)]">
            <span className="text-[13px] text-[var(--label-secondary)]">Итого</span>
            <span className="text-[15px] font-bold text-[var(--label)] tabular-nums">
              {formatEUR(total)}
            </span>
          </div>
          <button
            type="button"
            onClick={paySplit}
            disabled={!splitValid}
            className="w-full h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.99] disabled:bg-[var(--fill-primary)] disabled:text-[var(--label-tertiary)]"
          >
            Подтвердить сплит
          </button>
        </div>
      )}

      {/* Invoice link — quiet */}
      <button
        type="button"
        onClick={payInvoice}
        className="w-full text-[13px] text-[var(--accent)] active:opacity-70 py-2 inline-flex items-center justify-center gap-1.5"
      >
        <FileText size={14} strokeWidth={2} /> Выставить счёт компании →
      </button>
    </div>
  );
}
