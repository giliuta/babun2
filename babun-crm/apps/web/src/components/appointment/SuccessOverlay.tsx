"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Phone, MessagesSquare } from "lucide-react";

interface SuccessOverlayProps {
  clientName: string;
  phone?: string;
  chatHref?: string;
  /** Pre-built text to seed the SMS body (e.g. "Запись на 21 апр, 14:00 · чистка A/C"). */
  smsText?: string;
  onDone: () => void;
}

// 2-second overlay after an appointment is saved. One action:
// "Сообщение о записи" — opens a tiny chooser: SMS (native) or
// internal chat. Opening the chooser cancels the auto-dismiss
// timer so the dispatcher can decide without being rushed.
export default function SuccessOverlay({
  clientName,
  phone,
  chatHref,
  smsText,
  onDone,
}: SuccessOverlayProps) {
  const [chooserOpen, setChooserOpen] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    timerRef.current = window.setTimeout(onDone, 2000);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [onDone]);

  const cancelAutoDismiss = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const phoneDigits = phone?.replace(/\D/g, "") ?? "";
  const messageSeed = smsText?.trim() ? encodeURIComponent(smsText.trim()) : "";

  const smsHref = phoneDigits
    ? `sms:+${phoneDigits}${messageSeed ? `?body=${messageSeed}` : ""}`
    : null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-sm"
      onClick={onDone}
    >
      <div
        className="w-[300px] bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] p-6 flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-16 h-16 rounded-full bg-[var(--system-green)] flex items-center justify-center mb-3 shadow-[var(--shadow-sheet)] shadow-[rgba(52,199,89,0.4)]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="text-[17px] font-semibold tracking-tight text-[var(--label)] text-center">
          Запись создана
        </div>
        {clientName && (
          <div className="text-[13px] text-[var(--label-secondary)] mt-1 text-center truncate max-w-full">
            {clientName}
          </div>
        )}

        {!chooserOpen && (smsHref || chatHref) && (
          <button
            type="button"
            onClick={() => {
              cancelAutoDismiss();
              setChooserOpen(true);
            }}
            className="mt-4 w-full h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.99] flex items-center justify-center gap-1.5"
          >
            <MessageCircle size={16} strokeWidth={2} /> Отправить сообщение
          </button>
        )}

        {chooserOpen && (
          <div className="mt-4 w-full space-y-2">
            {smsHref && (
              <a
                href={smsHref}
                onClick={onDone}
                className="w-full h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--label)] text-[15px] font-semibold flex items-center justify-center gap-1.5 active:bg-[var(--fill-secondary)]"
              >
                <Phone size={16} strokeWidth={2} /> По SMS
              </a>
            )}
            {chatHref && (
              <a
                href={chatHref}
                onClick={onDone}
                className="w-full h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold flex items-center justify-center gap-1.5 active:bg-[var(--accent-pressed)]"
              >
                <MessagesSquare size={16} strokeWidth={2} /> Через чат CRM
              </a>
            )}
            <button
              type="button"
              onClick={onDone}
              className="w-full h-11 text-[13px] font-medium text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)] rounded-[10px]"
            >
              Не отправлять
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
