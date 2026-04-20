"use client";

import type { Client } from "@/lib/clients";

interface ClientActionMenuProps {
  open: boolean;
  onClose: () => void;
  client: Client;
  onProfile: () => void;
  onSendMessage: () => void;
  onOpenChat: () => void;
  onShare: () => void;
}

// Centered popup menu for the client row ⋯ button.
// Four actions: profile / send message / open chat / share contact.
export default function ClientActionMenu({
  open,
  onClose,
  client,
  onProfile,
  onSendMessage,
  onOpenChat,
  onShare,
}: ClientActionMenuProps) {
  if (!open) return null;

  const items = [
    { icon: "👤", label: "Профиль клиента", onClick: onProfile },
    { icon: "💬", label: "Отправить сообщение", onClick: onSendMessage },
    { icon: "💭", label: "Перейти в чат", onClick: onOpenChat },
    { icon: "🔗", label: "Поделиться контактом", onClick: onShare },
  ];

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[320px] bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {client.full_name}
          </div>
        </div>
        <div className="divide-y divide-slate-50">
          {items.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                item.onClick();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50"
            >
              <span className="text-[18px] w-6 text-center">{item.icon}</span>
              <span className="text-[14px] font-medium text-slate-900 flex-1">
                {item.label}
              </span>
              <span className="text-slate-300">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 text-[13px] font-medium text-slate-500 border-t border-slate-100 active:bg-slate-50"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
