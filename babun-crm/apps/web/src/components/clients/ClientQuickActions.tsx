"use client";

// STORY-034 Group 1 — Four primary actions under the client header.
//
// Tap = launch the channel; long-press (≥500 ms) = opens
// ClientQuickActionsSheet for the secondary list (Telegram, separate
// WhatsApp number, etc).  Per project rule feedback_center_modals,
// the sheet is a *centered* popup, not a bottom sheet.
//
// Buttons:
//   1. Позвонить  — tel:
//   2. WhatsApp   — https://wa.me/{digits}
//   3. SMS        — sms:
//   4. + Заметка  — calls onAddNote(); the parent page expands the
//                    NotesBlock (Group 3) and focuses its input.

import { useRef, useState } from "react";
import {
  Phone as PhoneIcon,
  Send,
  MessageSquare,
  StickyNote,
} from "lucide-react";
import type { Client } from "@babun/shared/local/clients";
import {
  whatsappUrl,
  telUrl,
} from "@babun/shared/common/utils/messenger-links";
import { haptic } from "@/lib/haptics";
import ClientQuickActionsSheet from "./ClientQuickActionsSheet";

interface ClientQuickActionsProps {
  client: Client;
  /** Parent page expands the Notes block + focuses the input. */
  onAddNote: () => void;
}

interface SlotProps {
  label: string;
  href?: string | null;
  external?: boolean;
  icon: React.ReactNode;
  toneCls: string;
  onClick?: () => void;
  onLongPress: () => void;
}

export default function ClientQuickActions({
  client,
  onAddNote,
}: ClientQuickActionsProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const phoneDigits = client.phone.replace(/\D/g, "");
  const tel = telUrl(client.phone);
  const sms = phoneDigits ? `sms:${phoneDigits}` : null;
  const wa = whatsappUrl(client.whatsapp_phone || client.phone);

  const openSheet = () => {
    haptic("medium");
    setSheetOpen(true);
  };

  return (
    <>
      <div className="px-3 py-3 grid grid-cols-4 gap-1.5">
        <Slot
          label="Позвонить"
          href={tel}
          icon={<PhoneIcon size={18} strokeWidth={2.2} />}
          toneCls="bg-[rgba(52,199,89,0.12)] text-[var(--system-green)] active:bg-[rgba(52,199,89,0.22)]"
          onLongPress={openSheet}
        />
        <Slot
          label="WhatsApp"
          href={wa}
          external
          icon={<Send size={18} strokeWidth={2.2} />}
          toneCls="bg-[rgba(52,199,89,0.12)] text-[var(--system-green)] active:bg-[rgba(52,199,89,0.22)]"
          onLongPress={openSheet}
        />
        <Slot
          label="SMS"
          href={sms}
          icon={<MessageSquare size={18} strokeWidth={2.2} />}
          toneCls="bg-[rgba(0,122,255,0.10)] text-[var(--system-blue)] active:bg-[rgba(0,122,255,0.20)]"
          onLongPress={openSheet}
        />
        <Slot
          label="Заметка"
          icon={<StickyNote size={18} strokeWidth={2.2} />}
          toneCls="bg-[var(--accent-tint)] text-[var(--accent)] active:bg-[var(--fill-secondary)]"
          onClick={() => {
            haptic("tap");
            onAddNote();
          }}
          onLongPress={() => {
            // No alt-channels for the note button — falls through to
            // the same action as a tap.
            haptic("tap");
            onAddNote();
          }}
        />
      </div>

      {sheetOpen && (
        <ClientQuickActionsSheet
          client={client}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}

// One round-icon button.  Handles long-press detection internally so
// the parent component stays declarative.
function Slot({
  label,
  href,
  external,
  icon,
  toneCls,
  onClick,
  onLongPress,
}: SlotProps) {
  const enabled = href != null || onClick != null;
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const start = (e: React.PointerEvent) => {
    if (!enabled) return;
    e.stopPropagation();
    fired.current = false;
    timer.current = window.setTimeout(() => {
      fired.current = true;
      onLongPress();
    }, 500);
  };
  const cancel = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const handleClick = (e: React.MouseEvent) => {
    if (fired.current) {
      e.preventDefault();
      e.stopPropagation();
      fired.current = false;
      return;
    }
    if (!href && onClick) {
      e.preventDefault();
      onClick();
      return;
    }
    if (href) haptic("tap");
  };

  const inner = (
    <>
      <span
        className={`w-11 h-11 rounded-full flex items-center justify-center transition press-scale ${
          enabled
            ? toneCls
            : "bg-[var(--fill-tertiary)] text-[var(--label-quaternary)]"
        }`}
      >
        {icon}
      </span>
      <span
        className={`text-[10px] leading-none font-semibold ${
          enabled ? "text-[var(--label-secondary)]" : "text-[var(--label-quaternary)]"
        }`}
      >
        {label}
      </span>
    </>
  );

  const baseCls =
    "flex flex-col items-center justify-center gap-1 py-1.5 select-none";

  if (href) {
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        aria-label={label}
        onClick={handleClick}
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onPointerLeave={cancel}
        onPointerMove={(e) => {
          if (Math.abs(e.movementX) > 4 || Math.abs(e.movementY) > 4) cancel();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (!fired.current) {
            fired.current = true;
            onLongPress();
          }
        }}
        className={baseCls}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      disabled={!enabled}
      onClick={handleClick}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onPointerMove={(e) => {
        if (Math.abs(e.movementX) > 4 || Math.abs(e.movementY) > 4) cancel();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (enabled && !fired.current) {
          fired.current = true;
          onLongPress();
        }
      }}
      className={baseCls}
    >
      {inner}
    </button>
  );
}
