"use client";

import { useState } from "react";
import { X, MessageSquare, Phone, Send } from "lucide-react";

interface SendMessagePopupProps {
  open: boolean;
  onClose: () => void;
  phone: string | null;
  clientName: string;
  defaultText?: string;
}

type Channel = "sms" | "whatsapp" | "telegram" | "viber";

const CHANNEL_META: Record<Channel, { label: string; color: string }> = {
  sms: { label: "SMS", color: "bg-[var(--label)]" },
  whatsapp: { label: "WhatsApp", color: "bg-[var(--system-green)]" },
  telegram: { label: "Telegram", color: "bg-[var(--accent)]" },
  viber: { label: "Viber", color: "bg-[var(--accent)]" },
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

  const CHANNEL_ICONS: Record<Channel, typeof Phone> = {
    sms: Phone,
    whatsapp: MessageSquare,
    telegram: Send,
    viber: MessageSquare,
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--separator)]">
          <div>
            <div className="text-[17px] font-semibold tracking-tight text-[var(--label)]">
              Сообщение клиенту
            </div>
            <div className="text-[12px] text-[var(--label-secondary)] truncate">
              {clientName}
              {phone && <span className="tabular-nums"> · {phone}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Введите текст сообщения…"
            rows={4}
            autoFocus
            className="w-full px-3.5 py-2 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[15px] text-[var(--label)] resize-none focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
          />

          <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
            Отправить через
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(CHANNEL_META) as Channel[]).map((ch) => {
              const meta = CHANNEL_META[ch];
              const Icon = CHANNEL_ICONS[ch];
              return (
                <button
                  key={ch}
                  type="button"
                  disabled={!digits}
                  onClick={() => send(ch)}
                  className={`h-11 rounded-[10px] text-[15px] font-semibold text-[var(--label-on-accent)] active:scale-[0.98] disabled:bg-[var(--fill-primary)] disabled:text-[var(--label-tertiary)] flex items-center justify-center gap-1.5 ${
                    digits ? meta.color : ""
                  }`}
                >
                  <Icon size={16} strokeWidth={2} /> {meta.label}
                </button>
              );
            })}
          </div>
          {!digits && (
            <div className="text-[12px] text-[var(--system-red)] text-center">
              У клиента нет телефона — добавьте в профиль
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
