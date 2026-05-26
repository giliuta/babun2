"use client";

// Brigade calendar settings — mirrors the personal «Мой календарь»
// layout so a brigade calendar is configured the same way:
//  · Метки / Запись nav rows on top (quick access)
//  · ЧАСЫ ДНЯ — Видимое / Рабочее / Открывается время
//  · ШАГ ПРИ ТАПЕ
//  · ПОВЕДЕНИЕ КАЛЕНДАРЯ
//
// «Рабочее время» writes to the brigade TeamSchedule start/end (the same
// field the calendar grid reads to grey out non-working hours), so the
// dedicated Расписание editor page is no longer needed. Days-off, breaks
// and vacations still live in the schedule data and still render; they're
// edited per-day by tapping a day header on the calendar.
//
// Each field commits instantly (no Save pill).

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileEdit, MapPin } from "@babun/shared/icons";
import { useTeams, useSchedules } from "@/components/layout/DashboardClientLayout";
import { DEFAULT_SCHEDULE } from "@babun/shared/local/schedule";
import { TIMEZONE_OPTIONS } from "@babun/shared/local/calendar-settings";
import IOSSwitch from "@/components/ui/IOSSwitch";
import BrigadeSectionShell from "@/components/teams/BrigadeSectionShell";
import { ListGroup, NavRow } from "@/components/teams/BrigadeNavRow";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function BrigadeCalendarPage({ params }: RouteParams) {
  const { id } = use(params);
  const router = useRouter();
  const { teams, upsertTeam } = useTeams();
  const { schedules, setSchedules } = useSchedules();
  const team = teams.find((t) => t.id === id);
  const schedule = schedules[id] ?? DEFAULT_SCHEDULE;

  const appointmentBlocksPreview = useMemo(() => {
    const blocks = team?.appointment_blocks;
    if (!blocks) return "стандартные блоки";
    const overrides = Object.keys(blocks).length;
    if (overrides === 0) return "стандартные блоки";
    return `${overrides} настроек изменено`;
  }, [team]);

  const citiesPreview = useMemo((): { text: string; warning: boolean } => {
    const list = team?.cities ?? [];
    if (list.length === 0) return { text: "не заданы", warning: true };
    const text =
      list.length <= 3
        ? list.join(", ")
        : `${list.slice(0, 2).join(", ")} и ещё ${list.length - 2}`;
    return { text, warning: false };
  }, [team]);

  const [wStart, setWStart] = useState(team?.calendar_window_start ?? "");
  const [wEnd, setWEnd] = useState(team?.calendar_window_end ?? "");
  const [scroll, setScroll] = useState(team?.default_scroll_time ?? "");
  const [slotMin, setSlotMin] = useState<number | null>(
    team?.default_slot_minutes ?? null,
  );

  useEffect(() => {
    // Reset form when `team` flips (different team picked or realtime
    // sync brought a fresh copy). React batches the setters into one
    // re-render — React-Compiler's cascade warning is a false positive
    // for this canonical form-reset pattern.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (team) {
      setWStart(team.calendar_window_start ?? "");
      setWEnd(team.calendar_window_end ?? "");
      setScroll(team.default_scroll_time ?? "");
      setSlotMin(team.default_slot_minutes ?? null);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [team]);

  if (!team) {
    return (
      <BrigadeSectionShell brigadeId={id} title="Календарь" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Команда не найдена.
        </div>
      </BrigadeSectionShell>
    );
  }

  // Commit on every change (not just on blur). iOS Safari time pickers
  // don't always fire blur cleanly — the user can dismiss the picker and
  // tap the back arrow before blur bubbles up, losing the edit.
  const commitWindow = (startVal: string, endVal: string) => {
    upsertTeam({
      ...team,
      calendar_window_start: startVal.trim() || undefined,
      calendar_window_end: endVal.trim() || undefined,
    });
  };
  const commitScroll = (v: string) => {
    upsertTeam({
      ...team,
      default_scroll_time: v.trim() || undefined,
    });
  };
  const commitSlot = (v: number | null) => {
    upsertTeam({
      ...team,
      default_slot_minutes: v && v > 0 ? v : undefined,
    });
  };
  // Working hours live on the brigade TeamSchedule (start/end). The
  // calendar grid greys out everything outside this band, so editing it
  // here is what the old Расписание page used to do.
  const commitWorkHours = (startVal: string, endVal: string) => {
    setSchedules({
      ...schedules,
      [id]: { ...schedule, start: startVal, end: endVal },
    });
  };
  const commitBuffer = (m: number) => {
    upsertTeam({
      ...team,
      buffer_minutes: m > 0 ? m : undefined,
    });
  };
  const commitHideCancelled = (next: boolean) => {
    upsertTeam({
      ...team,
      hide_cancelled: next || undefined,
    });
  };
  const commitAllowOvertime = (next: boolean) => {
    upsertTeam({
      ...team,
      allow_overtime: next || undefined,
    });
  };
  const commitWeekStart = (v: "monday" | "sunday") => {
    upsertTeam({ ...team, week_start: v });
  };
  const commitTimezone = (v: string) => {
    upsertTeam({ ...team, timezone: v || undefined });
  };

  const SLOT_PRESETS = [15, 30, 60];

  return (
    <BrigadeSectionShell brigadeId={id} title="Календарь" hideSave>
      {/* Метки / Запись on top — quick access to the two most-edited
          sub-screens. Each opens its existing full-page editor; the back
          arrow returns here via BrigadeSectionShell's backHref. */}
      <ListGroup>
        <NavRow
          icon={<MapPin size={18} strokeWidth={2} />}
          tone="bg-[var(--tile-red)]"
          title="Метки"
          value={citiesPreview.text}
          warning={citiesPreview.warning}
          onClick={() => router.push(`/dashboard/teams/${id}/cities`)}
        />
        <NavRow
          icon={<FileEdit size={18} strokeWidth={2} />}
          tone="bg-[var(--tile-yellow)]"
          title="Запись"
          value={appointmentBlocksPreview}
          onClick={() =>
            router.push(`/dashboard/teams/${id}/appointment-blocks`)
          }
        />
      </ListGroup>

      <Group
        title="Часы дня"
        footer="Видимое — сколько часов видно в сетке (пусто = 00:00–24:00). Рабочее — рабочие часы подсвечиваются. Открывается — куда проскроллить при открытии."
      >
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
          <HoursRow label="Видимое время">
            <TimeInput
              value={wStart}
              onChange={(v) => {
                setWStart(v);
                commitWindow(v, wEnd);
              }}
            />
            <span className="text-[var(--label-tertiary)]">—</span>
            <TimeInput
              value={wEnd}
              onChange={(v) => {
                setWEnd(v);
                commitWindow(wStart, v);
              }}
            />
          </HoursRow>

          <HoursRow label="Рабочее время" border>
            <TimeInput
              value={schedule.start}
              onChange={(v) => commitWorkHours(v, schedule.end)}
            />
            <span className="text-[var(--label-tertiary)]">—</span>
            <TimeInput
              value={schedule.end}
              onChange={(v) => commitWorkHours(schedule.start, v)}
            />
          </HoursRow>

          <HoursRow label="Открывается время" border>
            <TimeInput
              value={scroll}
              onChange={(v) => {
                setScroll(v);
                commitScroll(v);
              }}
            />
          </HoursRow>
        </div>
      </Group>

      <Group
        title="Шаг при тапе на календарь"
        footer={
          "Тап по пустой клетке создаёт запись, округлённую до выбранного шага. " +
          "15 мин — время ляжет на 11:00 / 11:15 / 11:30 / 11:45. " +
          "30 мин — только на 11:00 / 11:30 / 12:00. " +
          "60 мин — ровно 11:00 / 12:00 / 13:00. " +
          "Длительность новой записи равна этому же шагу; дальше пересчитывается по выбранным услугам."
        }
      >
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-2 grid grid-cols-3 gap-2">
          {SLOT_PRESETS.map((m) => {
            // Если слот ни разу не выставлен — подсвечиваем 30 как
            // дефолт, чтобы пилюли всегда показывали активное состояние.
            const picked = (slotMin ?? 30) === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setSlotMin(m);
                  commitSlot(m);
                }}
                className={`h-10 rounded-[10px] text-[14px] font-medium press-scale transition-colors tabular-nums ${
                  picked
                    ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                    : "bg-[var(--fill-tertiary)] text-[var(--label)]"
                }`}
              >
                {m} мин
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="Начало недели">
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-2">
          <div className="inline-flex w-full p-0.5 rounded-[10px] bg-[var(--fill-tertiary)]">
            {(["monday", "sunday"] as const).map((day) => {
              const active = (team.week_start ?? "monday") === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => commitWeekStart(day)}
                  className={`flex-1 h-9 rounded-[8px] text-[14px] font-medium press-scale transition-colors ${
                    active
                      ? "bg-[var(--surface-card)] text-[var(--label)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                      : "text-[var(--label-secondary)]"
                  }`}
                >
                  {day === "monday" ? "Понедельник" : "Воскресенье"}
                </button>
              );
            })}
          </div>
        </div>
      </Group>

      {/* Behaviour knobs for this brigade. Overrides the global «Мой
          календарь» values when this brigade is active. */}
      <Group
        title="Поведение календаря"
        footer="Действует только для этой команды. Если пусто / выкл — подтягивается глобальный вариант из «Мой календарь»."
      >
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
          {/* Buffer between appointments */}
          <div className="px-4 py-3">
            <div className="text-[15px] text-[var(--label)]">
              Перерыв между записями
            </div>
            <div className="text-[12px] text-[var(--label-tertiary)] leading-snug mt-0.5">
              Автоматический буфер после каждого визита — дорога, уборка инструмента.
            </div>
            <div className="flex gap-1.5 mt-2.5">
              {[0, 10, 15, 20, 30, 45, 60].map((m) => {
                const picked = (team.buffer_minutes ?? 0) === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => commitBuffer(m)}
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
              checked={team.hide_cancelled ?? false}
              onChange={commitHideCancelled}
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
                Последний визит может закончиться после конца рабочего дня без ошибки.
              </div>
            </div>
            <IOSSwitch
              checked={team.allow_overtime ?? false}
              onChange={commitAllowOvertime}
              ariaLabel="Разрешить продлить рабочий день"
            />
          </div>
        </div>
      </Group>

      <Group title="Часовой пояс">
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-3 py-3">
          <select
            value={team.timezone ?? "Europe/Nicosia"}
            onChange={(e) => commitTimezone(e.target.value)}
            className="w-full h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
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

// One labeled row inside the «Часы дня» card — label on the left, time
// pickers on the right (mirrors the personal calendar layout).
function HoursRow({
  label,
  border,
  children,
}: {
  label: string;
  border?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-3 ${
        border ? "border-t border-[var(--separator)]" : ""
      }`}
    >
      <span className="text-[15px] text-[var(--label)] shrink-0">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function TimeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      step={1800}
      className="h-9 px-2 rounded-[8px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
    />
  );
}
