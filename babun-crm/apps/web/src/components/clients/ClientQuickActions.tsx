"use client";

// v813 — 5 always-visible quick actions for the unified client card.
//
// Per the locked design the row is no longer «2 primary + Ещё»; all five
// are on screen, equal weight, disabled-not-hidden when their data is
// missing (so the row never reflows):
//   Звонок · Записать · WhatsApp · Навигация · Напомнить
//
// «Записать» is a pre-aimed booking deep-link (primary object +
// lastTeamId). «Напомнить» is delegated to the parent (sets
// client.reminder_at via a date picker).

import { useRouter } from "next/navigation";
import {
  Phone as PhoneIcon,
  CalendarPlus,
  MessageCircle,
  Navigation,
  Bell,
} from "@babun/shared/icons";
import type { Client } from "@babun/shared/local/clients";
import type { ClientStats } from "@babun/shared/local/selectors/client-stats";
import { whatsappUrl, telUrl } from "@babun/shared/common/utils/messenger-links";
import { buildMapUrl } from "@babun/shared/common/utils/map-links";
import { buildBookingHref } from "@/lib/clients/booking-link";
import { haptic } from "@/lib/haptics";

interface ClientQuickActionsProps {
  client: Client;
  stats: ClientStats | undefined;
  /** Parent sets client.reminder_at (opens a date picker). */
  onRemind: () => void;
}

function preferAppleMaps(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export default function ClientQuickActions({
  client,
  stats,
  onRemind,
}: ClientQuickActionsProps) {
  const router = useRouter();

  const tel = telUrl(client.phone);
  const wa = whatsappUrl(client.whatsapp_phone || client.phone);

  const primary =
    client.locations?.find((l) => l.isPrimary) ?? client.locations?.[0] ?? null;
  const navTarget = primary?.mapUrl || primary?.address || "";
  const navHref = navTarget
    ? buildMapUrl(preferAppleMaps() ? "apple" : "google", navTarget)
    : null;

  const book = () => {
    haptic("tap");
    router.push(
      buildBookingHref({
        clientId: client.id,
        locationId: primary?.id ?? null,
        teamId: stats?.lastTeamId ?? null,
      }),
    );
  };

  return (
    <div className="px-2 pt-2 pb-3 flex items-start justify-between">
      <Action label="Звонок" href={tel} icon={<PhoneIcon size={21} strokeWidth={2} />} tone="green" />
      <Action label="Записать" onClick={book} icon={<CalendarPlus size={21} strokeWidth={2} />} tone="accent" />
      <Action label="WhatsApp" href={wa} external icon={<MessageCircle size={21} strokeWidth={2} />} tone="green" />
      <Action label="Навигация" href={navHref} external icon={<Navigation size={21} strokeWidth={2} />} tone="accent" />
      <Action label="Напомнить" onClick={onRemind} icon={<Bell size={21} strokeWidth={2} />} tone="accent" />
    </div>
  );
}

interface ActionProps {
  label: string;
  icon: React.ReactNode;
  tone: "accent" | "green";
  href?: string | null;
  onClick?: () => void;
  external?: boolean;
}

function Action({ label, icon, tone, href, onClick, external }: ActionProps) {
  const enabled = onClick ? true : Boolean(href);
  const circleOn =
    tone === "green"
      ? "bg-[rgba(52,199,89,0.12)] text-[var(--system-green)]"
      : "bg-[var(--accent-tint)] text-[var(--accent)]";
  const circle = `w-[46px] h-[46px] rounded-full flex items-center justify-center ${
    enabled ? circleOn : "bg-[var(--fill-tertiary)] text-[var(--label-tertiary)]"
  }`;
  const labelCls = `text-[10.5px] ${
    enabled ? "text-[var(--label-secondary)]" : "text-[var(--label-tertiary)]"
  }`;

  const inner = (
    <>
      <span className={circle}>{icon}</span>
      <span className={labelCls}>{label}</span>
    </>
  );
  const wrap = "flex flex-col items-center gap-1.5 w-[62px] active:opacity-70";

  if (!enabled) {
    return (
      <span className={`${wrap} opacity-40`} aria-disabled>
        {inner}
      </span>
    );
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
