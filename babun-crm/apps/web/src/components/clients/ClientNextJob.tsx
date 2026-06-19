"use client";

// v813 — NEXT-JOB hero for the unified client card. The single loud
// surface: it owns the alarm hue (SOLID red when ТО is overdue), so no
// other block needs to shout. Priority: future appointment → overdue ТО
// → soon ТО → generic «Записать». Booking entries carry
// client_id+location_id+team_id so the sheet opens pre-aimed.

import { useRouter } from "next/navigation";
import { Calendar, CalendarPlus, Wrench, ChevronRight } from "@babun/shared/icons";
import type { Client } from "@babun/shared/local/clients";
import type { ClientStats } from "@babun/shared/local/selectors/client-stats";
import type { ServiceDueSummary } from "@babun/shared/local/selectors/service-due";
import { buildBookingHref } from "@/lib/clients/booking-link";
import { haptic } from "@/lib/haptics";

interface ClientNextJobProps {
  client: Client;
  stats: ClientStats | undefined;
  serviceDue: ServiceDueSummary;
  /**
   * Create mode: run before navigating (persists the draft so the booking
   * deep-link's client_id resolves). Returning false aborts the nav.
   */
  beforeNavigate?: () => Promise<boolean>;
}

type Tone = "accent" | "info" | "alert" | "warn";

const MONTHS_RU_SHORT = [
  "янв", "фев", "мар", "апр", "мая", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

function aptLabel(nextApt: { date: string; time: string }): string {
  const [y, m, d] = nextApt.date.split("-").map(Number);
  if (!y || !m || !d) return `${nextApt.date} · ${nextApt.time}`;
  const dt = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((dt.getTime() - today.getTime()) / 86400000);
  if (days === 0) return `сегодня · ${nextApt.time}`;
  if (days === 1) return `завтра · ${nextApt.time}`;
  return `${d} ${MONTHS_RU_SHORT[m - 1] ?? ""} · ${nextApt.time}`;
}

// Solid surfaces use white text; tinted surfaces use the hue.
const TONE: Record<Tone, { wrap: string; ic: string; title: string; sub: string; chev: string }> = {
  alert: {
    wrap: "bg-[var(--system-red)]",
    ic: "bg-white/18 text-white",
    title: "text-white",
    sub: "text-white/85",
    chev: "text-white/90",
  },
  accent: {
    wrap: "bg-[var(--accent)]",
    ic: "bg-white/18 text-white",
    title: "text-white",
    sub: "text-white/85",
    chev: "text-white/90",
  },
  warn: {
    wrap: "bg-[rgba(199,122,0,0.12)]",
    ic: "bg-[rgba(199,122,0,0.16)] text-[#C77A00]",
    title: "text-[#C77A00]",
    sub: "text-[var(--label-secondary)]",
    chev: "text-[#C77A00]",
  },
  info: {
    wrap: "bg-[var(--accent-tint)]",
    ic: "bg-[rgba(62,136,247,0.16)] text-[var(--accent)]",
    title: "text-[var(--accent)]",
    sub: "text-[var(--label-secondary)]",
    chev: "text-[var(--accent)]",
  },
};

export default function ClientNextJob({ client, stats, serviceDue, beforeNavigate }: ClientNextJobProps) {
  const router = useRouter();
  const primaryLocationId =
    client.locations?.find((l) => l.isPrimary)?.id ?? client.locations?.[0]?.id ?? null;

  let tone: Tone;
  let Icon: typeof Calendar;
  let title: string;
  let subtitle: string;
  let href: string;

  if (stats?.nextApt) {
    tone = "info";
    Icon = Calendar;
    title = `Запись · ${aptLabel(stats.nextApt)}`;
    subtitle = "Открыть в календаре";
    href = `/dashboard?date=${encodeURIComponent(stats.nextApt.date)}`;
  } else if (serviceDue.overdue.length > 0) {
    const u = serviceDue.overdue[0];
    tone = "alert";
    Icon = Wrench;
    title = `ТО просрочено · ${Math.abs(u.due.daysUntil)} дн · ${u.room}`;
    subtitle = "Записать на ТО — команда подставлена";
    href = buildBookingHref({ clientId: client.id, locationId: u.locationId, teamId: stats?.lastTeamId ?? null });
  } else if (serviceDue.soon.length > 0) {
    const u = serviceDue.soon[0];
    tone = "warn";
    Icon = Wrench;
    title = `Скоро ТО · ${u.room}`;
    subtitle = `через ${u.due.daysUntil} дн · записать на ТО`;
    href = buildBookingHref({ clientId: client.id, locationId: u.locationId, teamId: stats?.lastTeamId ?? null });
  } else {
    tone = "accent";
    Icon = CalendarPlus;
    title = "Записать";
    subtitle = stats && stats.visits > 0 ? "Новая запись" : "Первый визит этого клиента";
    href = buildBookingHref({ clientId: client.id, locationId: primaryLocationId, teamId: stats?.lastTeamId ?? null });
  }

  const t = TONE[tone];

  return (
    <button
      type="button"
      onClick={async () => {
        haptic("tap");
        if (beforeNavigate && !(await beforeNavigate())) return;
        router.push(href);
      }}
      className={`w-full flex items-center gap-3 min-h-[62px] rounded-2xl px-3.5 py-2.5 text-left ${t.wrap} active:opacity-90`}
    >
      <span className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${t.ic}`}>
        <Icon size={20} strokeWidth={2} />
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-[16px] font-semibold tracking-[-0.01em] ${t.title}`}>{title}</span>
        <span className={`block text-[13px] truncate ${t.sub}`}>{subtitle}</span>
      </span>
      <span className={`shrink-0 ${t.chev}`}>
        <ChevronRight size={22} strokeWidth={2.2} />
      </span>
    </button>
  );
}
