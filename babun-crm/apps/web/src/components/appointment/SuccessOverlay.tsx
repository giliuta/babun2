"use client";

import { useEffect } from "react";

interface SuccessOverlayProps {
  clientName: string;
  phone?: string;
  chatHref?: string;
  onDone: () => void;
}

// 2-секундный overlay после успешного сохранения. Quick-actions:
// Позвонить + Написать.
export default function SuccessOverlay({
  clientName,
  phone,
  chatHref,
  onDone,
}: SuccessOverlayProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

  const phoneDigits = phone?.replace(/\D/g, "") ?? "";

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
        {(phoneDigits || chatHref) && (
          <div className="flex gap-2 mt-4 w-full">
            {phoneDigits && (
              <a
                href={`tel:${phoneDigits}`}
                className="flex-1 h-10 rounded-lg bg-emerald-50 text-emerald-700 text-[13px] font-semibold flex items-center justify-center active:bg-emerald-100"
              >
                Позвонить
              </a>
            )}
            {chatHref && (
              <a
                href={chatHref}
                className="flex-1 h-10 rounded-lg bg-sky-50 text-sky-700 text-[13px] font-semibold flex items-center justify-center active:bg-sky-100"
              >
                Написать
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
