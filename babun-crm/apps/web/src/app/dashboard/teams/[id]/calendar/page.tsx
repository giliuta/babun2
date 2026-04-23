"use client";

// Sprint 033 Phase I16 — Brigade calendar settings, iOS-Settings redesign.
//
// Instant save on blur — no top-right Save pill. Grouped cards:
//  · СЕТКА КАЛЕНДАРЯ — range with с / по inputs; explainer moved to
//    card footer
//  · ОТКРЫВАТЬ НА — single time input; explainer as footer
//
// Each field commits to upsertTeam on blur so closing the page
// persists the change without an extra tap.

import { use, useEffect, useState } from "react";
import { useTeams } from "@/app/dashboard/layout";
import BrigadeSectionShell from "@/components/teams/BrigadeSectionShell";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function BrigadeCalendarPage({ params }: RouteParams) {
  const { id } = use(params);
  const { teams, upsertTeam } = useTeams();
  const team = teams.find((t) => t.id === id);

  const [wStart, setWStart] = useState(team?.calendar_window_start ?? "");
  const [wEnd, setWEnd] = useState(team?.calendar_window_end ?? "");
  const [scroll, setScroll] = useState(team?.default_scroll_time ?? "");
  const [slotMin, setSlotMin] = useState<number | null>(
    team?.default_slot_minutes ?? null,
  );

  useEffect(() => {
    if (team) {
      setWStart(team.calendar_window_start ?? "");
      setWEnd(team.calendar_window_end ?? "");
      setScroll(team.default_scroll_time ?? "");
      setSlotMin(team.default_slot_minutes ?? null);
    }
  }, [team]);

  if (!team) {
    return (
      <BrigadeSectionShell brigadeId={id} title="Календарь" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Бригада не найдена.
        </div>
      </BrigadeSectionShell>
    );
  }

  // Commit on every change (not just on blur). iOS Safari time pickers
  // don't always fire blur cleanly — user can dismiss the picker and
  // tap the back arrow before blur bubbles up, losing the edit.
  // Writing on change guarantees persistence the instant the native
  // picker commits a new value.
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

  // Phase I36 — reduced to three — 15/30/60. This value now doubles
  // as the snap grid for tap-to-create: если выбрано 30, тап на
  // 11:27 → ставим 11:30; на 11:43 → ставим 11:30 (ближайшее снизу
  // кратное). Новая запись наследует эту же длительность.
  const SLOT_PRESETS = [15, 30, 60];

  return (
    <BrigadeSectionShell brigadeId={id} title="Календарь" hideSave>
      <Group
        title="Сетка календаря"
        footer="Сколько часов видно в календаре. Пусто = 00:00–24:00."
      >
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-3 py-3">
          <div className="grid grid-cols-2 gap-2">
            <TimePair
              prefix="с"
              value={wStart}
              onChange={(v) => {
                setWStart(v);
                commitWindow(v, wEnd);
              }}
            />
            <TimePair
              prefix="по"
              value={wEnd}
              onChange={(v) => {
                setWEnd(v);
                commitWindow(wStart, v);
              }}
            />
          </div>
        </div>
      </Group>

      <Group
        title="Открывать на"
        footer="При открытии бригады календарь проскроллится сюда. Пусто = как обычно."
      >
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-3 py-3">
          <input
            type="time"
            value={scroll}
            onChange={(e) => {
              const v = e.target.value;
              setScroll(v);
              commitScroll(v);
            }}
            step={1800}
            className="w-full h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
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
