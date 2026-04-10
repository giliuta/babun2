"use client";

import { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";

type FontSize = "small" | "medium" | "large";

const FONT_SIZE_LABELS: Record<FontSize, string> = {
  small: "Мелкий",
  medium: "Средний",
  large: "Крупный",
};

export default function SettingsPage() {
  const [appointmentFontSize, setAppointmentFontSize] = useState<FontSize>("medium");
  const [timeFontSize, setTimeFontSize] = useState<FontSize>("medium");
  const [use12HourFormat, setUse12HourFormat] = useState(false);
  const [firstDayOfWeek, setFirstDayOfWeek] = useState<"monday" | "sunday">("monday");

  return (
    <>
      <PageHeader title="Настройки" />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto p-3 lg:p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-5">
            {/* Account */}
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase mb-2">
                Учетная запись
              </div>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                airfix.cy@gmail.com
              </div>
            </div>

            {/* Appointment font size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Размер шрифта в записях
              </label>
              <select
                value={appointmentFontSize}
                onChange={(e) => setAppointmentFontSize(e.target.value as FontSize)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              >
                {(Object.keys(FONT_SIZE_LABELS) as FontSize[]).map((size) => (
                  <option key={size} value={size}>
                    {FONT_SIZE_LABELS[size]}
                  </option>
                ))}
              </select>
            </div>

            {/* Time font size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Размер шрифта времени
              </label>
              <select
                value={timeFontSize}
                onChange={(e) => setTimeFontSize(e.target.value as FontSize)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              >
                {(Object.keys(FONT_SIZE_LABELS) as FontSize[]).map((size) => (
                  <option key={size} value={size}>
                    {FONT_SIZE_LABELS[size]}
                  </option>
                ))}
              </select>
            </div>

            {/* 12-hour format toggle */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                12-часовой формат времени
              </label>
              <button
                type="button"
                onClick={() => setUse12HourFormat(!use12HourFormat)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  use12HourFormat ? "bg-indigo-600" : "bg-gray-300"
                }`}
                aria-label="Переключить 12-часовой формат"
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    use12HourFormat ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* First day of week */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Первый день недели
              </label>
              <select
                value={firstDayOfWeek}
                onChange={(e) =>
                  setFirstDayOfWeek(e.target.value as "monday" | "sunday")
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              >
                <option value="monday">Понедельник</option>
                <option value="sunday">Воскресенье</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
