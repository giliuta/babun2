"use client";

import { useEffect } from "react";
import type { Appointment } from "@/lib/appointments";
import { formatEUR } from "@/lib/money";

interface PaymentSheetProps {
  open: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  clientName: string;
  /** Выбрать способ оплаты и пометить запись как выполненную. */
  onPay: (method: "cash" | "card") => void;
  /** Отменить запись (не создаёт платёж). */
  onCancel: () => void;
}

// STORY-003 PaymentSheet — 1-тап пометить pending-запись как
// оплаченную наличкой/картой или отменённой. Вызывается из
// long-press меню на AppointmentBlock и из DayReport.
export default function PaymentSheet({
  open,
  onClose,
  appointment,
  clientName,
  onPay,
  onCancel,
}: PaymentSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !appointment) return null;

  const price = appointment.total_amount;
  const timeLabel = `${appointment.time_start}`;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full lg:max-w-md bg-white rounded-t-3xl lg:rounded-3xl lg:mb-8 shadow-2xl pb-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 16px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grabber */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* Summary header */}
        <div className="px-5 pt-2 pb-4 text-center">
          <div className="text-[40px] font-bold text-slate-900 tabular-nums leading-none">
            {formatEUR(price)}
          </div>
          <div className="text-[14px] text-slate-600 mt-1.5 truncate">
            {clientName}
          </div>
          <div className="text-[12px] text-slate-400 mt-0.5 tabular-nums">
            {timeLabel}
          </div>
        </div>

        {/* Payment buttons */}
        <div className="px-4 space-y-2">
          <button
            type="button"
            onClick={() => onPay("cash")}
            className="w-full h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center gap-2 text-[16px] font-semibold active:bg-emerald-600 transition"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Оплачено наличкой
          </button>
          <button
            type="button"
            onClick={() => onPay("card")}
            className="w-full h-14 rounded-2xl bg-sky-500 text-white flex items-center justify-center gap-2 text-[16px] font-semibold active:bg-sky-600 transition"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            Оплачено картой
          </button>
        </div>

        {/* Cancel (quiet, destructive) */}
        <div className="px-4 pt-3 text-center">
          <button
            type="button"
            onClick={onCancel}
            className="text-[13px] font-medium text-rose-500 active:opacity-60 py-2"
          >
            Заказ отменён
          </button>
        </div>
      </div>
    </div>
  );
}
