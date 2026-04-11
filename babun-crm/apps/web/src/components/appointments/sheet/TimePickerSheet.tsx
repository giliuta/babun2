"use client";

import { useEffect, useState } from "react";
import BottomSheet from "./BottomSheet";

interface TimePickerSheetProps {
  open: boolean;
  onClose: () => void;
  date: string; // YYYY-MM-DD
  timeStart: string; // HH:MM
  // Read-only: duration comes entirely from the chosen services.
  durationMinutes: number;
  onConfirm: (next: { date: string; timeStart: string }) => void;
}

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

  useEffect(() => {
    if (open) {
      setLocalDate(date);
      setLocalTime(timeStart);
    }
  }, [open, date, timeStart]);

  const endTime = addMinutesToTime(localTime, durationMinutes || 60);

  const handleConfirm = () => {
    onConfirm({ date: localDate, timeStart: localTime });
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
          className="w-full h-14 bg-indigo-600 text-white rounded-xl font-semibold text-[15px] active:scale-[0.98] transition"
        >
          Готово
        </button>
      }
    >
      <div className="p-4 space-y-5">
        {/* Summary */}
        <div className="bg-indigo-50 rounded-xl p-4 text-center">
          <div className="text-[13px] text-indigo-700 font-medium">
            {formatDateLabel(localDate)}
          </div>
          <div className="text-3xl font-bold text-gray-900 mt-1 tracking-tight tabular-nums">
            {localTime} <span className="text-gray-400">→</span> {endTime}
          </div>
          <div className="text-[12px] text-gray-500 mt-1">
            {durationMinutes > 0
              ? `${durationMinutes} мин (из услуг)`
              : "Длительность задаётся выбранными услугами"}
          </div>
        </div>

        {/* Date picker (native) */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5 px-1">
            Дата
          </label>
          <input
            type="date"
            value={localDate}
            onChange={(e) => setLocalDate(e.target.value)}
            className="w-full h-14 px-4 bg-gray-100 rounded-xl text-[17px] font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Start time (native) */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5 px-1">
            Начало
          </label>
          <input
            type="time"
            value={localTime}
            onChange={(e) => setLocalTime(e.target.value)}
            step={900}
            className="w-full h-14 px-4 bg-gray-100 rounded-xl text-[17px] font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
    </BottomSheet>
  );
}
