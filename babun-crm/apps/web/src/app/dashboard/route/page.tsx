"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import {
  useAppointments,
  useClients,
  useServices,
  useTeams,
} from "@/app/dashboard/layout";
import {
  STATUS_LABELS,
  type Appointment,
  type AppointmentStatus,
} from "@/lib/appointments";

// Route of the day: the technician's view on the road.
// No embedded map tiles yet — URL-scheme navigation works on every
// phone (iOS opens Apple Maps / Google Maps, Android opens Google Maps)
// and avoids the API-key dependency. Upgrade to Leaflet later if we
// need pins on a map.

function todayYMD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function shiftDate(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDayLabel(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const weekday = dt.toLocaleDateString("ru-RU", { weekday: "short" });
  const day = dt.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  return `${weekday}, ${day}`;
}

const STATUS_PILL: Record<AppointmentStatus, string> = {
  scheduled: "bg-sky-100 text-sky-700",
  in_progress: "bg-violet-100 text-violet-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-gray-100 text-gray-500 line-through",
};

export default function RouteDayPage() {
  const router = useRouter();
  const { appointments } = useAppointments();
  const { clients } = useClients();
  const { teams } = useTeams();
  const { services } = useServices();

  const [date, setDate] = useState(todayYMD());
  const [teamId, setTeamId] = useState<string | null>(null);

  const dayList = useMemo<Appointment[]>(() => {
    return appointments
      .filter((a) => a.date === date && a.kind === "work")
      .filter((a) => (teamId ? a.team_id === teamId : true))
      .filter((a) => a.status !== "cancelled")
      .sort((a, b) => a.time_start.localeCompare(b.time_start));
  }, [appointments, date, teamId]);

  const clientsById = useMemo(() => {
    const map = new Map(clients.map((c) => [c.id, c]));
    return map;
  }, [clients]);

  const servicesById = useMemo(() => {
    const map = new Map(services.map((s) => [s.id, s]));
    return map;
  }, [services]);

  // Appointments that actually have a usable address — drives
  // the "open whole route" link.
  const withAddress = useMemo(
    () => dayList.filter((a) => a.address.trim().length > 0),
    [dayList]
  );

  const openAllInMaps = () => {
    if (withAddress.length === 0) return;
    // Google Maps multi-stop URL. Last point is destination, rest are
    // waypoints (max 9 in the URL scheme). For our 6-8 daily stops
    // that's plenty.
    const points = withAddress.map((a) => encodeURIComponent(a.address));
    if (points.length === 1) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${points[0]}`,
        "_blank"
      );
      return;
    }
    const destination = points[points.length - 1];
    const waypoints = points.slice(0, -1).join("|");
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${destination}&waypoints=${waypoints}&travelmode=driving`,
      "_blank"
    );
  };

  return (
    <>
      <PageHeader title="Маршрут дня" subtitle={formatDayLabel(date)} />
      <div className="flex-1 overflow-y-auto bg-gray-50" style={{ paddingBottom: "7rem" }}>
        <div className="max-w-2xl mx-auto p-3 space-y-3">
          {/* Date nav + team filter */}
          <div className="bg-white rounded-2xl border border-gray-200 p-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDate(shiftDate(date, -1))}
              aria-label="Предыдущий день"
              className="w-10 h-10 flex items-center justify-center rounded-xl active:bg-gray-100"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setDate(todayYMD())}
              className="flex-1 h-10 rounded-xl bg-violet-50 text-violet-700 text-sm font-medium active:bg-violet-100"
            >
              Сегодня
            </button>
            <button
              type="button"
              onClick={() => setDate(shiftDate(date, 1))}
              aria-label="Следующий день"
              className="w-10 h-10 flex items-center justify-center rounded-xl active:bg-gray-100"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {teams.length > 1 && (
            <div className="flex gap-2 overflow-x-auto -mx-3 px-3 pb-1">
              <TeamChip
                label="Все бригады"
                active={teamId === null}
                onClick={() => setTeamId(null)}
              />
              {teams.map((t) => (
                <TeamChip
                  key={t.id}
                  label={t.name}
                  color={t.color}
                  active={teamId === t.id}
                  onClick={() => setTeamId(t.id)}
                />
              ))}
            </div>
          )}

          {/* Open-all button */}
          {withAddress.length > 0 && (
            <button
              type="button"
              onClick={openAllInMaps}
              className="w-full h-12 rounded-2xl bg-violet-600 text-white text-sm font-semibold active:bg-violet-700 flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
              Построить маршрут ({withAddress.length})
            </button>
          )}

          {/* List */}
          {dayList.length === 0 ? (
            <EmptyState />
          ) : (
            <ol className="space-y-2">
              {dayList.map((apt, idx) => {
                const client = apt.client_id ? clientsById.get(apt.client_id) : null;
                const clientName = client?.full_name || apt.comment || "Без клиента";
                const phone = client?.phone ?? "";
                const hasAddress = apt.address.trim().length > 0;
                const svc = apt.service_ids
                  .map((id) => servicesById.get(id)?.name)
                  .filter(Boolean);
                const svcSummary =
                  svc.length === 0
                    ? ""
                    : svc.length === 1
                    ? svc[0]
                    : `${svc[0]} +${svc.length - 1}`;
                const team = teams.find((t) => t.id === apt.team_id);

                return (
                  <li
                    key={apt.id}
                    className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
                  >
                    {/* Head row */}
                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard/appointment/${apt.id}`)}
                      className="w-full text-left px-3 py-3 flex items-start gap-3 active:bg-gray-50"
                    >
                      <div className="w-9 h-9 rounded-full bg-violet-600 text-white text-[15px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[15px] font-semibold text-gray-900">
                            {apt.time_start}
                          </span>
                          <span className="text-gray-400">·</span>
                          <span className="text-[15px] text-gray-900 truncate">
                            {clientName}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${STATUS_PILL[apt.status]}`}
                          >
                            {STATUS_LABELS[apt.status]}
                          </span>
                        </div>
                        {svcSummary && (
                          <div className="text-[12px] text-gray-600 mt-0.5 truncate">
                            {svcSummary}
                          </div>
                        )}
                        {team && (
                          <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ background: team.color || "#8b5cf6" }}
                            />
                            {team.name}
                          </div>
                        )}
                        <div
                          className={`text-[13px] mt-1 truncate ${
                            hasAddress ? "text-gray-700" : "text-amber-600"
                          }`}
                        >
                          {hasAddress ? apt.address : "⚠ адрес не указан"}
                        </div>
                      </div>
                    </button>

                    {/* Action row */}
                    <div className="grid grid-cols-2 border-t border-gray-100">
                      <a
                        href={
                          hasAddress
                            ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(apt.address)}`
                            : undefined
                        }
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => {
                          if (!hasAddress) e.preventDefault();
                        }}
                        className={`h-11 flex items-center justify-center gap-2 text-[13px] font-medium border-r border-gray-100 ${
                          hasAddress
                            ? "text-violet-700 active:bg-violet-50"
                            : "text-gray-300"
                        }`}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polygon points="3 11 22 2 13 21 11 13 3 11" />
                        </svg>
                        Навигация
                      </a>
                      <a
                        href={phone ? `tel:${phone}` : undefined}
                        onClick={(e) => {
                          if (!phone) e.preventDefault();
                        }}
                        className={`h-11 flex items-center justify-center gap-2 text-[13px] font-medium ${
                          phone ? "text-emerald-700 active:bg-emerald-50" : "text-gray-300"
                        }`}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" />
                        </svg>
                        Позвонить
                      </a>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}

function TeamChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 h-9 px-3 rounded-full text-[12px] font-medium flex items-center gap-1.5 border transition-colors ${
        active
          ? "bg-violet-600 text-white border-violet-600"
          : "bg-white text-gray-700 border-gray-200"
      }`}
    >
      {color && (
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: color }}
        />
      )}
      {label}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 mx-auto flex items-center justify-center mb-3">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
      </div>
      <div className="text-[15px] font-semibold text-gray-800">На этот день записей нет</div>
      <div className="text-[13px] text-gray-500 mt-1">
        Выберите другой день или создайте запись в календаре.
      </div>
    </div>
  );
}
