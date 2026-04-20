"use client";

import { useEffect, useMemo, useState } from "react";
import type { Appointment } from "@/lib/appointments";
import type { Client } from "@/lib/clients";

interface NowPillProps {
  appointments: Appointment[];
  clients: Client[];
  teamId: string;
  /** Tap handler — caller scrolls the grid to the matched appointment. */
  onOpen?: (appointmentId: string) => void;
  /** Only render on views where today is visible (day / 3days / week). */
  hidden?: boolean;
}

// Thin banner under the header. Shows what's happening right now or
// what's coming up next — "Через 18 мин → Иванов, Limassol 14:00" —
// so the dispatcher doesn't have to scan the grid for the next visit.
// Appointments that started but aren't marked in_progress get an
// amber highlight; visits in the past that never got completed glow
// rose so they can be closed.
//
// Re-ticks every 30 seconds. Re-renders are cheap because the
// computation is one linear scan of today's visits.
export default function NowPill({
  appointments,
  clients,
  teamId,
  onOpen,
  hidden,
}: NowPillProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const target = useMemo(() => findRelevantAppointment(appointments, teamId, now), [
    appointments,
    teamId,
    now,
  ]);

  if (hidden || !target) return null;

  const { appointment, state, minutesFromNow } = target;
  const client = clients.find((c) => c.id === appointment.client_id);
  const name = client?.full_name || appointment.comment || "Запись";

  const toneClass =
    state === "in-progress"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : state === "overdue"
        ? "bg-rose-50 text-rose-800 ring-rose-200"
        : "bg-violet-50 text-violet-800 ring-violet-200";

  const prefix =
    state === "in-progress"
      ? "Сейчас"
      : state === "overdue"
        ? `Не закрыто · ${minutesFromNow} мин назад`
        : `Через ${minutesFromNow} мин`;

  return (
    <button
      type="button"
      onClick={() => onOpen?.(appointment.id)}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium ring-1 rounded-none ${toneClass} active:opacity-80`}
    >
      <span className="shrink-0 tabular-nums font-semibold">{prefix}</span>
      <span className="opacity-60">→</span>
      <span className="flex-1 truncate text-left">{name}</span>
      <span className="shrink-0 tabular-nums opacity-70">{appointment.time_start}</span>
    </button>
  );
}

interface RelevantAppointment {
  appointment: Appointment;
  state: "in-progress" | "overdue" | "upcoming";
  minutesFromNow: number;
}

function findRelevantAppointment(
  appointments: Appointment[],
  teamId: string,
  now: Date
): RelevantAppointment | null {
  const today = toDateKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  let overdue: RelevantAppointment | null = null;
  let inProgress: RelevantAppointment | null = null;
  let nextUpcoming: RelevantAppointment | null = null;

  for (const apt of appointments) {
    if (apt.date !== today) continue;
    if (teamId && apt.team_id !== teamId) continue;
    if (apt.kind !== "work") continue;
    if (apt.status === "cancelled") continue;

    const start = timeToMin(apt.time_start);
    const end = timeToMin(apt.time_end);

    if (apt.status === "in_progress") {
      if (!inProgress || start < timeToMin(inProgress.appointment.time_start)) {
        inProgress = { appointment: apt, state: "in-progress", minutesFromNow: 0 };
      }
      continue;
    }

    if (apt.status === "completed") continue;

    // Scheduled — upcoming or overdue
    if (nowMin < start) {
      const delta = start - nowMin;
      if (delta > 120) continue; // too far in future — don't nag
      if (!nextUpcoming || delta < nextUpcoming.minutesFromNow) {
        nextUpcoming = { appointment: apt, state: "upcoming", minutesFromNow: delta };
      }
    } else if (nowMin >= end) {
      const delta = nowMin - end;
      if (delta > 240) continue; // too old — the red-flag banner covers the whole list
      if (!overdue || delta < overdue.minutesFromNow) {
        overdue = { appointment: apt, state: "overdue", minutesFromNow: delta };
      }
    }
  }

  // Priority: in-progress > overdue > upcoming
  return inProgress ?? overdue ?? nextUpcoming;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
