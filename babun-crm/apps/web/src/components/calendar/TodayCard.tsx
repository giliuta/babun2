"use client";

import { useMemo } from "react";
import type { Appointment } from "@/lib/appointments";
import { getPaidAmount } from "@/lib/appointments";
import type { Client } from "@/lib/clients";
import type { DraftClient } from "@/lib/draft-clients";

interface TodayCardProps {
  appointments: Appointment[];
  clientsById: Record<string, Client | DraftClient>;
  onJumpToAppointment?: (apt: Appointment) => void;
}

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function formatTodayLabel(): string {
  const d = new Date();
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  const days = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  return `${d.getDate()} ${months[d.getMonth()]}, ${days[d.getDay()]}`;
}

// Compact "Сегодня" card shown above the calendar on mobile only. Gives
// a one-glance summary of the day: how many records, income, and the
// next upcoming slot. Tapping the "ближайшая" row jumps the calendar
// to that record.
export default function TodayCard({
  appointments,
  clientsById,
  onJumpToAppointment,
}: TodayCardProps) {
  const { todayAppts, income, next } = useMemo(() => {
    const key = todayKey();
    const todayList = appointments
      .filter((a) => a.date === key && a.status !== "cancelled")
      .sort((a, b) => a.time_start.localeCompare(b.time_start));

    let incomeSum = 0;
    for (const a of todayList) {
      if (a.status === "completed" || a.status === "in_progress") {
        incomeSum += getPaidAmount(a);
      }
    }

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const upcoming = todayList.find((a) => {
      const [h, m] = a.time_start.split(":").map(Number);
      return h * 60 + m >= nowMinutes && a.status === "scheduled";
    });

    return { todayAppts: todayList, income: incomeSum, next: upcoming ?? null };
  }, [appointments]);

  const nextLabel = useMemo(() => {
    if (!next) return null;
    const clientName =
      (next.client_id && clientsById[next.client_id]?.full_name) ||
      next.comment ||
      "Запись";
    return `${next.time_start} — ${clientName}`;
  }, [next, clientsById]);

  return (
    <div className="lg:hidden mx-3 mt-2 bg-white rounded-xl shadow-sm border border-gray-100 p-3">
      <div className="flex items-baseline justify-between">
        <div className="text-[13px] font-semibold text-gray-900 capitalize">
          Сегодня · {formatTodayLabel()}
        </div>
        <div className="text-[11px] text-gray-500 tabular-nums">
          {todayAppts.length > 0
            ? `Записей: ${todayAppts.length}`
            : "Нет записей"}
          {income > 0 && (
            <>
              {" · "}
              <span className="text-emerald-600 font-semibold">
                +{income}€
              </span>
            </>
          )}
        </div>
      </div>
      {nextLabel && (
        <button
          type="button"
          onClick={() => next && onJumpToAppointment?.(next)}
          className="mt-1.5 w-full text-left flex items-center gap-2 rounded-lg bg-indigo-50 px-2.5 py-1.5 active:bg-indigo-100 transition"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            className="text-indigo-600 flex-shrink-0"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="text-[12px] font-medium text-indigo-900 truncate">
            Ближайшая: {nextLabel}
          </span>
        </button>
      )}
    </div>
  );
}
