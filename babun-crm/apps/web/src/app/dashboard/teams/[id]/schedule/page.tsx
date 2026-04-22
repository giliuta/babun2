"use client";

// Sprint 033 Phase H — Brigade work schedule subroute (Bumpix-style).

import { use } from "react";
import { haptic } from "@/lib/haptics";
import { useSchedules, useTeams } from "@/app/dashboard/layout";
import {
  DEFAULT_SCHEDULE,
  WEEKDAY_KEYS,
  WEEKDAY_NAMES,
  type ScheduleBreak,
  type TeamSchedule,
  type WeekdayKey,
} from "@/lib/schedule";
import IOSSwitch from "@/components/ui/IOSSwitch";
import BrigadeSectionShell, {
  SectionCard,
} from "@/components/teams/BrigadeSectionShell";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function BrigadeSchedulePage({ params }: RouteParams) {
  const { id } = use(params);
  const { teams } = useTeams();
  const { schedules, setSchedules } = useSchedules();
  const team = teams.find((t) => t.id === id);

  const schedule: TeamSchedule = schedules[id] ?? DEFAULT_SCHEDULE;
  const firstBreak: ScheduleBreak | null = schedule.breaks?.[0] ?? null;

  if (!team) {
    return (
      <BrigadeSectionShell brigadeId={id} title="Расписание" onSave={() => true}>
        <SectionCard>
          <div className="text-[13px] text-[var(--label-tertiary)] py-4 text-center">
            Бригада не найдена.
          </div>
        </SectionCard>
      </BrigadeSectionShell>
    );
  }

  const persist = (next: TeamSchedule) => {
    setSchedules({ ...schedules, [id]: next });
  };

  const updateBase = (key: "start" | "end", value: string) => {
    persist({ ...schedule, [key]: value });
  };

  const toggleBreak = (on: boolean) => {
    haptic("tap");
    if (on) {
      persist({ ...schedule, breaks: [{ start: "13:00", end: "14:00" }] });
    } else {
      persist({ ...schedule, breaks: [] });
    }
  };

  const updateBreak = (key: "start" | "end", value: string) => {
    const current = schedule.breaks?.[0] ?? { start: "13:00", end: "14:00" };
    persist({ ...schedule, breaks: [{ ...current, [key]: value }] });
  };

  const isDayOff = (k: WeekdayKey): boolean => {
    const ov = schedule.overrides?.[k];
    return ov ? !ov.is_working : false;
  };

  const toggleDayOff = (k: WeekdayKey) => {
    haptic("tap");
    const overrides = { ...(schedule.overrides ?? {}) };
    if (isDayOff(k)) {
      delete overrides[k];
    } else {
      overrides[k] = {
        is_working: false,
        start: schedule.start,
        end: schedule.end,
        breaks: [],
      };
    }
    persist({ ...schedule, overrides });
  };

  return (
    <BrigadeSectionShell
      brigadeId={id}
      title="Расписание"
      saveLabel="Готово"
      onSave={() => true}
    >
      <SectionCard subtitle="График работы. В эти часы колонки календаря подсвечиваются светлее.">
        <div>
          <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--label-secondary)] mb-1.5">
            Время работы
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-[var(--label-tertiary)]">с</span>
              <input
                type="time"
                value={schedule.start ?? "09:00"}
                onChange={(e) => updateBase("start", e.target.value)}
                step={1800}
                className="flex-1 h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-[var(--label-tertiary)]">до</span>
              <input
                type="time"
                value={schedule.end ?? "18:00"}
                onChange={(e) => updateBase("end", e.target.value)}
                step={1800}
                className="flex-1 h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between py-1">
            <div className="text-[15px] font-medium text-[var(--label)]">Перерыв</div>
            <IOSSwitch
              checked={firstBreak !== null}
              onChange={toggleBreak}
              ariaLabel="Включить перерыв"
            />
          </div>
          {firstBreak ? (
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-[var(--label-tertiary)]">с</span>
                <input
                  type="time"
                  value={firstBreak.start}
                  onChange={(e) => updateBreak("start", e.target.value)}
                  step={1800}
                  className="flex-1 h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-[var(--label-tertiary)]">до</span>
                <input
                  type="time"
                  value={firstBreak.end}
                  onChange={(e) => updateBreak("end", e.target.value)}
                  step={1800}
                  className="flex-1 h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>
            </div>
          ) : (
            <div className="text-[13px] text-[var(--label-tertiary)]">Без перерыва</div>
          )}
        </div>

        <div>
          <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--label-secondary)] mb-1.5">
            Выходные дни
          </div>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_KEYS.map((k) => {
              const off = isDayOff(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleDayOff(k)}
                  className={`inline-flex items-center justify-center h-9 min-w-[44px] px-3 rounded-full text-[14px] font-medium press-scale transition ${
                    off
                      ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                      : "bg-[var(--fill-tertiary)] text-[var(--label-secondary)]"
                  }`}
                >
                  {WEEKDAY_NAMES[k]}
                </button>
              );
            })}
          </div>
          <div className="text-[12px] text-[var(--label-tertiary)] mt-1.5">
            Отмеченные дни бригада не работает.
          </div>
        </div>
      </SectionCard>
    </BrigadeSectionShell>
  );
}
