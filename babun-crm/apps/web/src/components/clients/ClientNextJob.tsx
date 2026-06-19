"use client";

// v813 — NEXT-JOB hero for the unified client card.
//
// One big, state-driven button that answers «что сделать сейчас», in
// priority order:
//   (a) client has a future appointment   → open it in the calendar
//   (b) some A/C unit ТО is overdue        → pre-aimed «Записать на ТО»
//   (c) some A/C unit ТО is due soon       → pre-aimed «Записать на ТО»
//   (d) nothing pending                    → generic «Записать»
//
// Booking entries carry client_id + location_id + team_id(lastTeamId)
// so the AppointmentSheet opens pre-filled (see lib/clients/booking-link).

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
  if (days === 0) return `Сегодня · ${nextApt.time}`;
  if (days === 1) return `Завтра · ${nextApt.time}`;
  return `${d} ${MONTHS_RU_SHORT[m - 1] ?? ""} · ${nextApt.time}`;
}

const TONE: Record<Tone, { wrap: string; icon: string; title: string; chev: string }> = {
  accent: {
    wrap: "bg-[var(--accent)] active:opacity-90",
    icon: "bg-white/20 text-white",
    title: "text-white",
    chev: "text-white/90",
  },
  info: {
    wrap: "bg-[var(--accent-tint)] active:bg-[var(--fill-secondary)]",
    icon: "bg-[rgba(62,136,247,0.16)] text-[var(--accent)]",
    title: "text-[var(--accent)]",
    chev: "text-[var(--accent)]",
  },
  alert: {
    wrap: "bg-[rgba(229,70,59,0.08)] border border-[rgba(229,70,59,0.30)] active:bg-[rgba(229,70,59,0.14)]",
    icon: "bg-[rgba(229,70,59,0.14)] text-[var(--system-red)]",
    title: "text-[var(--system-red)]",
    chev: "text-[var(--system-red)]",
  },
  warn: {
    wrap: "bg-[rgba(199,122,0,0.08)] border border-[rgba(199,122,0,0.28)] active:bg-[rgba(199,122,0,0.14)]",
    icon: "bg-[rgba(199,122,0,0.14)] text-[#C77A00]",
    title: "text-[#C77A00]",
    chev: "text-[#C77A00]",
  },
};

export default function ClientNextJob({ client, stats, serviceDue }: ClientNextJobProps) {
  const router = useRouter();
  const primaryLocationId =
    client.locations?.find((l) => l.isPrimary)?.id ??
    client.locations?.[0]?.id ??
    null;

  // Resolve the hero state.
  let tone: Tone;
  let Icon: typeof Calendar;
  let title: string;
  let subtitle: string;
  let href: string;
  const subtitleSub = "команда и дата подставлены";

  if (stats?.nextApt) {
    tone = "info";
    Icon = Calendar;
    title = `Запись · ${aptLabel(stats.nextApt)}`;
    subtitle = "Клиент уже записан — открыть в календаре";
    href = `/dashboard?date=${encodeURIComponent(stats.nextApt.date)}`;
  } else if (serviceDue.overdue.length > 0) {
    const u = serviceDue.overdue[0];
    tone = "alert";
    Icon = Wrench;
    title = `ТО просрочено · ${u.room}`;
    subtitle = `−${Math.abs(u.due.daysUntil)} дн · записать на ТО, ${subtitleSub}`;
    href = buildBookingHref({
      clientId: client.id,
      locationId: u.locationId,
      teamId: stats?.lastTeamId ?? null,
    });
  } else if (serviceDue.soon.length > 0) {
    const u = serviceDue.soon[0];
    tone = "warn";
    Icon = Wrench;
    title = `Скоро ТО · ${u.room}`;
    subtitle = `через ${u.due.daysUntil} дн · записать на ТО, ${subtitleSub}`;
    href = buildBookingHref({
      clientId: client.id,
      locationId: u.locationId,
      teamId: stats?.lastTeamId ?? null,
    });
  } else {
    tone = "accent";
    Icon = CalendarPlus;
    title = "Записать";
    subtitle = stats && stats.visits > 0 ? "Новая запись" : "Первый визит этого клиента";
    href = buildBookingHref({
      clientId: client.id,
      locationId: primaryLocationId,
      teamId: stats?.lastTeamId ?? null,
    });
  }

  const t = TONE[tone];

  return (
    <button
      type="button"
      onClick={() => {
        haptic("tap");
        router.push(href);
      }}
      className={`w-full flex items-center gap-3 h-[64px] rounded-2xl px-3.5 text-left ${t.wrap}`}
    >
      <span className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${t.icon}`}>
        <Icon size={20} strokeWidth={2} />
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-[15px] font-semibold truncate ${t.title}`}>{title}</span>
        <span
          className={`block text-[12.5px] truncate ${
            tone === "accent" ? "text-white/85" : "text-[var(--label-secondary)]"
          }`}
        >
          {subtitle}
        </span>
      </span>
      <span className={`shrink-0 ${t.chev}`}>
        <ChevronRight size={22} strokeWidth={2.2} />
      </span>
    </button>
  );
}
