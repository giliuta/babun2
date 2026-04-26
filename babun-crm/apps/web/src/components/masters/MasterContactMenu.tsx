"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Phone, Send, Smartphone, X } from "lucide-react";
import type { Master } from "@babun/shared/local/masters";
import { telegramUrl, whatsappUrl } from "@babun/shared/common/utils/messenger-links";
import { haptic } from "@/lib/haptics";

interface MasterContactMenuProps {
  open: boolean;
  master: Master;
  onClose: () => void;
}

// Quick-contact bottom sheet. Tapped from master hub avatar. Four
// actions: звонок, WhatsApp, Telegram, внутренний чат Babun. Each
// disabled if the corresponding channel is missing.
export default function MasterContactMenu({
  open,
  master,
  onClose,
}: MasterContactMenuProps) {
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const phoneNumber = master.phone?.trim() ?? "";
  const whatsappNumber = (master.whatsapp?.trim() || phoneNumber).trim();
  const telegramHandle = master.telegram?.trim() ?? "";

  const call = () => {
    if (!phoneNumber) return;
    haptic("tap");
    window.location.href = `tel:${phoneNumber.replace(/\s+/g, "")}`;
    onClose();
  };

  const waUrl = whatsappUrl(whatsappNumber);
  const tgUrl = telegramUrl(telegramHandle, phoneNumber);

  const wa = () => {
    if (!waUrl) return;
    haptic("tap");
    window.open(waUrl, "_blank");
    onClose();
  };

  const tg = () => {
    if (!tgUrl) return;
    haptic("tap");
    window.open(tgUrl, "_blank");
    onClose();
  };

  const openChat = () => {
    haptic("tap");
    // Chat with internal staff isn't modelled yet — for now just
    // navigate to the chats page. When employee DM lands we can
    // deep-link to the specific conversation here.
    router.push("/dashboard/chats");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center bg-[var(--surface-overlay)] backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-[360px] bg-[var(--surface-card)] rounded-t-[20px] sm:rounded-[20px] shadow-[var(--shadow-sheet)] overflow-hidden"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 10px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--separator)]">
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-[var(--label)] truncate">
              {master.full_name || "Сотрудник"}
            </div>
            {phoneNumber && (
              <div className="text-[12px] text-[var(--label-secondary)] tabular-nums">
                {phoneNumber}
              </div>
            )}
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
        <div className="divide-y divide-[var(--separator)]">
          <Action
            icon={<Phone size={18} strokeWidth={2} />}
            tone="text-[var(--system-green)]"
            label="Позвонить"
            subtitle={phoneNumber || "телефон не указан"}
            disabled={!phoneNumber}
            onClick={call}
          />
          <Action
            icon={<Smartphone size={18} strokeWidth={2} />}
            tone="text-[#25D366]"
            label="WhatsApp"
            subtitle={whatsappNumber || "номер не указан"}
            disabled={!waUrl}
            onClick={wa}
          />
          <Action
            icon={<Send size={18} strokeWidth={2} />}
            tone="text-[#2AABEE]"
            label="Telegram"
            subtitle={telegramHandle || phoneNumber || "не указан"}
            disabled={!tgUrl}
            onClick={tg}
          />
          <Action
            icon={<MessageCircle size={18} strokeWidth={2} />}
            tone="text-[var(--accent)]"
            label="Чат в Babun"
            subtitle="внутренний канал с сотрудником"
            onClick={openChat}
          />
        </div>
      </div>
    </div>
  );
}

function Action({
  icon,
  tone,
  label,
  subtitle,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  subtitle: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left transition ${
        disabled
          ? "opacity-40 pointer-events-none"
          : "active:bg-[var(--fill-quaternary)]"
      }`}
    >
      <span className={`w-9 h-9 rounded-full bg-[var(--fill-tertiary)] flex items-center justify-center shrink-0 ${tone}`}>
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-medium text-[var(--label)]">
          {label}
        </span>
        <span className="block text-[12px] text-[var(--label-tertiary)] truncate">
          {subtitle}
        </span>
      </span>
    </button>
  );
}
