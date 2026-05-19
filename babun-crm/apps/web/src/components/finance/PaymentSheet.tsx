"use client";

import { useEffect, useState } from "react";
import type { Appointment } from "@babun/shared/local/appointments";
import { formatEUR } from "@babun/shared/common/utils/money";

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
  // STORY audit (tester 1.1): double-tap «Наличкой» создавал две
  // completion-записи. Лочим кнопки на время родительского перерендера.
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Reset когда sheet закрывается (например после успешного onPay).
  useEffect(() => {
    if (!open) setIsSubmitting(false);
  }, [open]);
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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] pb-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 16px)" }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* Summary header */}
        <div className="px-5 pt-2 pb-4 text-center">
          <div className="text-[40px] font-bold text-[var(--label)] tabular-nums leading-none tracking-tight">
            {formatEUR(price)}
          </div>
          <div className="text-[15px] text-[var(--label-secondary)] mt-1.5 truncate">
            {clientName}
          </div>
          <div className="text-[12px] text-[var(--label-tertiary)] mt-0.5 tabular-nums">
            {timeLabel}
          </div>
        </div>

        {/* Payment buttons */}
        <div className="px-4 space-y-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              if (isSubmitting) return;
              setIsSubmitting(true);
              onPay("cash");
            }}
            className="w-full h-12 rounded-[10px] bg-[var(--system-green)] text-[var(--label-on-accent)] flex items-center justify-center gap-2 text-[15px] font-semibold active:opacity-90 disabled:opacity-50 transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {isSubmitting ? "Сохраняем…" : "Оплачено наличкой"}
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              if (isSubmitting) return;
              setIsSubmitting(true);
              onPay("card");
            }}
            className="w-full h-12 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] flex items-center justify-center gap-2 text-[15px] font-semibold active:bg-[var(--accent-pressed)] disabled:opacity-50 transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            {isSubmitting ? "Сохраняем…" : "Оплачено картой"}
          </button>
        </div>

        {/* Cancel (quiet, destructive) */}
        <div className="px-4 pt-3 text-center">
          <button
            type="button"
            onClick={onCancel}
            className="text-[13px] font-medium text-[var(--system-red)] active:opacity-60 py-2"
          >
            Заказ отменён
          </button>
        </div>
      </div>
    </div>
  );
}
