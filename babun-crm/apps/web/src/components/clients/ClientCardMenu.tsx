"use client";

// «…» overflow menu for the unified client card (view mode only).
// Extracted from ClientCardPage to keep that component under the
// 400-line ceiling. Centered popup per feedback_center_modals.

import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  MessageSquare,
  MessageCircle,
  Share2,
  Ban,
  CheckCircle2,
  Trash2,
} from "@babun/shared/icons";
import type { Client } from "@babun/shared/local/clients";

interface ClientCardMenuProps {
  client: Client;
  onClose: () => void;
  onSendMessage: () => void;
  onToggleBlacklist: () => void;
  onDelete: () => void;
}

export default function ClientCardMenu({
  client,
  onClose,
  onSendMessage,
  onToggleBlacklist,
  onDelete,
}: ClientCardMenuProps) {
  const router = useRouter();

  const share = async () => {
    onClose();
    const text = [client.full_name, client.phone].filter(Boolean).join(" · ");
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: client.full_name, text });
      } catch {
        // user dismissed
      }
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[320px] bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-sheet)] overflow-hidden animate-popup-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[var(--separator)] text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] truncate">
          {client.full_name || "Без имени"}
        </div>
        <MenuRow
          icon={MessageSquare}
          label="Отправить сообщение"
          onClick={onSendMessage}
        />
        <MenuRow
          icon={MessageCircle}
          label="Перейти в чат"
          onClick={() => {
            onClose();
            router.push(`/dashboard/chats?client_id=${client.id}`);
          }}
        />
        <MenuRow icon={Share2} label="Поделиться контактом" onClick={share} />
        <MenuRow
          icon={client.blacklisted ? CheckCircle2 : Ban}
          label={client.blacklisted ? "Убрать из ЧС" : "В чёрный список"}
          onClick={onToggleBlacklist}
          danger={!client.blacklisted}
        />
        {/* TODO(roles): hide for crew role */}
        <MenuRow icon={Trash2} label="Удалить клиента" onClick={onDelete} danger />
        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 text-[13px] font-medium text-[var(--label-secondary)] border-t border-[var(--separator)] active:bg-[var(--fill-quaternary)]"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

function MenuRow({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-[var(--fill-quaternary)] border-b border-[var(--separator)] last:border-0"
    >
      <span
        className={`w-6 flex items-center justify-center ${
          danger ? "text-[var(--system-red)]" : "text-[var(--label-secondary)]"
        }`}
      >
        <Icon size={18} strokeWidth={2} />
      </span>
      <span
        className={`text-[15px] font-medium flex-1 ${
          danger ? "text-[var(--system-red)]" : "text-[var(--label)]"
        }`}
      >
        {label}
      </span>
      <span className="text-[var(--label-tertiary)]">
        <ChevronLeft size={14} strokeWidth={2.5} className="rotate-180" />
      </span>
    </button>
  );
}
