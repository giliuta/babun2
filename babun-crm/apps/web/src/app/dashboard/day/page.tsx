"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import {
  useAppointments,
  useClients,
  useTeams,
  useServices,
} from "@/app/dashboard/layout";
import {
  type Appointment,
  type AppointmentStatus,
  getPaidAmount,
} from "@/lib/appointments";
import { formatDateLongRu } from "@/lib/date-utils";
import MessengerButtons from "@/components/clients/MessengerButtons";
import { buildMapUrl } from "@/lib/map-links";

// Tech Day View — one-column list of today's appointments for a single
// team, with big status buttons and call/map shortcuts. Designed for a
// field technician to run their day without touching the calendar grid.

const STATUS_ORDER: Record<AppointmentStatus, number> = {
  scheduled: 0,
  in_progress: 1,
  completed: 2,
  cancelled: 3,
};

const STATUS_LABELS_SHORT: Record<AppointmentStatus, string> = {
  scheduled: "План",
  in_progress: "В работе",
  completed: "Готово",
  cancelled: "Отмена",
};

const NEXT_STATUS: Record<AppointmentStatus, AppointmentStatus | null> = {
  scheduled: "in_progress",
  in_progress: "completed",
  completed: null,
  cancelled: null,
};

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default function TechDayPage() {
  const { appointments, upsertAppointment } = useAppointments();
  const { clients } = useClients();
  const { teams } = useTeams();
  const { services } = useServices();

  const activeTeams = useMemo(() => teams.filter((t) => t.active), [teams]);
  const [teamId, setTeamId] = useState<string>(
    () => activeTeams[0]?.id ?? ""
  );
  const [dateKey, setDateKey] = useState<string>(todayKey);

  const dayAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.date === dateKey && (!teamId || a.team_id === teamId))
        .sort((a, b) => {
          const ra = STATUS_ORDER[a.status];
          const rb = STATUS_ORDER[b.status];
          if (ra !== rb) return ra - rb;
          return a.time_start.localeCompare(b.time_start);
        }),
    [appointments, dateKey, teamId]
  );

  const totals = useMemo(() => {
    let completed = 0;
    let income = 0;
    for (const a of dayAppointments) {
      if (a.status === "completed") {
        completed++;
        income += getPaidAmount(a);
      }
    }
    return { completed, income };
  }, [dayAppointments]);

  const clientsById = useMemo(() => {
    const map = new Map<string, (typeof clients)[number]>();
    for (const c of clients) map.set(c.id, c);
    return map;
  }, [clients]);

  const servicesById = useMemo(() => {
    const map = new Map<string, (typeof services)[number]>();
    for (const s of services) map.set(s.id, s);
    return map;
  }, [services]);

  const shiftDay = (delta: number) => {
    const [y, m, d] = dateKey.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + delta);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    setDateKey(`${yy}-${mm}-${dd}`);
  };

  const advance = (apt: Appointment) => {
    const next = NEXT_STATUS[apt.status];
    if (!next) return;
    upsertAppointment({
      ...apt,
      status: next,
      updated_at: new Date().toISOString(),
    });
  };

  return (
    <>
      <PageHeader title="День мастера" />
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-xl mx-auto p-3 space-y-3">
          {/* Date nav */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftDay(-1)}
              className="w-11 h-11 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600 active:scale-95"
              aria-label="Предыдущий день"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div className="flex-1 text-center">
              <div className="text-[11px] uppercase tracking-wider text-gray-400">
                {dateKey === todayKey() ? "Сегодня" : ""}
              </div>
              <div className="text-[14px] font-semibold text-gray-900 capitalize">
                {formatDateLongRu(dateKey)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => shiftDay(1)}
              className="w-11 h-11 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600 active:scale-95"
              aria-label="Следующий день"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Team selector */}
          {activeTeams.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto">
              {activeTeams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTeamId(t.id)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[12px] font-medium transition ${
                    teamId === t.id
                      ? "bg-indigo-600 text-white"
                      : "bg-white border border-gray-200 text-gray-600"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}

          {/* Totals strip */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Выполнено
              </div>
              <div className="text-[18px] font-bold text-emerald-600 tabular-nums">
                {totals.completed} / {dayAppointments.length}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Доход
              </div>
              <div className="text-[18px] font-bold text-indigo-600 tabular-nums">
                +{totals.income}€
              </div>
            </div>
          </div>

          {/* Appointments */}
          <div className="space-y-2">
            {dayAppointments.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 py-10 text-center text-sm text-gray-400">
                Нет записей на этот день
              </div>
            )}
            {dayAppointments.map((apt) => {
              const client = apt.client_id ? clientsById.get(apt.client_id) : null;
              const clientName =
                (client && "full_name" in client && client.full_name) ||
                apt.comment ||
                "Без клиента";
              const phone =
                client && "phone" in client ? client.phone : undefined;
              const telegram =
                client && "telegram_username" in client
                  ? client.telegram_username
                  : undefined;
              const instagram =
                client && "instagram_username" in client
                  ? client.instagram_username
                  : undefined;
              const serviceSummary = apt.service_ids
                .map((sid) => servicesById.get(sid)?.name)
                .filter(Boolean)
                .join(", ");
              const mapHref = apt.address
                ? buildMapUrl(
                    "google",
                    apt.address,
                    apt.address_lat !== null && apt.address_lng !== null
                      ? { lat: apt.address_lat, lng: apt.address_lng }
                      : null
                  )
                : null;
              const nextStatus = NEXT_STATUS[apt.status];
              const statusColor = {
                scheduled: "bg-gray-100 text-gray-600",
                in_progress: "bg-amber-100 text-amber-700",
                completed: "bg-emerald-100 text-emerald-700",
                cancelled: "bg-red-100 text-red-700 line-through",
              }[apt.status];

              return (
                <div
                  key={apt.id}
                  className="bg-white rounded-xl border border-gray-200 p-3 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-bold text-gray-900 tabular-nums">
                          {apt.time_start}–{apt.time_end}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor}`}
                        >
                          {STATUS_LABELS_SHORT[apt.status]}
                        </span>
                      </div>
                      <div className="text-[15px] font-semibold text-gray-900 truncate mt-0.5">
                        {clientName}
                      </div>
                      {serviceSummary && (
                        <div className="text-[12px] text-gray-600 truncate">
                          {serviceSummary}
                        </div>
                      )}
                      {apt.address && (
                        <div className="text-[12px] text-gray-500 truncate mt-0.5">
                          {apt.address}
                        </div>
                      )}
                    </div>
                    <MessengerButtons
                      phone={phone}
                      telegramUsername={telegram}
                      instagramUsername={instagram}
                      size="sm"
                    />
                  </div>

                  <div className="flex gap-2">
                    {nextStatus && (
                      <button
                        type="button"
                        onClick={() => advance(apt)}
                        className={`flex-1 h-11 rounded-lg text-[13px] font-semibold text-white active:scale-[0.98] ${
                          nextStatus === "completed"
                            ? "bg-emerald-600"
                            : "bg-amber-500"
                        }`}
                      >
                        {nextStatus === "in_progress"
                          ? "▶ Начать работу"
                          : "✓ Завершить"}
                      </button>
                    )}
                    {mapHref && (
                      <a
                        href={mapHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-11 px-3 rounded-lg bg-gray-100 text-gray-700 text-[13px] font-medium flex items-center gap-1.5 active:scale-[0.98]"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                          <line x1="8" y1="2" x2="8" y2="18" />
                          <line x1="16" y1="6" x2="16" y2="22" />
                        </svg>
                        Карта
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
