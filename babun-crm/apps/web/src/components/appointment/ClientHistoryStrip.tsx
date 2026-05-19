"use client";

import { useMemo } from "react";
import type { Appointment } from "@babun/shared/local/appointments";
import type { Service } from "@babun/shared/local/services";
import { formatEUR } from "@babun/shared/common/utils/money";

// Brief 1 #23 — last 5 past non-cancelled visits for the picked
// client. Read-only inline strip shown above the location block when
// a client is set; full history lives at /dashboard/clients/[id].
// v612: extracted from AppointmentSheet as part of the Sprint #4 §9
// decomposition.

interface ClientHistoryStripProps {
  clientId: string;
  excludeAppointmentId: string;
  appointments: Appointment[];
  catalog: Service[];
  // STORY audit: до этого строки истории были read-only, и диспетчер
  // не мог открыть прошлую запись чтобы посмотреть детали (часто
  // нужно — «сколько брали в прошлый раз?», «какая была причина
  // отмены?»). Optional callback — если parent передаёт, строки
  // становятся кликабельными button-ами и открывают AppointmentSheet
  // на этой записи.
  onOpenAppointment?: (appointment: Appointment) => void;
}

const HORIZON = 5;

export default function ClientHistoryStrip({
  clientId,
  excludeAppointmentId,
  appointments,
  catalog,
  onOpenAppointment,
}: ClientHistoryStripProps) {
  const servicesById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of catalog) m.set(s.id, s.name);
    return m;
  }, [catalog]);

  const history = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return appointments
      .filter(
        (a) =>
          a.client_id === clientId &&
          a.id !== excludeAppointmentId &&
          a.status !== "cancelled" &&
          a.date <= todayKey,
      )
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.time_start.localeCompare(a.time_start);
      })
      .slice(0, HORIZON);
  }, [appointments, clientId, excludeAppointmentId]);

  if (history.length === 0) return null;

  return (
    <div className="px-4 pt-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1.5">
        Прошлые визиты ({history.length})
      </div>
      <div className="bg-[var(--surface-card)] rounded-[14px] border border-[var(--separator)] divide-y divide-[var(--separator)] overflow-hidden">
        {history.map((apt) => {
          const qty = new Map<string, number>();
          for (const id of apt.service_ids)
            qty.set(id, (qty.get(id) ?? 0) + 1);
          const summary = Array.from(qty.entries())
            .map(([id, q]) => {
              const name = servicesById.get(id) ?? "Услуга";
              return q > 1 ? `x${q} ${name}` : name;
            })
            .join(", ");
          const inner = (
            <>
              <span className="w-[68px] shrink-0 tabular-nums text-[var(--label-secondary)]">
                {formatShortDate(apt.date)}
              </span>
              <span className="flex-1 min-w-0 text-[var(--label)] truncate">
                {summary || "Без услуг"}
              </span>
              {apt.total_amount > 0 && (
                <span className="shrink-0 tabular-nums font-semibold text-[var(--label)]">
                  {formatEUR(apt.total_amount)}
                </span>
              )}
            </>
          );
          if (onOpenAppointment) {
            return (
              <button
                key={apt.id}
                type="button"
                onClick={() => onOpenAppointment(apt)}
                className="w-full px-3 min-h-[44px] py-2 flex items-center gap-2 text-[12px] text-left active:bg-[var(--fill-quaternary)] transition"
              >
                {inner}
              </button>
            );
          }
          return (
            <div
              key={apt.id}
              className="px-3 py-2 flex items-start gap-2 text-[12px]"
            >
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Shared "12 мая" formatter for the history strip and the live-preview
// save button. Exported so AppointmentSheet doesn't re-derive it.
export function formatShortDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d)
    .toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
    .replace(/\.$/, "");
}
