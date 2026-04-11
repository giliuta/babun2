"use client";

import { useEffect, useState } from "react";
import DialogModal from "@/components/appointments/sheet/DialogModal";
import {
  type DaySchedule,
  type TeamSchedule,
  getDayScheduleForDate,
  setDateOverride,
  QUARTER_HOUR_OPTIONS,
} from "@/lib/schedule";
import { formatDateLongRu } from "@/lib/date-utils";

interface SpecialScheduleModalProps {
  open: boolean;
  dateKey: string | null;
  schedule: TeamSchedule;
  onClose: () => void;
  onSave: (nextSchedule: TeamSchedule) => void;
}

// Modal for editing the schedule of one specific date — the "режим
// особого расписания" from Bumpix. Supports toggling day-off, changing
// start/end hours, and removing the override to fall back to the default
// weekday schedule.
export default function SpecialScheduleModal({
  open,
  dateKey,
  schedule,
  onClose,
  onSave,
}: SpecialScheduleModalProps) {
  const [working, setWorking] = useState(true);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");

  useEffect(() => {
    if (!open || !dateKey) return;
    const [y, m, d] = dateKey.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const existing: DaySchedule = getDayScheduleForDate(schedule, date);
    setWorking(existing.is_working);
    setStart(existing.start || "09:00");
    setEnd(existing.end || "18:00");
  }, [open, dateKey, schedule]);

  const hasOverride = Boolean(
    dateKey && schedule.date_overrides && schedule.date_overrides[dateKey]
  );

  const handleSave = () => {
    if (!dateKey) return;
    const override: DaySchedule = {
      is_working: working,
      start: working ? start : "00:00",
      end: working ? end : "00:00",
      breaks: [],
    };
    onSave(setDateOverride(schedule, dateKey, override));
    onClose();
  };

  const handleReset = () => {
    if (!dateKey) return;
    onSave(setDateOverride(schedule, dateKey, null));
    onClose();
  };

  if (!dateKey) return null;

  return (
    <DialogModal
      open={open}
      onClose={onClose}
      title="Особый режим дня"
      footer={
        <div className="flex gap-2">
          {hasOverride && (
            <button
              type="button"
              onClick={handleReset}
              className="h-11 px-4 rounded-lg bg-gray-100 text-gray-600 text-[13px] font-medium active:scale-[0.98]"
            >
              Сбросить
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 h-11 rounded-lg bg-indigo-600 text-white text-[14px] font-semibold active:scale-[0.98]"
          >
            Сохранить
          </button>
        </div>
      }
    >
      <div className="p-4 space-y-4">
        <div className="text-[12px] text-gray-500 capitalize">
          {formatDateLongRu(dateKey)}
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <span
            className={`relative inline-block w-10 h-6 rounded-full transition ${
              working ? "bg-emerald-600" : "bg-gray-300"
            }`}
          >
            <input
              type="checkbox"
              checked={working}
              onChange={(e) => setWorking(e.target.checked)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                working ? "left-[1.125rem]" : "left-0.5"
              }`}
            />
          </span>
          <span className="text-[13px] text-gray-900 font-medium">
            {working ? "Рабочий день" : "Выходной"}
          </span>
        </label>

        {working && (
          <div className="grid grid-cols-2 gap-3">
            <TimeSelect label="Начало" value={start} onChange={setStart} />
            <TimeSelect label="Конец" value={end} onChange={setEnd} />
          </div>
        )}

        <p className="text-[11px] text-gray-400 leading-snug">
          Это расписание применится только к{" "}
          <span className="font-semibold">{formatDateLongRu(dateKey)}</span>. Общий
          рабочий график бригады не изменится.
        </p>
      </div>
    </DialogModal>
  );
}

interface TimeSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

function TimeSelect({ label, value, onChange }: TimeSelectProps) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-2 rounded-lg bg-gray-50 border border-gray-200 text-[13px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        {QUARTER_HOUR_OPTIONS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}
