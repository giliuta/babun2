"use client";

import { useState } from "react";
import { Banknote, CreditCard, ArrowLeftRight, FileText, Clock } from "@babun/shared/icons";
import type { AppointmentPayment } from "@babun/shared/local/appointments";
import { formatEUR } from "@babun/shared/common/utils/money";

interface PaymentBlockProps {
  total: number;
  onPay: (payment: AppointmentPayment) => void;
}

// Блок 9 (status === pending). Варианты: Нал / Карта / Раздельно /
// Частично (оплачена часть, остаток клиент донесёт) + счёт компании
// мелкой ссылкой.
//
// P0 #14 (CRM Core brief) — «Частично» открывает панель с одной
// суммой + выбором cash/card. Эмитит payment с cashAmount или
// cardAmount меньше total; AppointmentSheet.handlePay вычисляет
// payment_status='partial' автоматически (см. там же логику
// сравнения с total_amount).
export default function PaymentBlock({ total, onPay }: PaymentBlockProps) {
  const [splitOpen, setSplitOpen] = useState(false);
  const [partialOpen, setPartialOpen] = useState(false);
  const [cashStr, setCashStr] = useState("");
  const [partialAmountStr, setPartialAmountStr] = useState("");
  const [partialMethod, setPartialMethod] = useState<"cash" | "card">("cash");
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

  // P0 #14 — partial payment. Emits the same `AppointmentPayment`
  // shape but with cashAmount + cardAmount < total. handlePay on the
  // sheet side sees the shortfall and writes payment_status='partial'
  // + paid_amount=actualPaid, leaving the appointment marked completed
  // but still owing the remainder.
  const partialVal = Number(partialAmountStr) || 0;
  const partialValid = partialVal > 0 && partialVal < total;
  const payPartial = () => {
    if (!partialValid) return;
    onPay({
      method: partialMethod,
      cashAmount: partialMethod === "cash" ? partialVal : 0,
      cardAmount: partialMethod === "card" ? partialVal : 0,
      paid_at: now(),
    });
  };

  // v671 — guard against marking a €0 record as completed. Trigger:
  // dispatcher opens a draft saved without services (somehow, e.g.
  // legacy import or an earlier no-services save before v669), sees
  // PaymentBlock, taps «Нал» — handlePay fires with cashAmount=0 and
  // the record persists as payment_status=paid + status=completed
  // with €0. Finances reports a phantom €0 income entry; the operator
  // has no UI affordance to undo the «complete» status afterwards.
  // Now: when total === 0, the four payment buttons are disabled
  // with an inline hint pointing the operator to add a service first.
  const hasTotal = total > 0;

  return (
    <div className="px-4 pt-3 space-y-2">
      <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
        Оплата · {formatEUR(total)}
      </div>

      {!hasTotal && (
        <div className="px-3 py-2 rounded-[10px] bg-[var(--fill-tertiary)] text-[12px] text-[var(--label-secondary)] text-center">
          Нет суммы для оплаты — добавьте услугу.
        </div>
      )}

      {/* Compact payment buttons row */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => payAll("cash")}
          disabled={!hasTotal}
          className="h-11 rounded-[10px] bg-[var(--system-green)] text-[var(--label-on-accent)] text-[13px] font-semibold active:opacity-90 flex items-center justify-center gap-1.5 disabled:bg-[var(--fill-primary)] disabled:text-[var(--label-tertiary)] disabled:cursor-not-allowed disabled:active:opacity-100"
        >
          <Banknote size={16} strokeWidth={2} /> Нал
        </button>
        <button
          type="button"
          onClick={() => payAll("card")}
          disabled={!hasTotal}
          className="h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[13px] font-semibold active:bg-[var(--accent-pressed)] flex items-center justify-center gap-1.5 disabled:bg-[var(--fill-primary)] disabled:text-[var(--label-tertiary)] disabled:cursor-not-allowed"
        >
          <CreditCard size={16} strokeWidth={2} /> Карта
        </button>
        <button
          type="button"
          onClick={() => {
            setSplitOpen((v) => !v);
            if (!splitOpen) setPartialOpen(false);
          }}
          disabled={!hasTotal}
          className="h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[13px] font-semibold text-[var(--label)] active:bg-[var(--fill-secondary)] flex items-center justify-center gap-1.5 disabled:text-[var(--label-tertiary)] disabled:cursor-not-allowed"
        >
          <ArrowLeftRight size={16} strokeWidth={2} /> Раздельно
        </button>
        <button
          type="button"
          onClick={() => {
            setPartialOpen((v) => !v);
            if (!partialOpen) setSplitOpen(false);
          }}
          disabled={!hasTotal}
          className="h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[13px] font-semibold text-[var(--system-orange)] active:bg-[var(--fill-secondary)] flex items-center justify-center gap-1.5 disabled:text-[var(--label-tertiary)] disabled:cursor-not-allowed"
        >
          <Clock size={16} strokeWidth={2} /> Частично
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
            Подтвердить
          </button>
          {/* STORY audit: до этого кнопка была disabled без какого-либо
              сигнала — оператор вводил сумму, видел грей-кнопку, тапал —
              ничего. Теперь чёткая подсказка ПОЧЕМУ. */}
          {!splitValid && (
            <div className="text-center text-[12px] text-[var(--label-tertiary)] leading-snug">
              {cashVal <= 0
                ? "Введите сумму наличными"
                : cashVal >= total
                  ? "Нал должен быть меньше общей суммы — иначе используйте «Нал»"
                  : "Картой получится €0 — проверьте сумму нала"}
            </div>
          )}
        </div>
      )}

      {partialOpen && (
        <div className="p-3 rounded-[14px] bg-[rgba(255,149,0,0.06)] border border-[rgba(255,149,0,0.25)] space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-20 text-[13px] text-[var(--label-secondary)]">Оплачено</span>
            <div className="flex-1 flex items-center gap-1 bg-[var(--surface-card)] rounded-[10px] border border-[var(--separator)] px-2 h-11">
              <span className="text-[15px] text-[var(--label-tertiary)]">€</span>
              <input
                type="number"
                inputMode="decimal"
                value={partialAmountStr}
                onChange={(e) =>
                  setPartialAmountStr(e.target.value.replace(/[^\d.]/g, ""))
                }
                placeholder="0"
                className="flex-1 bg-transparent text-[15px] font-bold text-[var(--label)] tabular-nums focus:outline-none placeholder:text-[var(--label-tertiary)]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setPartialMethod("cash")}
              aria-pressed={partialMethod === "cash"}
              className={`h-10 rounded-[10px] text-[12px] font-semibold transition ${
                partialMethod === "cash"
                  ? "bg-[var(--system-green)] text-[var(--label-on-accent)]"
                  : "bg-[var(--surface-card)] text-[var(--label)] border border-[var(--separator)]"
              }`}
            >
              Наличкой
            </button>
            <button
              type="button"
              onClick={() => setPartialMethod("card")}
              aria-pressed={partialMethod === "card"}
              className={`h-10 rounded-[10px] text-[12px] font-semibold transition ${
                partialMethod === "card"
                  ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                  : "bg-[var(--surface-card)] text-[var(--label)] border border-[var(--separator)]"
              }`}
            >
              Картой
            </button>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-[var(--separator)]">
            <span className="text-[13px] text-[var(--label-secondary)]">Остаток</span>
            <span className="text-[15px] font-bold text-[var(--system-orange)] tabular-nums">
              {formatEUR(Math.max(0, total - partialVal))}
            </span>
          </div>
          <button
            type="button"
            onClick={payPartial}
            disabled={!partialValid}
            className="w-full h-11 rounded-[10px] bg-[var(--system-orange)] text-[var(--label-on-accent)] text-[15px] font-semibold active:opacity-90 disabled:bg-[var(--fill-primary)] disabled:text-[var(--label-tertiary)]"
          >
            Подтвердить · остаток к доплате
          </button>
        </div>
      )}

      {/* Invoice link — quiet. v671 — also gated by hasTotal so a €0
          draft can't be invoiced into a phantom completed record. */}
      <button
        type="button"
        onClick={payInvoice}
        disabled={!hasTotal}
        className="w-full text-[13px] text-[var(--accent)] active:opacity-70 py-2 inline-flex items-center justify-center gap-1.5 disabled:text-[var(--label-tertiary)] disabled:cursor-not-allowed"
      >
        <FileText size={14} strokeWidth={2} /> Выставить счёт компании →
      </button>
    </div>
  );
}
