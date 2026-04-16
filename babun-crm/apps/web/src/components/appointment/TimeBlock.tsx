"use client";

import { useMemo } from "react";
import type { Appointment } from "@/lib/appointments";

interface TimeBlockProps {
  appointment: Appointment;
  cityLabel: string;
  cityColor: string;
  teamLabel: string;
  readonly: boolean;
  onOpenTimeEditor?: () => void;
  onOpenCityPicker?: () => void;
}

// Блок 1: время + город + бригада. Один тап по времени в create
// раскрывает TimeEditor; в view/done — чтение.
export default function TimeBlock({
  appointment,
  cityLabel,
  cityColor,
  teamLabel,
  readonly,
  onOpenTimeEditor,
  onOpenCityPicker,
}: TimeBlockProps) {
  const { dayLabel, durationLabel } = useMemo(() => {
    const [y, m, d] = appointment.date.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const day = dt.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
    const [sh, sm] = appointment.time_start.split(":").map(Number);
    const [eh, em] = appointment.time_end.split(":").map(Number);
    const dur = eh * 60 + em - (sh * 60 + sm);
    return {
      dayLabel: day,
      durationLabel: dur > 0 ? `${dur}м` : "",
    };
  }, [appointment.date, appointment.time_start, appointment.time_end]);

  return (
    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto text-[13px]">
      <span className="text-slate-400 flex-shrink-0">🕐</span>
      <button
        type="button"
        onClick={readonly ? undefined : onOpenTimeEditor}
        disabled={readonly}
        className={`text-slate-800 font-medium tabular-nums flex-shrink-0 ${
          readonly ? "" : "active:opacity-60"
        }`}
      >
        {dayLabel} · {appointment.time_start}–{appointment.time_end}
        {durationLabel && <span className="text-slate-500 ml-1">· {durationLabel}</span>}
      </button>
      {cityLabel && (
        <>
          <span className="text-slate-400">·</span>
          <button
            type="button"
            onClick={readonly ? undefined : onOpenCityPicker}
            disabled={readonly}
            className="font-semibold flex-shrink-0 active:opacity-60"
            style={{ color: cityColor }}
          >
            {cityLabel}
            {!readonly && <span className="text-slate-400 ml-0.5">▾</span>}
          </button>
        </>
      )}
      <span className="text-slate-400">·</span>
      <span className="text-slate-700 flex-shrink-0">{teamLabel}</span>
    </div>
  );
}
