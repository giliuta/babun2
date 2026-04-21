"use client";

import {
  User,
  MessageSquare,
  MessagesSquare,
  Share2,
  CalendarDays,
  Repeat,
  FileText,
  type LucideIcon,
} from "lucide-react";
import type { Client } from "@/lib/clients";

interface ClientActionMenuProps {
  open: boolean;
  onClose: () => void;
  client: Client;
  onProfile: () => void;
  onSendMessage: () => void;
  onOpenChat: () => void;
  onShare: () => void;
  /** Optional — send public /b/[token] link for this appointment. */
  onShareAppointment?: () => void;
  /** Optional — schedule a follow-up reminder for the same services. */
  onScheduleRepeat?: () => void;
  /** Optional — produce a PDF invoice client-side. */
  onDownloadInvoice?: () => void;
}

// Centered popup menu for the client row ⋯ button. Up to six actions:
// profile / send message / open chat / share contact / share appointment /
// schedule recurring follow-up (only for completed visits).
export default function ClientActionMenu({
  open,
  onClose,
  client,
  onProfile,
  onSendMessage,
  onOpenChat,
  onShare,
  onShareAppointment,
  onScheduleRepeat,
  onDownloadInvoice,
}: ClientActionMenuProps) {
  if (!open) return null;

  const items: { icon: LucideIcon; label: string; onClick: () => void }[] = [
    { icon: User, label: "Профиль клиента", onClick: onProfile },
    { icon: MessageSquare, label: "Отправить сообщение", onClick: onSendMessage },
    { icon: MessagesSquare, label: "Перейти в чат", onClick: onOpenChat },
    { icon: Share2, label: "Поделиться контактом", onClick: onShare },
    ...(onShareAppointment
      ? [{ icon: CalendarDays, label: "Поделиться записью", onClick: onShareAppointment }]
      : []),
    ...(onScheduleRepeat
      ? [{ icon: Repeat, label: "Повторить через…", onClick: onScheduleRepeat }]
      : []),
    ...(onDownloadInvoice
      ? [{ icon: FileText, label: "Скачать счёт (PDF)", onClick: onDownloadInvoice }]
      : []),
  ];

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[320px] bg-[var(--surface-card)] rounded-[20px] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[var(--separator)]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
            {client.full_name}
          </div>
        </div>
        <div className="divide-y divide-[var(--separator)]">
          {items.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  item.onClick();
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 min-h-[48px] text-left active:bg-[var(--fill-quaternary)]"
              >
                <span className="w-6 flex items-center justify-center text-[var(--accent)]">
                  <Icon size={18} strokeWidth={2} />
                </span>
                <span className="text-[15px] font-medium text-[var(--label)] flex-1">
                  {item.label}
                </span>
                <span className="text-[var(--label-quaternary)]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full h-12 text-[15px] font-medium text-[var(--accent)] border-t border-[var(--separator)] active:bg-[var(--fill-quaternary)]"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
