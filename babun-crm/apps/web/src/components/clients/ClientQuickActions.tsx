"use client";

// STORY-065 — restructured quick actions per user feedback.
//
// User's exact words: "звонок, и переход в чат в срм это должна быть
// основа остальное доп". Meaning the two PRIMARY actions are:
//   1. Позвонить (tel: link, phone-keyboard call)
//   2. Чат CRM   (router.push to /dashboard/chats?client_id=X)
//
// Everything else is secondary — collapsed behind a "Ещё" button so
// the screen isn't dominated by 4-5 round buttons. The secondary
// row reveals on tap and folds back. No long-press magic; that
// pattern was unfindable for users.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Phone as PhoneIcon,
  MessageCircle,
  MoreHorizontal,
  Send,
  MessageSquare,
  StickyNote,
} from "@babun/shared/icons";
import type { Client } from "@babun/shared/local/clients";
import {
  whatsappUrl,
  telUrl,
} from "@babun/shared/common/utils/messenger-links";
import { haptic } from "@/lib/haptics";

interface ClientQuickActionsProps {
  client: Client;
  /** Parent page expands the Notes block + focuses the input. */
  onAddNote: () => void;
}

export default function ClientQuickActions({
  client,
  onAddNote,
}: ClientQuickActionsProps) {
  const router = useRouter();
  const [secondaryOpen, setSecondaryOpen] = useState(false);

  const phoneDigits = client.phone.replace(/\D/g, "");
  const tel = telUrl(client.phone);
  const sms = phoneDigits ? `sms:${phoneDigits}` : null;
  const wa = whatsappUrl(client.whatsapp_phone || client.phone);

  const openCrmChat = () => {
    haptic("tap");
    router.push(`/dashboard/chats?client_id=${client.id}`);
  };

  return (
    <div className="px-3 pt-2 pb-3 flex flex-col gap-2">
      {/* Two primary buttons — equal-width, tall, brand-colored. The
          two channels the user identified as "the basics". */}
      <div className="grid grid-cols-2 gap-2">
        <PrimaryAction
          label="Позвонить"
          href={tel}
          icon={<PhoneIcon size={18} strokeWidth={2.4} />}
          color="green"
        />
        <PrimaryButton
          label="Чат"
          onClick={openCrmChat}
          icon={<MessageCircle size={18} strokeWidth={2.4} />}
          color="blue"
        />
      </div>

      {/* Secondary actions — collapsed. Tap "Ещё" to reveal. */}
      {!secondaryOpen ? (
        <button
          type="button"
          onClick={() => {
            haptic("tap");
            setSecondaryOpen(true);
          }}
          className="self-center mt-1 inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-[var(--fill-tertiary)] text-[13px] font-medium text-[var(--label-secondary)] active:bg-[var(--fill-secondary)]"
        >
          <MoreHorizontal size={14} strokeWidth={2.2} />
          Ещё
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2 mt-1">
          <SecondaryAction
            label="WhatsApp"
            href={wa}
            external
            icon={<Send size={16} strokeWidth={2.2} />}
          />
          <SecondaryAction
            label="SMS"
            href={sms}
            icon={<MessageSquare size={16} strokeWidth={2.2} />}
          />
          <SecondaryButton
            label="Заметка"
            onClick={() => {
              haptic("tap");
              onAddNote();
            }}
            icon={<StickyNote size={16} strokeWidth={2.2} />}
          />
        </div>
      )}
    </div>
  );
}

interface PrimaryProps {
  label: string;
  icon: React.ReactNode;
  color: "green" | "blue";
}

function colorClass(color: "green" | "blue"): string {
  return color === "green"
    ? "bg-[var(--system-green)] active:bg-[#2BA549]"
    : "bg-[var(--accent)] active:bg-[var(--accent-pressed)]";
}

function PrimaryAction({
  label,
  href,
  icon,
  color,
}: PrimaryProps & { href: string | null }) {
  const cls = `h-12 rounded-[12px] flex items-center justify-center gap-2 text-[15px] font-semibold text-white press-scale ${colorClass(color)}`;
  if (!href) {
    return (
      <button
        type="button"
        disabled
        className={`${cls} opacity-40 cursor-not-allowed`}
      >
        {icon}
        {label}
      </button>
    );
  }
  return (
    <a
      href={href}
      onClick={() => haptic("tap")}
      className={cls}
      aria-label={label}
    >
      {icon}
      {label}
    </a>
  );
}

function PrimaryButton({
  label,
  onClick,
  icon,
  color,
}: PrimaryProps & { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-12 rounded-[12px] flex items-center justify-center gap-2 text-[15px] font-semibold text-white press-scale ${colorClass(color)}`}
      aria-label={label}
    >
      {icon}
      {label}
    </button>
  );
}

interface SecondaryProps {
  label: string;
  icon: React.ReactNode;
}

function SecondaryAction({
  label,
  href,
  icon,
  external,
}: SecondaryProps & { href: string | null; external?: boolean }) {
  const cls =
    "h-10 rounded-[10px] bg-[var(--fill-tertiary)] active:bg-[var(--fill-secondary)] flex items-center justify-center gap-1.5 text-[13px] font-medium text-[var(--label)]";
  if (!href) {
    return (
      <button
        type="button"
        disabled
        className={`${cls} opacity-40 cursor-not-allowed`}
      >
        {icon}
        {label}
      </button>
    );
  }
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      onClick={() => haptic("tap")}
      className={cls}
      aria-label={label}
    >
      {icon}
      {label}
    </a>
  );
}

function SecondaryButton({
  label,
  onClick,
  icon,
}: SecondaryProps & { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-10 rounded-[10px] bg-[var(--fill-tertiary)] active:bg-[var(--fill-secondary)] flex items-center justify-center gap-1.5 text-[13px] font-medium text-[var(--label)]"
      aria-label={label}
    >
      {icon}
      {label}
    </button>
  );
}
