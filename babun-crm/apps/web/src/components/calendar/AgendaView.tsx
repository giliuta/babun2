"use client";

// Brief 1 #25 — Agenda view: chronological list of upcoming visits.
//
// Different goal from Day/Week/Month: those answer «what does today
// look like?»; Agenda answers «what's next on my plate, all in one
// scrolling list». Useful for dispatchers planning routes or when
// the user wants a single linear feed instead of a calendar grid.
//
// Scope: visits from `currentDate` forward, capped at +60 days so the
// list doesn't grow unbounded. Cancelled visits hidden when the
// brigade has hide-cancelled on (parent-passed). Tap a row opens the
// same appointment sheet as everywhere else.

import { useMemo } from "react";
import type { Appointment } from "@babun/shared/local/appointments";
import {
  STATUS_LABELS,
  getPaidAmount,
} from "@babun/shared/local/appointments";
import type { Service } from "@babun/shared/local/services";
import type { Client } from "@babun/shared/local/clients";
import { formatEUR } from "@babun/shared/common/utils/money";

const HORIZON_DAYS = 60;

interface AgendaViewProps {
  currentDate: Date;
  appointments: Appointment[];
  clientsById: Record<string, Client>;
  services: Service[];
  hideCancelled?: boolean;
  onAppointmentClick: (appointment: Appointment) => void;
}

export default function AgendaView({
  currentDate,
  appointments,
  clientsById,
  services,
  hideCancelled = false,
  onAppointmentClick,
}: AgendaViewProps) {
  const servicesById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of services) m.set(s.id, s.name);
    return m;
  }, [services]);

  const items = useMemo(() => {
    const start = new Date(currentDate);
    start.setHours(0, 0, 0, 0);
    const startKey = formatKey(start);
    const end = new Date(start);
    end.setDate(end.getDate() + HORIZON_DAYS);
    const endKey = formatKey(end);

    const filtered = appointments
      .filter((a) => {
        if (a.date < startKey || a.date > endKey) return false;
        if (hideCancelled && a.status === "cancelled") return false;
        return true;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time_start.localeCompare(b.time_start);
      });

    // Group by date for sticky-style headers.
    const groups = new Map<string, Appointment[]>();
    for (const a of filtered) {
      const arr = groups.get(a.date) ?? [];
      arr.push(a);
      groups.set(a.date, arr);
    }
    return Array.from(groups.entries());
  }, [appointments, currentDate, hideCancelled]);

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[var(--surface-grouped)] p-8 text-center">
        <div className="text-[15px] text-[var(--label-secondary)] mb-1">
          Записей не запланировано
        </div>
        <div className="text-[12px] text-[var(--label-tertiary)] max-w-xs leading-snug">
          Ближайшие {HORIZON_DAYS} дней пусты. Создайте запись из календаря
          или вернитесь к виду «Неделя».
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
      <div className="max-w-2xl mx-auto px-4 py-3 space-y-4">
        {items.map(([dateKey, dayApts]) => (
          <section key={dateKey}>
            <h3 className="px-2 pb-1 text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
              {formatHeaderRu(dateKey)}
            </h3>
            <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] divide-y divide-[var(--separator)] overflow-hidden">
              {dayApts.map((apt) => (
                <AgendaRow
                  key={apt.id}
                  apt={apt}
                  servicesById={servicesById}
                  clientsById={clientsById}
                  onClick={() => onAppointmentClick(apt)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function AgendaRow({
  apt,
  servicesById,
  clientsById,
  onClick,
}: {
  apt: Appointment;
  servicesById: Map<string, string>;
  clientsById: Record<string, Client>;
  onClick: () => void;
}) {
  const clientName =
    (apt.client_id && clientsById[apt.client_id]?.full_name) ||
    apt.comment ||
    "Без клиента";

  const quantities = new Map<string, number>();
  for (const id of apt.service_ids) {
    quantities.set(id, (quantities.get(id) ?? 0) + 1);
  }
  const serviceSummary = Array.from(quantities.entries())
    .map(([id, qty]) => {
      const name = servicesById.get(id) ?? "Услуга";
      return qty > 1 ? `x${qty} ${name}` : name;
    })
    .join(", ");

  const total = apt.total_amount;
  const paid = getPaidAmount(apt);
  const debt = Math.max(0, total - paid);

  const statusTone =
    apt.status === "completed"
      ? "text-[var(--system-green)]"
      : apt.status === "cancelled"
      ? "text-[var(--label-tertiary)] line-through"
      : apt.status === "in_progress"
      ? "text-[var(--accent)]"
      : "text-[var(--label-secondary)]";

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`agenda-row-${apt.id}`}
      className="w-full flex items-start gap-3 px-4 py-3 min-h-[64px] active:bg-[var(--fill-quaternary)] transition text-left"
    >
      <div className="w-16 shrink-0 text-[14px] font-semibold text-[var(--label)] tabular-nums">
        {apt.time_start}
        <div className="text-[11px] font-normal text-[var(--label-tertiary)] mt-0.5">
          {apt.time_end}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-[var(--label)] truncate">
          {clientName}
        </div>
        {serviceSummary && (
          <div className="text-[12px] text-[var(--label-secondary)] truncate mt-0.5">
            {serviceSummary}
          </div>
        )}
        <div className={`text-[11px] mt-0.5 ${statusTone}`}>
          {STATUS_LABELS[apt.status]}
        </div>
      </div>
      {total > 0 && (
        <div className="shrink-0 text-right">
          <div className="text-[14px] font-semibold text-[var(--label)] tabular-nums">
            {formatEUR(total)}
          </div>
          {debt > 0 && (
            <div className="text-[11px] text-[var(--system-red)] tabular-nums mt-0.5">
              {formatEUR(debt)} к оплате
            </div>
          )}
        </div>
      )}
    </button>
  );
}

function formatKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatHeaderRu(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dateAtMidnight = new Date(date);
  dateAtMidnight.setHours(0, 0, 0, 0);

  if (dateAtMidnight.getTime() === today.getTime()) return "Сегодня";
  if (dateAtMidnight.getTime() === tomorrow.getTime()) return "Завтра";

  const fmt = date.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return fmt.charAt(0).toUpperCase() + fmt.slice(1);
}
