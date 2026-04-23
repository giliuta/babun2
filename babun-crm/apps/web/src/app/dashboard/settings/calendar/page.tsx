"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Home } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui";
import IOSSwitch from "@/components/ui/IOSSwitch";
import {
  useCalendarSettings,
  useCurrentMaster,
  useMasters,
} from "@/app/dashboard/layout";
import {
  validateCalendarSettings,
  TIMEZONE_OPTIONS,
  type CalendarSettings,
} from "@/lib/calendar-settings";
import { PRESET_COLORS } from "@/lib/colors";

const HOURS_0_23 = Array.from({ length: 24 }, (_, i) => i);
const HOURS_1_24 = Array.from({ length: 24 }, (_, i) => i + 1);

export default function CalendarSettingsPage() {
  const { calendarSettings, setCalendarSettings } = useCalendarSettings();
  const { currentMasterId } = useCurrentMaster();
  const { masters, upsertMaster } = useMasters();
  const currentMaster = masters.find((m) => m.id === currentMasterId) ?? null;
  const [draft, setDraft] = useState<CalendarSettings>({ ...calendarSettings });
  const [saved, setSaved] = useState(false);

  // Personal-calendar name + colour live on the master record itself
  // (not on CalendarSettings) because these settings *belong to the
  // master*. The rest of this page — grid hours, buffer, etc. — still
  // uses global CalendarSettings and will be migrated into per-master
  // settings in a later pass.
  const personalName = currentMaster?.personal_calendar_name ?? "";
  const personalColor = currentMaster?.personal_calendar_color ?? "";
  const commitPersonalName = (next: string) => {
    if (!currentMaster) return;
    const trimmed = next.trim();
    if (trimmed === (currentMaster.personal_calendar_name ?? "")) return;
    upsertMaster({
      ...currentMaster,
      personal_calendar_name: trimmed || undefined,
    });
  };
  const commitPersonalColor = (next: string) => {
    if (!currentMaster) return;
    if (next === (currentMaster.personal_calendar_color ?? "")) return;
    upsertMaster({
      ...currentMaster,
      personal_calendar_color: next || undefined,
    });
  };

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
        title="Мой календарь"
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

          {/* Personal calendar identity (Sprint 033 Phase I37) */}
          {currentMaster && (
            <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-4">
              <div>
                <div className="text-[15px] font-semibold text-[var(--label)]">
                  Личный календарь
                </div>
                <div className="text-[12px] text-[var(--label-tertiary)] mt-0.5 leading-snug">
                  Эти записи видите только вы. В календарной ленте
                  переключается тапом на вкладку рядом с бригадами.
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[var(--label-secondary)] mb-1.5 tracking-wide">
                  Название
                </label>
                <input
                  type="text"
                  defaultValue={personalName}
                  onBlur={(e) => commitPersonalName(e.target.value)}
                  placeholder={currentMaster.full_name || "Мой календарь"}
                  maxLength={40}
                  className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
                />
                <div className="text-[11px] text-[var(--label-tertiary)] mt-1">
                  Пусто — покажется «Мой календарь».
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[var(--label-secondary)] mb-1.5 tracking-wide">
                  Цвет
                </label>
                <div className="grid grid-cols-7 gap-2">
                  {PRESET_COLORS.map((c) => {
                    const picked = c.value === personalColor;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => commitPersonalColor(c.value)}
                        aria-label={c.name}
                        className="relative w-full aspect-square rounded-full press-scale flex items-center justify-center"
                        style={{ backgroundColor: c.value }}
                      >
                        {picked && (
                          <Check
                            size={16}
                            strokeWidth={3}
                            className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[11px] text-[var(--label-tertiary)] mt-2 leading-snug">
                  Подсвечивает события вашего личного календаря и вкладку
                  в шапке.
                </div>
              </div>
            </div>
          )}

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

            <div className="text-[12px] text-[var(--label-tertiary)] leading-snug">
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

          {/* Buffer + toggles (Sprint 033 Phase I35) */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
            <div className="px-4 pt-3.5 pb-2">
              <div className="text-[15px] font-semibold text-[var(--label)]">
                Поведение календаря
              </div>
              <div className="text-[12px] text-[var(--label-tertiary)] mt-0.5 leading-snug">
                Действуют на всех бригадах.
              </div>
            </div>

            {/* Buffer between appointments */}
            <div className="px-4 py-3 border-t border-[var(--separator)]">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] text-[var(--label)]">
                    Перерыв между записями
                  </div>
                  <div className="text-[12px] text-[var(--label-tertiary)] leading-snug mt-0.5">
                    Автоматический буфер после каждого визита — дорога, уборка инструмента.
                  </div>
                </div>
              </div>
              <div className="flex gap-1.5 mt-2.5">
                {[0, 10, 15, 20, 30, 45, 60].map((m) => {
                  const picked = (draft.bufferMinutes ?? 0) === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => patch({ bufferMinutes: m })}
                      className={`flex-1 h-9 rounded-[10px] text-[12px] font-medium press-scale transition-colors ${
                        picked
                          ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                          : "bg-[var(--fill-tertiary)] text-[var(--label)]"
                      }`}
                    >
                      {m === 0 ? "нет" : `${m}м`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hide cancelled */}
            <div className="flex items-center gap-3 px-4 py-3 border-t border-[var(--separator)]">
              <div className="flex-1 min-w-0">
                <div className="text-[15px] text-[var(--label)]">
                  Скрыть отменённые записи
                </div>
                <div className="text-[12px] text-[var(--label-tertiary)] leading-snug mt-0.5">
                  Выключено — отменённые остаются на сетке зачёркнутыми.
                </div>
              </div>
              <IOSSwitch
                checked={draft.hideCancelled ?? false}
                onChange={(next) => patch({ hideCancelled: next })}
                ariaLabel="Скрыть отменённые"
              />
            </div>

            {/* Allow overtime */}
            <div className="flex items-center gap-3 px-4 py-3 border-t border-[var(--separator)]">
              <div className="flex-1 min-w-0">
                <div className="text-[15px] text-[var(--label)]">
                  Разрешить продлить рабочий день
                </div>
                <div className="text-[12px] text-[var(--label-tertiary)] leading-snug mt-0.5">
                  Последний визит может закончиться после {String(draft.endHour).padStart(2, "0")}:00 без ошибки.
                </div>
              </div>
              <IOSSwitch
                checked={draft.allowOvertime ?? false}
                onChange={(next) => patch({ allowOvertime: next })}
                ariaLabel="Разрешить продлить рабочий день"
              />
            </div>
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
