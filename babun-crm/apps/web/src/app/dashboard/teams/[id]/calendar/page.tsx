"use client";

// Sprint 033 Phase H — Brigade calendar settings subroute (grid window + scroll-to).

import { use, useEffect, useState } from "react";
import { haptic } from "@/lib/haptics";
import { useTeams } from "@/app/dashboard/layout";
import BrigadeSectionShell, {
  SectionCard,
  FieldRow,
} from "@/components/teams/BrigadeSectionShell";

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
      <BrigadeSectionShell brigadeId={id} title="Календарь" onSave={() => true}>
        <SectionCard>
          <div className="text-[13px] text-[var(--label-tertiary)] py-4 text-center">
            Бригада не найдена.
          </div>
        </SectionCard>
      </BrigadeSectionShell>
    );
  }

  const handleSave = () => {
    haptic("tap");
    upsertTeam({
      ...team,
      calendar_window_start: wStart.trim() || undefined,
      calendar_window_end: wEnd.trim() || undefined,
      default_scroll_time: scroll.trim() || undefined,
    });
    return true;
  };

  return (
    <BrigadeSectionShell brigadeId={id} title="Календарь" onSave={handleSave}>
      <SectionCard subtitle="Как выглядит календарь, когда выбрана эта бригада.">
        <div>
          <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--label-secondary)] mb-1.5">
            Сетка календаря
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-[var(--label-tertiary)]">с</span>
              <input
                type="time"
                value={wStart}
                onChange={(e) => setWStart(e.target.value)}
                step={1800}
                className="flex-1 h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-[var(--label-tertiary)]">по</span>
              <input
                type="time"
                value={wEnd}
                onChange={(e) => setWEnd(e.target.value)}
                step={1800}
                className="flex-1 h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
          </div>
          <div className="text-[12px] text-[var(--label-tertiary)] mt-1.5">
            Сколько часов видно в календаре. Пусто = 00:00–24:00.
          </div>
        </div>

        <FieldRow label="Открывать на">
          <input
            type="time"
            value={scroll}
            onChange={(e) => setScroll(e.target.value)}
            step={1800}
            className="w-full h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <div className="text-[12px] text-[var(--label-tertiary)] mt-1">
            При открытии бригады календарь проскроллится сюда. Пусто = как обычно.
          </div>
        </FieldRow>
      </SectionCard>
    </BrigadeSectionShell>
  );
}
