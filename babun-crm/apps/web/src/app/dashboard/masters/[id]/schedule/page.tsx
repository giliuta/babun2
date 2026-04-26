"use client";

// Sprint 034 — master schedule (v307).
//
// Lists upcoming + recent appointments for this master. Scope-filtered
// by appointment.master_id. No fancy timeline — a simple grouped list
// (Сегодня / Завтра / На следующей неделе / Прошлое) with tap →
// go to the dashboard calendar for that date.
//
// Saves the user from scrolling the whole brigade calendar to find
// a single person's day.

import { use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import {
  useAppointments,
  useClients,
  useMasters,
} from "@/app/dashboard/layout";
import { haptic } from "@/lib/haptics";
import type { Appointment } from "@babun/shared/local/appointments";
import MasterSectionShell from "@/components/masters/MasterSectionShell";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface Bucket {
  key: string;
  title: string;
  items: Appointment[];
}

const STATUS_LABEL: Record<Appointment["status"], string> = {
  scheduled: "запланировано",
  in_progress: "в работе",
  completed: "закрыто",
  cancelled: "отменено",
};
const STATUS_TONE: Record<Appointment["status"], string> = {
  scheduled: "text-[var(--accent)]",
  in_progress: "text-[var(--system-orange)]",
  completed: "text-[var(--system-green)]",
  cancelled: "text-[var(--system-red)]",
};

export default function MasterSchedulePage({ params }: RouteParams) {
  const { id } = use(params);
  const router = useRouter();
  const { masters } = useMasters();
  const { appointments } = useAppointments();
  const { clients } = useClients();

  const master = masters.find((m) => m.id === id);

  const buckets = useMemo<Bucket[]>(() => {
    if (!master) return [];
    const mine = appointments.filter((a) => a.master_id === master.id);
    if (mine.length === 0) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const nextWeekEnd = new Date(today);
    nextWeekEnd.setDate(today.getDate() + 7);

    const todayKey = formatISODate(today);
    const tomorrowKey = formatISODate(tomorrow);

    const past: Appointment[] = [];
    const todays: Appointment[] = [];
    const tomorrows: Appointment[] = [];
    const thisWeek: Appointment[] = [];
    const later: Appointment[] = [];

    for (const a of mine) {
      const d = new Date(a.date);
      d.setHours(0, 0, 0, 0);
      if (a.date === todayKey) {
        todays.push(a);
      } else if (a.date === tomorrowKey) {
        tomorrows.push(a);
      } else if (d < today) {
        past.push(a);
      } else if (d <= nextWeekEnd) {
        thisWeek.push(a);
      } else {
        later.push(a);
      }
    }

    const byTimeAsc = (a: Appointment, b: Appointment) =>
      a.date === b.date
        ? a.time_start.localeCompare(b.time_start)
        : a.date.localeCompare(b.date);
    const byTimeDesc = (a: Appointment, b: Appointment) =>
      a.date === b.date
        ? b.time_start.localeCompare(a.time_start)
        : b.date.localeCompare(a.date);

    const out: Bucket[] = [];
    if (todays.length > 0) {
      out.push({
        key: "today",
        title: "Сегодня",
        items: todays.sort(byTimeAsc),
      });
    }
    if (tomorrows.length > 0) {
      out.push({
        key: "tomorrow",
        title: "Завтра",
        items: tomorrows.sort(byTimeAsc),
      });
    }
    if (thisWeek.length > 0) {
      out.push({
        key: "week",
        title: "На этой неделе",
        items: thisWeek.sort(byTimeAsc),
      });
    }
    if (later.length > 0) {
      out.push({
        key: "later",
        title: "Позже",
        items: later.sort(byTimeAsc),
      });
    }
    if (past.length > 0) {
      out.push({
        key: "past",
        title: "Прошлое",
        items: past.sort(byTimeDesc).slice(0, 30),
      });
    }
    return out;
  }, [master, appointments]);

  if (!master) {
    return (
      <MasterSectionShell masterId={id} title="Расписание" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Сотрудник не найден.
        </div>
      </MasterSectionShell>
    );
  }

  const openInCalendar = (apt: Appointment) => {
    haptic("tap");
    router.push(`/dashboard?date=${apt.date}`);
  };

  const clientName = (apt: Appointment): string => {
    if (apt.client_id) {
      const c = clients.find((x) => x.id === apt.client_id);
      if (c) return c.full_name;
    }
    return apt.comment || "Без клиента";
  };

  return (
    <MasterSectionShell masterId={id} title="Расписание" hideSave>
      {buckets.length === 0 && (
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-8 text-center">
          <div className="text-[15px] font-semibold text-[var(--label)] mb-1">
            Визитов пока нет
          </div>
          <div className="text-[12px] text-[var(--label-tertiary)]">
            Сюда попадают только записи, назначенные лично на этого сотрудника.
          </div>
        </div>
      )}

      {buckets.map((b) => (
        <div key={b.key}>
          <div className="px-1 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
            {b.title}
          </div>
          <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
            {b.items.map((a) => {
              const address = a.address?.trim();
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => openInCalendar(a)}
                  className="w-full flex items-start gap-3 px-4 py-3 min-h-[52px] active:bg-[var(--fill-quaternary)] transition text-left"
                >
                  <div className="flex flex-col items-center w-[52px] shrink-0 tabular-nums pt-0.5">
                    <span className="text-[11px] text-[var(--label-tertiary)] uppercase">
                      {formatDateShort(a.date)}
                    </span>
                    <span className="text-[14px] font-semibold text-[var(--label)]">
                      {a.time_start}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-[var(--label)] truncate">
                      {clientName(a)}
                    </div>
                    {address && (
                      <div className="text-[12px] text-[var(--label-secondary)] truncate flex items-center gap-1">
                        <MapPin size={11} strokeWidth={2} className="shrink-0" />
                        {address}
                      </div>
                    )}
                    <div
                      className={`text-[11px] font-medium uppercase tracking-wide mt-0.5 ${STATUS_TONE[a.status]}`}
                    >
                      {STATUS_LABEL[a.status]}
                    </div>
                  </div>
                  <div className="text-[13px] tabular-nums text-[var(--label-secondary)] shrink-0 pt-0.5">
                    {a.total_amount > 0
                      ? `${Math.round(a.total_amount)} €`
                      : ""}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </MasterSectionShell>
  );
}

function formatISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  const month = dt.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "");
  return `${d} ${month}`;
}
