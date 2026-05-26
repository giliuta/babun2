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
import { FileEdit, MapPin, Palette } from "@babun/shared/icons";
import { haptic } from "@/lib/haptics";
import { useTeams, useSchedules } from "@/components/layout/DashboardClientLayout";
import { DEFAULT_SCHEDULE } from "@babun/shared/local/schedule";
import { TIMEZONE_OPTIONS } from "@babun/shared/local/calendar-settings";
import IOSSwitch from "@/components/ui/IOSSwitch";
import BrigadeSectionShell from "@/components/teams/BrigadeSectionShell";
import { ListGroup, NavRow } from "@/components/teams/BrigadeNavRow";
import CalendarTimePopup from "@/components/teams/CalendarTimePopup";
import TeamColorPopup from "@/components/teams/TeamColorPopup";

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

  const [name, setName] = useState(team?.name ?? "");
  const [colorOpen, setColorOpen] = useState(false);
  const [wStart, setWStart] = useState(team?.calendar_window_start ?? "");
  const [wEnd, setWEnd] = useState(team?.calendar_window_end ?? "");
  const [scroll, setScroll] = useState(team?.default_scroll_time ?? "");
  const [openField, setOpenField] = useState<
    null | "visible" | "work" | "scroll"
  >(null);

  useEffect(() => {
    // Reset form when `team` flips (different team picked or realtime
    // sync brought a fresh copy). React batches the setters into one
    // re-render — React-Compiler's cascade warning is a false positive
    // for this canonical form-reset pattern.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (team) {
      setName(team.name ?? "");
      setWStart(team.calendar_window_start ?? "");
      setWEnd(team.calendar_window_end ?? "");
      setScroll(team.default_scroll_time ?? "");
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
  const commitTimezone = (v: string) => {
    upsertTeam({ ...team, timezone: v || undefined });
  };
  const commitName = (next: string) => {
    const trimmed = next.trim();
    if (!trimmed || trimmed === team.name) return;
    upsertTeam({ ...team, name: trimmed });
  };
  const commitColor = (next: string) => {
    if (next === team.color) return;
    haptic("tap");
    upsertTeam({ ...team, color: next });
  };

  return (
    <BrigadeSectionShell brigadeId={id} title="Календарь" hideSave>
      {/* Name + colour — the calendar/team title. Type the name; the
          palette icon opens the colour picker. Replaces the old
          «Информация» page. */}
      <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] pl-4 pr-2 flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={(e) => commitName(e.target.value)}
          placeholder="Название"
          maxLength={60}
          className="flex-1 min-w-0 h-12 bg-transparent text-[16px] font-semibold text-[var(--label)] placeholder:text-[var(--label-tertiary)] placeholder:font-normal focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setColorOpen(true)}
          aria-label="Цвет команды"
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 press-scale"
          style={{ backgroundColor: team.color }}
        >
          <Palette
            size={18}
            strokeWidth={2}
            className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]"
          />
        </button>
      </div>

      {/* Метки / Запись — quick access to the two most-edited sub-screens.
          Each opens its existing full-page editor; the back arrow returns
          here via BrigadeSectionShell's backHref. */}
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
            <ValueChip onClick={() => setOpenField("visible")}>
              {wStart || "00:00"} — {wEnd || "24:00"}
            </ValueChip>
          </HoursRow>

          <HoursRow label="Рабочее время" border>
            <ValueChip onClick={() => setOpenField("work")}>
              {schedule.start} — {schedule.end}
            </ValueChip>
          </HoursRow>

          <HoursRow label="Открывается время" border>
            <ValueChip onClick={() => setOpenField("scroll")}>
              {scroll || "—"}
            </ValueChip>
          </HoursRow>
        </div>
      </Group>

      <CalendarTimePopup
        open={openField === "visible"}
        title="Видимое время"
        mode="range"
        start={wStart || "00:00"}
        end={wEnd || "23:30"}
        onClose={() => setOpenField(null)}
        onCommit={(s, e) => {
          setWStart(s);
          setWEnd(e);
          commitWindow(s, e);
        }}
      />
      <CalendarTimePopup
        open={openField === "work"}
        title="Рабочее время"
        mode="range"
        start={schedule.start}
        end={schedule.end}
        onClose={() => setOpenField(null)}
        onCommit={(s, e) => commitWorkHours(s, e)}
      />
      <CalendarTimePopup
        open={openField === "scroll"}
        title="Открывается время"
        mode="single"
        start={scroll || "09:00"}
        onClose={() => setOpenField(null)}
        onCommit={(s) => {
          setScroll(s);
          commitScroll(s);
        }}
      />

      {/* Behaviour knobs for this brigade. */}
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

      <TeamColorPopup
        open={colorOpen}
        current={team.color}
        onPick={commitColor}
        onClose={() => setColorOpen(false)}
      />
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

// Tappable value chip — opens the wheel sheet. Mirrors the time chips in
// the appointment sheet (tap → drum picker) rather than a native input.
function ValueChip({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 px-3 rounded-[8px] bg-[var(--fill-tertiary)] text-[15px] font-medium text-[var(--label)] tabular-nums press-scale active:bg-[var(--fill-secondary)]"
    >
      {children}
    </button>
  );
}
