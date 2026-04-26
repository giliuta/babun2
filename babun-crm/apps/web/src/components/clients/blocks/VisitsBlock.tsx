"use client";

// STORY-034 — Visits timeline.  Replaces the «Активность» tab.
// Open by default per spec — it's the most-asked piece of context.
// Tap on a row navigates to the calendar focused on that date so the
// dispatcher can see the whole day around the visit.

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Appointment } from "@/lib/appointments";
import type { Service } from "@/lib/services";
import { formatEUR } from "@babun/shared/common/utils/money";
import ClientCard from "../ClientCard";
import { haptic } from "@/lib/haptics";

interface VisitsBlockProps {
  clientId: string;
  appointments: Appointment[];
  services: Service[];
}

export default function VisitsBlock({
  clientId,
  appointments,
  services,
}: VisitsBlockProps) {
  const router = useRouter();
  const own = useMemo(
    () =>
      appointments
        .filter((a) => a.client_id === clientId)
        .sort((a, b) =>
          `${b.date}${b.time_start}`.localeCompare(`${a.date}${a.time_start}`),
        ),
    [appointments, clientId],
  );

  const servicesById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of services) m.set(s.id, s.name);
    return m;
  }, [services]);

  return (
    <ClientCard
      kind="visits"
      title="История визитов"
      badge={own.length || undefined}
      defaultOpen
    >
      {own.length === 0 ? (
        <div className="px-4 py-4 text-[13px] text-[var(--label-tertiary)]">
          Записей пока нет.
        </div>
      ) : (
        <div className="divide-y divide-[var(--separator)]">
          {own.slice(0, 50).map((apt) => (
            <VisitRow
              key={apt.id}
              apt={apt}
              servicesById={servicesById}
              onOpen={() => {
                haptic("tap");
                router.push(`/dashboard?date=${encodeURIComponent(apt.date)}`);
              }}
            />
          ))}
          {own.length > 50 && (
            <div className="px-4 py-2 text-[12px] text-[var(--label-tertiary)] text-center">
              + ещё {own.length - 50} визитов
            </div>
          )}
        </div>
      )}
    </ClientCard>
  );
}

function VisitRow({
  apt,
  servicesById,
  onOpen,
}: {
  apt: Appointment;
  servicesById: Map<string, string>;
  onOpen: () => void;
}) {
  const status = (() => {
    if (apt.status === "completed")
      return { label: "Выполнено", cls: "bg-[rgba(52,199,89,0.15)] text-[var(--system-green)]" };
    if (apt.status === "cancelled")
      return { label: "Отменено", cls: "bg-[var(--fill-tertiary)] text-[var(--label-secondary)]" };
    if (apt.status === "in_progress")
      return { label: "В работе", cls: "bg-[rgba(255,149,0,0.14)] text-[var(--system-orange)]" };
    return { label: "Запланировано", cls: "bg-[rgba(0,122,255,0.12)] text-[var(--system-blue)]" };
  })();

  const summary = (() => {
    const named = (apt.services ?? [])
      .map((s) => servicesById.get(s.serviceId))
      .filter(Boolean) as string[];
    if (named.length > 0)
      return named.length === 1 ? named[0] : `${named[0]} +${named.length - 1}`;
    return apt.comment || "—";
  })();

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-2 px-4 py-2.5 text-left active:bg-[var(--fill-quaternary)]"
    >
      <div className="flex-1 min-w-0">
        <div className="text-[14px] text-[var(--label)] truncate">
          {summary}
        </div>
        <div className="text-[12px] text-[var(--label-secondary)] tabular-nums">
          {formatVisitDate(apt.date)} · {apt.time_start}
        </div>
      </div>
      <span
        className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.cls}`}
      >
        {status.label}
      </span>
      <span className="shrink-0 w-14 text-right text-[13px] font-bold text-[var(--system-green)] tabular-nums">
        {formatEUR(apt.total_amount)}
      </span>
    </button>
  );
}

function formatVisitDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
