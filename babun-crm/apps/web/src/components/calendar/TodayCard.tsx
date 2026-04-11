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
    <div
      className="lg:hidden mx-3 mt-3 rounded-2xl p-3.5 animate-fade-in-up"
      style={{
        background: "linear-gradient(180deg, #ffffff 0%, #fafbff 100%)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-500">
            Сегодня
          </div>
          <div className="text-[15px] font-semibold text-gray-900 capitalize tracking-tight mt-0.5">
            {formatTodayLabel()}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-indigo-700"
            style={{
              background: "rgba(99, 102, 241, 0.1)",
              border: "1px solid rgba(99, 102, 241, 0.2)",
            }}
          >
            {todayAppts.length === 0 ? "0 записей" : `${todayAppts.length} записи`}
          </div>
          {income > 0 && (
            <div
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-emerald-700 tabular-nums"
              style={{
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
              }}
            >
              +{income}€
            </div>
          )}
        </div>
      </div>
      {nextLabel && (
        <button
          type="button"
          onClick={() => next && onJumpToAppointment?.(next)}
          className="mt-3 w-full text-left flex items-center gap-2.5 rounded-xl px-3 py-2 active:scale-[0.98] transition"
          style={{
            background:
              "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08))",
            border: "1px solid rgba(99, 102, 241, 0.15)",
          }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white"
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              boxShadow: "0 2px 8px -2px rgba(99,102,241,0.5)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-indigo-500 font-semibold uppercase tracking-wider leading-none">
              Ближайшая
            </div>
            <div className="text-[12px] font-semibold text-gray-900 truncate leading-tight mt-0.5">
              {nextLabel}
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-indigo-400 flex-shrink-0">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
