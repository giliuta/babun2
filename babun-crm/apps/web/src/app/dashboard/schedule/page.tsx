"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
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
  // `teams` is hydrated asynchronously from localStorage by the
  // dashboard layout, so the first render always sees `activeTeams = []`.
  // A lazy `useState(activeTeams[0]?.id ?? "")` initializer snapshotted
  // that empty array and left `teamId` stuck on "" forever — Sprint 019
  // BUG #4. Start empty, then sync in a layout effect once teams arrive.
  const [teamId, setTeamId] = useState<string>("");
  useEffect(() => {
    if (!teamId && activeTeams[0]) setTeamId(activeTeams[0].id);
    if (teamId && !activeTeams.some((t) => t.id === teamId)) {
      setTeamId(activeTeams[0]?.id ?? "");
    }
  }, [activeTeams, teamId]);

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
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm max-w-sm mx-4">
            <EmptyState
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              }
              title="Сначала создайте бригаду"
              description="Расписание привязывается к бригаде. Создай хотя бы одну в разделе «Бригады и мастера»."
              action={
                <Link
                  href="/dashboard/teams"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-violet-600"
                >
                  + Создать бригаду →
                </Link>
              }
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Расписание работы" />

      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 pb-24 space-y-4">
          {/* Team selector */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_2px_0_rgba(15,23,42,0.04),0_1px_3px_0_rgba(15,23,42,0.06)] p-3">
            <label className="block text-xs text-slate-500 mb-2">Бригада</label>
            <div className="flex gap-2 overflow-x-auto">
              {activeTeams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTeamId(t.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border-2 transition-all ${
                    teamId === t.id
                      ? "text-white border-transparent"
                      : "text-slate-700 bg-white border-slate-300"
                  }`}
                  style={teamId === t.id ? { backgroundColor: t.color } : undefined}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* General schedule */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_2px_0_rgba(15,23,42,0.04),0_1px_3px_0_rgba(15,23,42,0.06)] p-4 space-y-3">
            <div className="text-sm font-semibold text-slate-700">Общее расписание</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Начало</label>
                <TimeSelect
                  value={schedule.start}
                  onChange={(v) => updateSchedule({ ...schedule, start: v })}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Конец</label>
                <TimeSelect
                  value={schedule.end}
                  onChange={(v) => updateSchedule({ ...schedule, end: v })}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-500">Перерывы</label>
                <button
                  type="button"
                  onClick={addGeneralBreak}
                  className="text-xs text-violet-600 font-medium"
                >
                  + Добавить перерыв
                </button>
              </div>
              {(schedule.breaks ?? []).length === 0 && (
                <div className="text-xs text-slate-400">Нет перерывов</div>
              )}
              <div className="space-y-2">
                {(schedule.breaks ?? []).map((br, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <TimeSelect
                      value={br.start}
                      onChange={(v) => updateGeneralBreak(i, { start: v })}
                    />
                    <span className="text-slate-400">—</span>
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
          <section className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_2px_0_rgba(15,23,42,0.04),0_1px_3px_0_rgba(15,23,42,0.06)] p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">
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
      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
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
    <div className="border border-slate-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-900">{name}</span>
        <label className="flex items-center gap-2 text-xs text-slate-600">
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
          <label className="flex items-center gap-2 text-xs text-slate-700">
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
                  <label className="text-xs text-slate-500">Перерывы</label>
                  <button
                    type="button"
                    onClick={addBreak}
                    className="text-xs text-violet-600 font-medium"
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
                      <span className="text-slate-400">—</span>
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
