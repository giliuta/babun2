"use client";

// v813 — 5 always-visible quick actions for the unified client card.
//   Звонок · Записать · WhatsApp · Чат · Напомнить
// Color budget: neutral grey circles; green ONLY on the comms that dial
// out (Звонок, WhatsApp); disabled-not-hidden so the row never reflows.
// «Записать» is a pre-aimed booking deep-link; «Напомнить» is delegated
// to the parent (sets client.reminder_at); «Чат» opens the CRM chat.

import { useRouter } from "next/navigation";
import {
  Phone as PhoneIcon,
  CalendarPlus,
  MessageCircle,
  MessageSquare,
  Bell,
} from "@babun/shared/icons";
import type { Client } from "@babun/shared/local/clients";
import type { ClientStats } from "@babun/shared/local/selectors/client-stats";
import { whatsappUrl, telUrl } from "@babun/shared/common/utils/messenger-links";
import { buildBookingHref } from "@/lib/clients/booking-link";
import { haptic } from "@/lib/haptics";

interface ClientQuickActionsProps {
  client: Client;
  stats: ClientStats | undefined;
  /** Parent sets client.reminder_at (opens a date picker). */
  onRemind: () => void;
}

export default function ClientQuickActions({ client, stats, onRemind }: ClientQuickActionsProps) {
  const router = useRouter();

  const tel = telUrl(client.phone);
  const wa = whatsappUrl(client.whatsapp_phone || client.phone);
  const primary =
    client.locations?.find((l) => l.isPrimary) ?? client.locations?.[0] ?? null;

  const book = () => {
    haptic("tap");
    router.push(
      buildBookingHref({ clientId: client.id, locationId: primary?.id ?? null, teamId: stats?.lastTeamId ?? null }),
    );
  };
  const chat = () => {
    haptic("tap");
    router.push(`/dashboard/chats?client_id=${client.id}`);
  };

  return (
    <div className="px-2 pt-1 pb-4 flex items-start justify-between">
      <Action label="Звонок" href={tel} comm icon={<PhoneIcon size={22} strokeWidth={2} />} />
      <Action label="Записать" onClick={book} icon={<CalendarPlus size={22} strokeWidth={2} />} />
      <Action label="WhatsApp" href={wa} external comm icon={<MessageCircle size={22} strokeWidth={2} />} />
      <Action label="Чат" onClick={chat} icon={<MessageSquare size={22} strokeWidth={2} />} />
      <Action label="Напомнить" onClick={onRemind} icon={<Bell size={22} strokeWidth={2} />} />
    </div>
  );
}

interface ActionProps {
  label: string;
  icon: React.ReactNode;
  comm?: boolean;
  href?: string | null;
  onClick?: () => void;
  external?: boolean;
}

function Action({ label, icon, comm, href, onClick, external }: ActionProps) {
  const enabled = onClick ? true : Boolean(href);
  const iconColor = !enabled
    ? "text-[var(--label-tertiary)]"
    : comm
      ? "text-[var(--system-green)]"
      : "text-[var(--label)]";
  const circle = `w-12 h-12 rounded-full flex items-center justify-center bg-[var(--fill-tertiary)] ${iconColor}`;
  const labelCls = `text-[11px] ${enabled ? "text-[var(--label-secondary)]" : "text-[var(--label-tertiary)]"}`;
  const wrap = "flex flex-col items-center gap-1.5 active:opacity-70";

  const inner = (
    <>
      <span className={circle}>{icon}</span>
      <span className={labelCls}>{label}</span>
    </>
  );

  if (!enabled) {
    return <span className={`${wrap} opacity-40`} aria-disabled>{inner}</span>;
  }
  if (href) {
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        onClick={() => haptic("tap")}
        className={wrap}
        aria-label={label}
      >
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={wrap} aria-label={label}>
      {inner}
    </button>
  );
}
