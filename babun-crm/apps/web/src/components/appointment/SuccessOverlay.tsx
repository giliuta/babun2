"use client";

import { useEffect, useRef, useState } from "react";

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
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onDone}
    >
      <div
        className="w-[300px] bg-white rounded-2xl shadow-2xl p-6 flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/40">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="text-[17px] font-bold text-slate-900 text-center">
          Запись создана
        </div>
        {clientName && (
          <div className="text-[13px] text-slate-500 mt-1 text-center truncate max-w-full">
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
            className="mt-4 w-full h-10 rounded-lg bg-violet-600 text-white text-[13px] font-semibold active:scale-[0.99]"
          >
            💬 Отправить сообщение о записи
          </button>
        )}

        {chooserOpen && (
          <div className="mt-4 w-full space-y-2">
            {smsHref && (
              <a
                href={smsHref}
                onClick={onDone}
                className="w-full h-10 rounded-lg bg-slate-800 text-white text-[13px] font-semibold flex items-center justify-center active:opacity-80"
              >
                📱 По SMS
              </a>
            )}
            {chatHref && (
              <a
                href={chatHref}
                onClick={onDone}
                className="w-full h-10 rounded-lg bg-sky-500 text-white text-[13px] font-semibold flex items-center justify-center active:bg-sky-600"
              >
                💭 Через чат CRM
              </a>
            )}
            <button
              type="button"
              onClick={onDone}
              className="w-full h-9 text-[12px] font-medium text-slate-500 active:bg-slate-50 rounded-lg"
            >
              Не отправлять
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
