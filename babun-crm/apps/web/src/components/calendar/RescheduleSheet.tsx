"use client";

import { useEffect, useMemo, useState } from "react";
import type { Appointment } from "@/lib/appointments";

interface RescheduleSheetProps {
  open: boolean;
  appointment: Appointment | null;
  onClose: () => void;
  onConfirm: (next: { date: string; time_start: string; time_end: string }) => void;
}

// Centred mobile reschedule modal. Mobile users have no drag-drop on
// the calendar (dnd-kit is desktop-only); this sheet is the path the
// long-press menu opens (Sprint 019 U8 / BUG #12). Date and time are
// adjusted independently; the duration is preserved so dragging from
// 14:00 to 16:00 keeps a 60-min visit 60 min long.
export default function RescheduleSheet({
  open,
  appointment,
  onClose,
  onConfirm,
}: RescheduleSheetProps) {
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    if (!appointment) return;
    setDate(appointment.date);
    setTime(appointment.time_start);
  }, [appointment]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Preserve original duration so the visit window length stays the
  // same after the move. If parsing fails, fall back to 60 minutes.
  const durationMin = useMemo(() => {
    if (!appointment) return 60;
    const [sh, sm] = appointment.time_start.split(":").map(Number);
    const [eh, em] = appointment.time_end.split(":").map(Number);
    const d = (eh * 60 + em) - (sh * 60 + sm);
    return d > 0 ? d : 60;
  }, [appointment]);

  const computedEnd = useMemo(() => {
    if (!time) return "";
    const [h, m] = time.split(":").map(Number);
    if (Number.isNaN(h)) return "";
    const endMin = Math.min(23 * 60 + 59, h * 60 + m + durationMin);
    const eh = Math.floor(endMin / 60);
    const em = endMin % 60;
    return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
  }, [time, durationMin]);

  if (!open || !appointment) return null;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[340px] bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-3 border-b border-slate-100">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Перенести запись
          </div>
          <div className="mt-1 text-[12px] text-slate-500 tabular-nums">
            Сейчас: {appointment.date} · {appointment.time_start}–{appointment.time_end}
          </div>
        </div>

        <div className="px-4 pt-3 pb-2 space-y-3">
          <label className="block">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Новая дата
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-slate-200 text-[14px] text-slate-800 focus:outline-none focus:border-violet-400"
            />
          </label>
          <label className="block">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Новое время начала
            </div>
            <input
              type="time"
              value={time}
              step={300}
              onChange={(e) => setTime(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-slate-200 text-[14px] text-slate-800 focus:outline-none focus:border-violet-400"
            />
          </label>
          <div className="text-[12px] text-slate-500 text-center pt-1">
            Длительность сохраняется ·{" "}
            <span className="font-semibold text-slate-700">
              {time}–{computedEnd}
            </span>
          </div>
        </div>

        <div className="px-4 pt-1 pb-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-slate-100 text-slate-700 text-[14px] font-medium active:bg-slate-200"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={!date || !time || !computedEnd}
            onClick={() => {
              onConfirm({ date, time_start: time, time_end: computedEnd });
              onClose();
            }}
            className="flex-1 h-11 rounded-xl bg-violet-600 text-white text-[14px] font-semibold active:scale-[0.99] disabled:opacity-40"
          >
            Перенести
          </button>
        </div>
      </div>
    </div>
  );
}
