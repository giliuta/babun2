"use client";

// Sprint 033 Phase H — Brigade subroute: name · description · colour · status.

import { use, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useTeams } from "@/app/dashboard/layout";
import {
  TEAM_COLORS,
  generateId,
  type Team,
} from "@/lib/masters";
import BrigadeSectionShell, {
  SectionCard,
  FieldRow,
} from "@/components/teams/BrigadeSectionShell";

const BLANK_TEAM: Team = {
  id: "",
  name: "",
  region: "",
  color: TEAM_COLORS[0].value,
  default_city: "",
  lead_id: null,
  lead_ids: [],
  helper_ids: [],
  payout_percentage: 30,
  active: true,
  created_at: "",
};

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function BrigadeInfoPage({ params }: RouteParams) {
  const { id } = use(params);
  const isNew = id === "new";
  const { teams, upsertTeam } = useTeams();

  const existing = teams.find((t) => t.id === id);
  const initial: Team = isNew
    ? { ...BLANK_TEAM, id: generateId("team"), created_at: new Date().toISOString() }
    : existing ?? BLANK_TEAM;

  const [name, setName] = useState(initial.name);
  const [region, setRegion] = useState(initial.region);
  const [color, setColor] = useState(initial.color);
  const [active, setActive] = useState(initial.active);

  // Re-sync when the team record hydrates after mount.
  useEffect(() => {
    if (!isNew && existing) {
      setName(existing.name);
      setRegion(existing.region);
      setColor(existing.color);
      setActive(existing.active);
    }
  }, [existing, isNew]);

  const handleSave = (): boolean => {
    if (!name.trim()) {
      haptic("warning");
      return false;
    }
    haptic("tap");
    const base = existing ?? initial;
    upsertTeam({
      ...base,
      name: name.trim(),
      region: region.trim(),
      color,
      active,
    });
    return true;
  };

  if (!isNew && !existing) {
    return (
      <BrigadeSectionShell brigadeId={id} title="Информация" onSave={() => true}>
        <SectionCard>
          <div className="text-[13px] text-[var(--label-tertiary)] py-4 text-center">
            Бригада не найдена.
          </div>
        </SectionCard>
      </BrigadeSectionShell>
    );
  }

  return (
    <BrigadeSectionShell
      brigadeId={id}
      title={isNew ? "Новая бригада" : "Информация"}
      saveLabel={isNew ? "Создать" : "Сохранить"}
      canSave={name.trim().length > 0}
      onSave={handleSave}
    >
      <SectionCard>
        <FieldRow label="Название">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Напр. Юра + Даня"
            className="w-full h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </FieldRow>

        <FieldRow label="Описание">
          <textarea
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Комментарий к бригаде — для вас"
            rows={2}
            className="w-full px-3 py-2 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
          />
        </FieldRow>

        <FieldRow label="Цвет бригады">
          <div className="flex flex-wrap gap-2.5">
            {TEAM_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  haptic("tap");
                  setColor(c.value);
                }}
                aria-label={c.name}
                className={`w-9 h-9 rounded-full press-scale transition ${
                  color === c.value ? "ring-[3px] ring-offset-2 ring-[var(--accent)]" : ""
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        </FieldRow>

        <FieldRow label="Статус">
          <button
            type="button"
            onClick={() => {
              haptic("tap");
              setActive(!active);
            }}
            className={`inline-flex items-center gap-2 h-9 px-4 rounded-full text-[14px] font-medium press-scale ${
              active
                ? "bg-[rgba(52,199,89,0.15)] text-[var(--system-green)]"
                : "bg-[var(--fill-tertiary)] text-[var(--label-secondary)]"
            }`}
          >
            {active ? <Check size={14} /> : <X size={14} />}
            {active ? "Активна" : "В архиве"}
          </button>
        </FieldRow>
      </SectionCard>
    </BrigadeSectionShell>
  );
}
