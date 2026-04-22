"use client";

// Sprint 033 Phase I16 — Brigade schedule, iOS-Settings redesign.
//
// Instant save everywhere (hideSave). Grouped cards:
//  · ВРЕМЯ РАБОТЫ — two time fields in one card
//  · ПЕРЕРЫВ — toggle row; the time inputs only appear under it
//    when the switch is on
//  · ВЫХОДНЫЕ ДНИ — 7 day chips as selectable toggles
//
// Footer explainer replaced the intro paragraph (no more mid-card
// wall of grey text).

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
import BrigadeSectionShell from "@/components/teams/BrigadeSectionShell";

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
      <BrigadeSectionShell brigadeId={id} title="Расписание" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Бригада не найдена.
        </div>
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
    <BrigadeSectionShell brigadeId={id} title="Расписание" hideSave>
      {/* ── Working hours ─────────────────────────────────────── */}
      <Group title="Время работы">
        <TimeRangeCard
          start={schedule.start ?? "09:00"}
          end={schedule.end ?? "18:00"}
          onStartChange={(v) => updateBase("start", v)}
          onEndChange={(v) => updateBase("end", v)}
        />
      </Group>

      {/* ── Break ─────────────────────────────────────────────── */}
      <Group title="Перерыв">
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="flex items-center gap-3 px-4 min-h-[52px]">
            <div className="flex-1 min-w-0">
              <div className="text-[15px] text-[var(--label)]">
                Включить перерыв
              </div>
              <div className="text-[12px] text-[var(--label-tertiary)] leading-snug">
                {firstBreak
                  ? `${firstBreak.start}–${firstBreak.end}. Вставка в график.`
                  : "Без перерыва."}
              </div>
            </div>
            <IOSSwitch
              checked={firstBreak !== null}
              onChange={toggleBreak}
              ariaLabel="Включить перерыв"
            />
          </div>
          {firstBreak && (
            <div className="border-t border-[var(--separator)] px-4 py-3">
              <div className="grid grid-cols-2 gap-2">
                <TimePair
                  prefix="с"
                  value={firstBreak.start}
                  onChange={(v) => updateBreak("start", v)}
                />
                <TimePair
                  prefix="до"
                  value={firstBreak.end}
                  onChange={(v) => updateBreak("end", v)}
                />
              </div>
            </div>
          )}
        </div>
      </Group>

      {/* ── Weekends ──────────────────────────────────────────── */}
      <Group title="Выходные дни" footer="Отмеченные дни бригада не работает.">
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-3 py-3">
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAY_KEYS.map((k) => {
              const off = isDayOff(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleDayOff(k)}
                  className={`h-10 rounded-[10px] text-[13px] font-semibold press-scale transition ${
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
        </div>
      </Group>
    </BrigadeSectionShell>
  );
}

// ─── Shared building blocks ──────────────────────────────────────

function Group({
  title,
  footer,
  children,
}: {
  title: string;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
        {title}
      </div>
      {children}
      {footer && (
        <div className="px-4 pt-1.5 text-[12px] text-[var(--label-tertiary)] leading-snug">
          {footer}
        </div>
      )}
    </div>
  );
}

function TimeRangeCard({
  start,
  end,
  onStartChange,
  onEndChange,
}: {
  start: string;
  end: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}) {
  return (
    <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-3 py-3">
      <div className="grid grid-cols-2 gap-2">
        <TimePair prefix="с" value={start} onChange={onStartChange} />
        <TimePair prefix="до" value={end} onChange={onEndChange} />
      </div>
    </div>
  );
}

function TimePair({
  prefix,
  value,
  onChange,
}: {
  prefix: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-[var(--label-tertiary)] w-6 text-right shrink-0">
        {prefix}
      </span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        step={1800}
        className="flex-1 h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      />
    </div>
  );
}
