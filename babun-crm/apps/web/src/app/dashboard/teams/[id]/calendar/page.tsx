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

  useEffect(() => {
    if (team) {
      setWStart(team.calendar_window_start ?? "");
      setWEnd(team.calendar_window_end ?? "");
      setScroll(team.default_scroll_time ?? "");
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

  const commitWindow = () => {
    upsertTeam({
      ...team,
      calendar_window_start: wStart.trim() || undefined,
      calendar_window_end: wEnd.trim() || undefined,
    });
  };
  const commitScroll = () => {
    upsertTeam({
      ...team,
      default_scroll_time: scroll.trim() || undefined,
    });
  };

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
              onChange={setWStart}
              onBlur={commitWindow}
            />
            <TimePair
              prefix="по"
              value={wEnd}
              onChange={setWEnd}
              onBlur={commitWindow}
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
            onChange={(e) => setScroll(e.target.value)}
            onBlur={commitScroll}
            step={1800}
            className="w-full h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
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
  onBlur,
}: {
  prefix: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
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
        onBlur={onBlur}
        step={1800}
        className="flex-1 h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      />
    </div>
  );
}
