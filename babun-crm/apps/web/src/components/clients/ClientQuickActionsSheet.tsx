"use client";

// v333 — Centered popup with the four contact channels for a
// client.  Triggered by long-press on the green phone icon in
// ClientCard, but reusable elsewhere (selected-client view, master
// contact menu, etc.).
//
// Per project rule (feedback_center_modals): every popup/picker
// opens *centered* on screen, not as a bottom sheet.  Backdrop
// fades in, panel pops via animate-popup-in.

import { useEffect } from "react";
import { Phone as PhoneIcon, MessageSquare, Send, X } from "lucide-react";
import type { Client } from "@/lib/clients";
import {
  whatsappUrl,
  telegramUrl,
  telUrl,
} from "@/lib/messenger-links";
import { haptic } from "@/lib/haptics";

interface Props {
  client: Client;
  onClose: () => void;
}

interface Action {
  key: string;
  label: string;
  href: string | null;
  external?: boolean;
  icon: React.ReactNode;
  toneCls: string;
}

export default function ClientQuickActionsSheet({ client, onClose }: Props) {
  // ESC closes; body-scroll lock so the page below doesn't shift
  // while the modal is open.
  useEffect(() => {
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
  }, [onClose]);

  const phoneDigits = client.phone.replace(/\D/g, "");
  const tel = telUrl(client.phone);
  const sms = phoneDigits ? `sms:${phoneDigits}` : null;
  const wa = whatsappUrl(client.whatsapp_phone || client.phone);
  const tg = telegramUrl(client.telegram_username, client.phone);

  const actions: Action[] = [
    {
      key: "call",
      label: "Звонок",
      href: tel,
      icon: <PhoneIcon size={20} strokeWidth={2.2} />,
      toneCls:
        "bg-[rgba(52,199,89,0.12)] text-[var(--system-green)] active:bg-[rgba(52,199,89,0.22)]",
    },
    {
      key: "wa",
      label: "WhatsApp",
      href: wa,
      external: true,
      icon: <Send size={20} strokeWidth={2.2} />,
      toneCls:
        "bg-[rgba(52,199,89,0.12)] text-[var(--system-green)] active:bg-[rgba(52,199,89,0.22)]",
    },
    {
      key: "sms",
      label: "SMS",
      href: sms,
      icon: <MessageSquare size={20} strokeWidth={2.2} />,
      toneCls:
        "bg-[rgba(0,122,255,0.10)] text-[var(--system-blue)] active:bg-[rgba(0,122,255,0.20)]",
    },
    {
      key: "tg",
      label: "Telegram",
      href: tg,
      external: true,
      icon: <Send size={20} strokeWidth={2.2} />,
      toneCls:
        "bg-[var(--accent-tint)] text-[var(--accent)] active:bg-[var(--fill-secondary)]",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-4 modal-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[340px] bg-[var(--surface-card)] rounded-[18px] shadow-[var(--shadow-sheet)] overflow-hidden animate-popup-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — name + close. */}
        <div className="px-4 pt-4 pb-3 flex items-start gap-2 border-b border-[var(--separator)]">
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-[var(--label)] truncate">
              {client.full_name || "Без имени"}
            </div>
            {client.phone && (
              <div className="text-[12px] text-[var(--label-secondary)] tabular-nums truncate mt-0.5">
                {client.phone}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 -mt-0.5 -mr-1 flex items-center justify-center rounded-full text-[var(--label-tertiary)] active:bg-[var(--fill-tertiary)]"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* 4 actions — 2 × 2 grid. */}
        <div className="grid grid-cols-2 gap-2 p-3">
          {actions.map((a) => {
            const enabled = !!a.href;
            const inner = (
              <>
                <span
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition press-scale ${
                    enabled
                      ? a.toneCls
                      : "bg-[var(--fill-tertiary)] text-[var(--label-quaternary)]"
                  }`}
                >
                  {a.icon}
                </span>
                <span
                  className={`text-[13px] font-semibold ${
                    enabled
                      ? "text-[var(--label)]"
                      : "text-[var(--label-quaternary)]"
                  }`}
                >
                  {a.label}
                </span>
              </>
            );
            const baseCls =
              "h-20 rounded-[12px] bg-[var(--fill-tertiary)] flex flex-col items-center justify-center gap-1 active:bg-[var(--fill-secondary)] transition";
            if (a.href) {
              return (
                <a
                  key={a.key}
                  href={a.href}
                  target={a.external ? "_blank" : undefined}
                  rel={a.external ? "noreferrer" : undefined}
                  onClick={() => {
                    haptic("tap");
                    onClose();
                  }}
                  className={baseCls}
                >
                  {inner}
                </a>
              );
            }
            return (
              <button
                key={a.key}
                type="button"
                disabled
                className={`${baseCls} opacity-60 cursor-not-allowed`}
              >
                {inner}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
