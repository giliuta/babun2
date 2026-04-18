"use client";

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import { useCalendarSettings } from "@/app/dashboard/layout";
import {
  validateCalendarSettings,
  TIMEZONE_OPTIONS,
  type CalendarSettings,
} from "@/lib/calendar-settings";

const HOURS_0_23 = Array.from({ length: 24 }, (_, i) => i);
const HOURS_1_24 = Array.from({ length: 24 }, (_, i) => i + 1);

export default function CalendarSettingsPage() {
  const { calendarSettings, setCalendarSettings } = useCalendarSettings();
  const [draft, setDraft] = useState<CalendarSettings>({ ...calendarSettings });
  const [saved, setSaved] = useState(false);

  const error = validateCalendarSettings(draft);

  const patch = (p: Partial<CalendarSettings>) => {
    setSaved(false);
    setDraft((prev) => ({ ...prev, ...p }));
  };

  const handleSave = () => {
    if (error) return;
    setCalendarSettings(draft);
    setSaved(true);
  };

  const handleReset = () => {
    setDraft({ ...calendarSettings });
    setSaved(false);
  };

  return (
    <>
      <PageHeader
        title="Настройки календаря"
        leftContent={
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-1 text-white/80 lg:text-indigo-600 text-sm px-1"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Настройки
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-lg mx-auto p-3 lg:p-4 space-y-4 pb-24">

          {/* Time range */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
            <div className="text-sm font-semibold text-gray-700">Диапазон часов</div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Начало дня</label>
                <select
                  value={draft.startHour}
                  onChange={(e) => patch({ startHour: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  {HOURS_0_23.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Конец дня</label>
                <select
                  value={draft.endHour}
                  onChange={(e) => patch({ endHour: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  {HOURS_1_24.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <div className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div className="text-xs text-gray-400">
              Открытие календаря будет прокручено к {String(draft.startHour).padStart(2, "0")}:00
            </div>
          </div>

          {/* Grid step */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="text-sm font-semibold text-gray-700">Шаг сетки</div>
            <div className="flex gap-2">
              {([15, 30, 60] as const).map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => patch({ gridStep: step })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                    draft.gridStep === step
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-gray-200 text-gray-700 bg-white"
                  }`}
                >
                  {step} мин
                </button>
              ))}
            </div>
          </div>

          {/* Week start */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="text-sm font-semibold text-gray-700">Начало недели</div>
            <div className="flex gap-2">
              {(["monday", "sunday"] as const).map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => patch({ weekStart: day })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                    draft.weekStart === day
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-gray-200 text-gray-700 bg-white"
                  }`}
                >
                  {day === "monday" ? "Понедельник" : "Воскресенье"}
                </button>
              ))}
            </div>
          </div>

          {/* Timezone */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="text-sm font-semibold text-gray-700">Часовой пояс</div>
            <select
              value={draft.timezone}
              onChange={(e) => patch({ timezone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          {/* Save */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium"
            >
              Сбросить
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!!error}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                error
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : saved
                  ? "bg-green-600 text-white"
                  : "bg-indigo-600 text-white active:bg-indigo-700"
              }`}
            >
              {saved ? "Сохранено!" : "Сохранить"}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
