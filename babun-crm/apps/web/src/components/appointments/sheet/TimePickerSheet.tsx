"use client";

import { useEffect, useState } from "react";
import BottomSheet from "./BottomSheet";

interface TimePickerSheetProps {
  open: boolean;
  onClose: () => void;
  date: string; // YYYY-MM-DD
  timeStart: string; // HH:MM
  durationMinutes: number;
  onConfirm: (next: { date: string; timeStart: string; durationMinutes: number }) => void;
}

const DURATION_CHIPS = [30, 45, 60, 90, 120, 180];

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  const days = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  const months = [
    "янв", "фев", "мар", "апр", "май", "июн",
    "июл", "авг", "сен", "окт", "ноя", "дек",
  ];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(((total % (24 * 60)) + 24 * 60) % (24 * 60) / 60);
  const mm = (((total % 60) + 60) % 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function TimePickerSheet({
  open,
  onClose,
  date,
  timeStart,
  durationMinutes,
  onConfirm,
}: TimePickerSheetProps) {
  const [localDate, setLocalDate] = useState(date);
  const [localTime, setLocalTime] = useState(timeStart);
  const [localDuration, setLocalDuration] = useState(durationMinutes);

  useEffect(() => {
    if (open) {
      setLocalDate(date);
      setLocalTime(timeStart);
      setLocalDuration(durationMinutes || 60);
    }
  }, [open, date, timeStart, durationMinutes]);

  const endTime = addMinutesToTime(localTime, localDuration);

  const handleConfirm = () => {
    onConfirm({
      date: localDate,
      timeStart: localTime,
      durationMinutes: localDuration,
    });
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Дата и время"
      footer={
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full h-14 bg-indigo-600 text-white rounded-xl font-semibold text-base active:scale-[0.98] transition"
        >
          Готово
        </button>
      }
    >
      <div className="p-4 space-y-5">
        {/* Summary */}
        <div className="bg-indigo-50 rounded-xl p-4 text-center">
          <div className="text-sm text-indigo-700 font-medium">
            {formatDateLabel(localDate)}
          </div>
          <div className="text-3xl font-bold text-gray-900 mt-1 tracking-tight">
            {localTime} <span className="text-gray-400">→</span> {endTime}
          </div>
          <div className="text-sm text-gray-500 mt-1">{localDuration} мин</div>
        </div>

        {/* Date picker (native) */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 px-1">
            Дата
          </label>
          <input
            type="date"
            value={localDate}
            onChange={(e) => setLocalDate(e.target.value)}
            className="w-full h-14 px-4 bg-gray-100 rounded-xl text-lg font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Start time (native) */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 px-1">
            Начало
          </label>
          <input
            type="time"
            value={localTime}
            onChange={(e) => setLocalTime(e.target.value)}
            step={900}
            className="w-full h-14 px-4 bg-gray-100 rounded-xl text-lg font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Duration chips */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 px-1">
            Длительность
          </label>
          <div className="grid grid-cols-3 gap-2">
            {DURATION_CHIPS.map((d) => {
              const active = localDuration === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setLocalDuration(d)}
                  className={`h-12 rounded-xl border-2 font-semibold text-base active:scale-[0.97] transition ${
                    active
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 bg-white text-gray-700"
                  }`}
                >
                  {d < 60 ? `${d} мин` : `${d / 60} ч${d % 60 !== 0 ? ` ${d % 60} мин` : ""}`}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
