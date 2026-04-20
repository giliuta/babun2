"use client";

import { useState } from "react";

interface SendMessagePopupProps {
  open: boolean;
  onClose: () => void;
  phone: string | null;
  clientName: string;
  defaultText?: string;
}

type Channel = "sms" | "whatsapp" | "telegram" | "viber";

const CHANNEL_META: Record<Channel, { label: string; emoji: string; color: string }> = {
  sms: { label: "SMS", emoji: "📱", color: "bg-slate-600" },
  whatsapp: { label: "WhatsApp", emoji: "🟢", color: "bg-emerald-500" },
  telegram: { label: "Telegram", emoji: "✈️", color: "bg-sky-500" },
  viber: { label: "Viber", emoji: "💜", color: "bg-violet-500" },
};

// Centered popup: textarea + four channel buttons (SMS / WhatsApp /
// Telegram / Viber). On tap, builds a deep link and opens it.
export default function SendMessagePopup({
  open,
  onClose,
  phone,
  clientName,
  defaultText,
}: SendMessagePopupProps) {
  const [text, setText] = useState(defaultText ?? "");

  if (!open) return null;

  const digits = phone?.replace(/\D/g, "") ?? "";

  const buildUrl = (channel: Channel): string | null => {
    const msg = encodeURIComponent(text.trim());
    if (!digits) return null;
    if (channel === "sms") return `sms:+${digits}?body=${msg}`;
    if (channel === "whatsapp") return `https://wa.me/${digits}?text=${msg}`;
    if (channel === "telegram") return `https://t.me/+${digits}?text=${msg}`;
    if (channel === "viber") return `viber://chat?number=%2B${digits}&text=${msg}`;
    return null;
  };

  const send = (channel: Channel) => {
    const url = buildUrl(channel);
    if (!url) return;
    window.open(url, "_blank", "noopener");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div>
            <div className="text-[14px] font-semibold text-slate-900">
              Сообщение клиенту
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {clientName}
              {phone && <span className="tabular-nums"> · {phone}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 active:bg-slate-100"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Введите текст сообщения…"
            rows={4}
            autoFocus
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[14px] text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
          />

          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Отправить через
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(CHANNEL_META) as Channel[]).map((ch) => {
              const meta = CHANNEL_META[ch];
              return (
                <button
                  key={ch}
                  type="button"
                  disabled={!digits}
                  onClick={() => send(ch)}
                  className={`h-11 rounded-xl text-[13px] font-semibold text-white active:scale-[0.98] disabled:bg-slate-300 disabled:text-slate-400 flex items-center justify-center gap-1.5 ${
                    digits ? meta.color : ""
                  }`}
                >
                  <span>{meta.emoji}</span> {meta.label}
                </button>
              );
            })}
          </div>
          {!digits && (
            <div className="text-[11px] text-rose-600 text-center">
              У клиента нет телефона — добавьте в профиль
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
