"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui";
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
            className="flex items-center gap-1 text-white/80 lg:text-[var(--accent)] text-[13px] px-1"
          >
            <ChevronLeft size={16} strokeWidth={2.5} />
            Настройки
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-lg mx-auto px-4 py-4 space-y-5 pb-24">

          {/* Time range */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-4">
            <div className="text-[15px] font-semibold text-[var(--label)]">Диапазон часов</div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-[var(--label-secondary)] mb-1.5 tracking-wide">
                  Начало дня
                </label>
                <select
                  value={draft.startHour}
                  onChange={(e) => patch({ startHour: Number(e.target.value) })}
                  className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
                >
                  {HOURS_0_23.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[var(--label-secondary)] mb-1.5 tracking-wide">
                  Конец дня
                </label>
                <select
                  value={draft.endHour}
                  onChange={(e) => patch({ endHour: Number(e.target.value) })}
                  className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
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
              <div className="text-[12px] text-[var(--system-red)] bg-[rgba(255,59,48,0.1)] rounded-[10px] px-3 py-2">
                {error}
              </div>
            )}

            <div className="text-[11px] text-[var(--label-tertiary)] leading-snug">
              Открытие календаря будет прокручено к {String(draft.startHour).padStart(2, "0")}:00
            </div>
          </div>

          {/* Grid step */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-3">
            <div className="text-[15px] font-semibold text-[var(--label)]">Шаг сетки</div>
            <div className="flex gap-2">
              {([15, 30, 60] as const).map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => patch({ gridStep: step })}
                  className={`flex-1 h-11 rounded-[10px] text-[14px] font-medium transition-all ${
                    draft.gridStep === step
                      ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                      : "bg-[var(--fill-tertiary)] text-[var(--label)]"
                  }`}
                >
                  {step} мин
                </button>
              ))}
            </div>
          </div>

          {/* Week start */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-3">
            <div className="text-[15px] font-semibold text-[var(--label)]">Начало недели</div>
            <div className="flex gap-2">
              {(["monday", "sunday"] as const).map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => patch({ weekStart: day })}
                  className={`flex-1 h-11 rounded-[10px] text-[14px] font-medium transition-all ${
                    draft.weekStart === day
                      ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                      : "bg-[var(--fill-tertiary)] text-[var(--label)]"
                  }`}
                >
                  {day === "monday" ? "Понедельник" : "Воскресенье"}
                </button>
              ))}
            </div>
          </div>

          {/* Timezone */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-3">
            <div className="text-[15px] font-semibold text-[var(--label)]">Часовой пояс</div>
            <select
              value={draft.timezone}
              onChange={(e) => patch({ timezone: e.target.value })}
              className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
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
            <Button variant="secondary" size="md" fullWidth onClick={handleReset}>
              Сбросить
            </Button>
            <Button
              variant={saved ? "primary" : "primary"}
              size="md"
              fullWidth
              disabled={!!error}
              onClick={handleSave}
              className={saved ? "!bg-[var(--system-green)]" : ""}
            >
              {saved ? "Сохранено!" : "Сохранить"}
            </Button>
          </div>

          {/* Related: booking-form customisation */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
            <Link
              href="/dashboard/settings/booking"
              className="flex items-center gap-3 px-4 py-3 min-h-[48px] active:bg-[var(--fill-quaternary)] transition-colors"
            >
              <span className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[var(--label-on-accent)] shrink-0 bg-[var(--system-red)]">
                <Home size={16} strokeWidth={2} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] text-[var(--label)]">Записи — типы объектов</div>
                <div className="text-[12px] text-[var(--label-secondary)] mt-0.5">
                  Дом, Квартира, Офис, Вилла — добавь свои
                </div>
              </div>
              <ChevronRight size={16} className="text-[var(--label-tertiary)] shrink-0" />
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}
