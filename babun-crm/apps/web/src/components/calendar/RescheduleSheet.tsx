"use client";

import { useEffect, useMemo, useState } from "react";
import type { Appointment } from "@/lib/appointments";

interface RescheduleSheetProps {
  open: boolean;
  appointment: Appointment | null;
  onClose: () => void;
  onConfirm: (next: { date: string; time_start: string; time_end: string }) => void;
}

// Sprint 029 Phase 1: iOS alert-style reschedule sheet. Keeps the
// sheet narrow (300 px) and centred, following UIAlertController
// proportions — same visual weight as ConfirmDialog so the two
// action-layer modals feel related.
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
      className="fixed inset-0 z-[85] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[320px] bg-[var(--surface-card)] rounded-[14px] shadow-[var(--shadow-sheet)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4 text-center border-b border-[var(--separator)]">
          <div className="text-[17px] font-semibold text-[var(--label)] tracking-tight">
            Перенести запись
          </div>
          <div className="mt-1 text-[13px] text-[var(--label-secondary)] tabular-nums">
            Сейчас: {appointment.date} · {appointment.time_start}–{appointment.time_end}
          </div>
        </div>

        <div className="px-4 pt-4 pb-3 space-y-3">
          <label className="block">
            <div className="text-[12px] font-medium text-[var(--label-secondary)] mb-1.5">
              Новая дата
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
            />
          </label>
          <label className="block">
            <div className="text-[12px] font-medium text-[var(--label-secondary)] mb-1.5">
              Новое время начала
            </div>
            <input
              type="time"
              value={time}
              step={300}
              onChange={(e) => setTime(e.target.value)}
              className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
            />
          </label>
          <div className="text-[12px] text-[var(--label-secondary)] text-center pt-1">
            Длительность сохраняется ·{" "}
            <span className="font-semibold text-[var(--label)]">
              {time}–{computedEnd}
            </span>
          </div>
        </div>

        <div className="flex border-t border-[var(--separator)]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 text-[17px] font-normal text-[var(--accent)] active:bg-[var(--fill-quaternary)] border-r border-[var(--separator)]"
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
            className="flex-1 h-11 text-[17px] font-semibold text-[var(--accent)] active:bg-[var(--fill-quaternary)] disabled:opacity-40"
          >
            Перенести
          </button>
        </div>
      </div>
    </div>
  );
}
