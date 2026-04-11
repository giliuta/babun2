"use client";

import { useState, useMemo } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useTeams, useSchedules } from "@/app/dashboard/layout";
import {
  DEFAULT_SCHEDULE,
  WEEKDAY_KEYS,
  WEEKDAY_NAMES,
  QUARTER_HOUR_OPTIONS,
  type TeamSchedule,
  type DaySchedule,
  type WeekdayKey,
  type ScheduleBreak,
} from "@/lib/schedule";

export default function SchedulePage() {
  const { teams } = useTeams();
  const { schedules, setSchedules } = useSchedules();
  const activeTeams = useMemo(() => teams.filter((t) => t.active), [teams]);
  const [teamId, setTeamId] = useState<string>(activeTeams[0]?.id ?? "");

  const schedule: TeamSchedule = schedules[teamId] ?? DEFAULT_SCHEDULE;

  const updateSchedule = (next: TeamSchedule) => {
    setSchedules({ ...schedules, [teamId]: next });
  };

  const updateOverride = (key: WeekdayKey, day: DaySchedule | null) => {
    const overrides = { ...(schedule.overrides ?? {}) };
    if (day === null) {
      delete overrides[key];
    } else {
      overrides[key] = day;
    }
    updateSchedule({ ...schedule, overrides });
  };

  const addGeneralBreak = () => {
    updateSchedule({
      ...schedule,
      breaks: [...(schedule.breaks ?? []), { start: "13:00", end: "14:00" }],
    });
  };

  const updateGeneralBreak = (idx: number, patch: Partial<ScheduleBreak>) => {
    const breaks = [...(schedule.breaks ?? [])];
    breaks[idx] = { ...breaks[idx], ...patch };
    updateSchedule({ ...schedule, breaks });
  };

  const removeGeneralBreak = (idx: number) => {
    const breaks = (schedule.breaks ?? []).filter((_, i) => i !== idx);
    updateSchedule({ ...schedule, breaks });
  };

  if (!teamId) {
    return (
      <>
        <PageHeader title="Расписание" />
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Сначала создайте бригаду
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Расписание работы" />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 pb-24 space-y-4">
          {/* Team selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <label className="block text-xs text-gray-500 mb-2">Бригада</label>
            <div className="flex gap-2 overflow-x-auto">
              {activeTeams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTeamId(t.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border-2 transition-all ${
                    teamId === t.id
                      ? "text-white border-transparent"
                      : "text-gray-700 bg-white border-gray-300"
                  }`}
                  style={teamId === t.id ? { backgroundColor: t.color } : undefined}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* General schedule */}
          <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="text-sm font-semibold text-gray-700">Общее расписание</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Начало</label>
                <TimeSelect
                  value={schedule.start}
                  onChange={(v) => updateSchedule({ ...schedule, start: v })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Конец</label>
                <TimeSelect
                  value={schedule.end}
                  onChange={(v) => updateSchedule({ ...schedule, end: v })}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-500">Перерывы</label>
                <button
                  type="button"
                  onClick={addGeneralBreak}
                  className="text-xs text-indigo-600 font-medium"
                >
                  + Добавить перерыв
                </button>
              </div>
              {(schedule.breaks ?? []).length === 0 && (
                <div className="text-xs text-gray-400">Нет перерывов</div>
              )}
              <div className="space-y-2">
                {(schedule.breaks ?? []).map((br, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <TimeSelect
                      value={br.start}
                      onChange={(v) => updateGeneralBreak(i, { start: v })}
                    />
                    <span className="text-gray-400">—</span>
                    <TimeSelect
                      value={br.end}
                      onChange={(v) => updateGeneralBreak(i, { end: v })}
                    />
                    <button
                      type="button"
                      onClick={() => removeGeneralBreak(i)}
                      className="w-8 h-8 text-red-500 hover:bg-red-50 rounded"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Per-weekday overrides */}
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-700 mb-3">
              Расписание по дням недели
            </div>
            <div className="space-y-3">
              {WEEKDAY_KEYS.map((key) => {
                const override = schedule.overrides?.[key];
                const hasOverride = Boolean(override);
                return (
                  <DayOverrideRow
                    key={key}
                    weekday={key}
                    override={override}
                    hasOverride={hasOverride}
                    onToggle={(on) => {
                      if (on) {
                        updateOverride(key, {
                          is_working: true,
                          start: schedule.start,
                          end: schedule.end,
                          breaks: [],
                        });
                      } else {
                        updateOverride(key, null);
                      }
                    }}
                    onChange={(next) => updateOverride(key, next)}
                  />
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function TimeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      {QUARTER_HOUR_OPTIONS.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

function DayOverrideRow({
  weekday,
  override,
  hasOverride,
  onToggle,
  onChange,
}: {
  weekday: WeekdayKey;
  override: DaySchedule | undefined;
  hasOverride: boolean;
  onToggle: (on: boolean) => void;
  onChange: (next: DaySchedule) => void;
}) {
  const name = WEEKDAY_NAMES[weekday];

  const addBreak = () => {
    if (!override) return;
    onChange({
      ...override,
      breaks: [...override.breaks, { start: "13:00", end: "14:00" }],
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">{name}</span>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={hasOverride}
            onChange={(e) => onToggle(e.target.checked)}
            className="w-4 h-4"
          />
          Особое расписание
        </label>
      </div>

      {hasOverride && override && (
        <>
          <label className="flex items-center gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={override.is_working}
              onChange={(e) => onChange({ ...override, is_working: e.target.checked })}
              className="w-4 h-4"
            />
            {override.is_working ? "Рабочий день" : "Выходной"}
          </label>

          {override.is_working && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <TimeSelect
                  value={override.start}
                  onChange={(v) => onChange({ ...override, start: v })}
                />
                <TimeSelect
                  value={override.end}
                  onChange={(v) => onChange({ ...override, end: v })}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-500">Перерывы</label>
                  <button
                    type="button"
                    onClick={addBreak}
                    className="text-xs text-indigo-600 font-medium"
                  >
                    + Перерыв
                  </button>
                </div>
                <div className="space-y-1">
                  {override.breaks.map((br, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <TimeSelect
                        value={br.start}
                        onChange={(v) => {
                          const breaks = [...override.breaks];
                          breaks[i] = { ...breaks[i], start: v };
                          onChange({ ...override, breaks });
                        }}
                      />
                      <span className="text-gray-400">—</span>
                      <TimeSelect
                        value={br.end}
                        onChange={(v) => {
                          const breaks = [...override.breaks];
                          breaks[i] = { ...breaks[i], end: v };
                          onChange({ ...override, breaks });
                        }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onChange({
                            ...override,
                            breaks: override.breaks.filter((_, x) => x !== i),
                          })
                        }
                        className="w-7 h-7 text-red-500 hover:bg-red-50 rounded text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
