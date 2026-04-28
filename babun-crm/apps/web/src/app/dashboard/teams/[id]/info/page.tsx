"use client";

// Sprint 033 Phase I28 — Brigade Info, third pass.
//  · Colour grid: 14 swatches in 7×2 (was grid-cols-5 giving
//    5+5+3+1). Matches the unified palette elsewhere.
//  · Status toggle dropped — it's already on the brigade detail
//    page as an inline IOSSwitch; duplicating here made the page
//    redundantly clickable in two places.
//  · NEW: "Описание" textarea — freeform memo for the tenant
//    themself (internal notes, accents, heads-ups). Reuses the
//    Team.region field in the data model (repurposed from its old
//    "city tag" meaning, which became Метки).

import { use, useEffect, useState } from "react";
import { Check } from "@babun/shared/icons";
import { haptic } from "@/lib/haptics";
import { useTeams } from "@/components/layout/DashboardClientLayout";
import {
  TEAM_COLORS,
  generateId,
  type Team,
} from "@babun/shared/local/masters";
import BrigadeSectionShell from "@/components/teams/BrigadeSectionShell";

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
  const [description, setDescription] = useState(initial.region ?? "");
  const [color, setColor] = useState(initial.color);

  useEffect(() => {
    if (!isNew && existing) {
      setName(existing.name);
      setDescription(existing.region ?? "");
      setColor(existing.color);
    }
  }, [existing, isNew]);

  if (!isNew && !existing) {
    return (
      <BrigadeSectionShell brigadeId={id} title="Информация" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Бригада не найдена.
        </div>
      </BrigadeSectionShell>
    );
  }

  // ── instant commit helpers (existing brigade only) ───────────────
  const commitName = (next: string) => {
    if (!existing) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === existing.name) return;
    upsertTeam({ ...existing, name: trimmed });
  };
  const commitDescription = (next: string) => {
    if (!existing) return;
    const trimmed = next.trim();
    if ((existing.region ?? "") === trimmed) return;
    upsertTeam({ ...existing, region: trimmed });
  };
  const commitColor = (next: string) => {
    if (!existing) return;
    if (next === existing.color) return;
    haptic("tap");
    upsertTeam({ ...existing, color: next });
  };

  // ── new-brigade create flow ──────────────────────────────────────
  const handleCreate = (): boolean => {
    if (!name.trim()) {
      haptic("warning");
      return false;
    }
    haptic("tap");
    upsertTeam({
      ...initial,
      name: name.trim(),
      region: description.trim(),
      color,
    });
    return true;
  };

  const sharedShellProps = isNew
    ? {
        saveLabel: "Создать",
        canSave: name.trim().length > 0,
        onSave: handleCreate,
      }
    : { hideSave: true };

  return (
    <BrigadeSectionShell
      brigadeId={id}
      title={isNew ? "Новая бригада" : "Информация"}
      {...sharedShellProps}
    >
      {/* ── Name ────────────────────────────────────────────────── */}
      <div>
        <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
          Название
        </div>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={(e) => {
              if (!isNew) commitName(e.target.value);
            }}
            placeholder="Название бригады"
            className="w-full h-11 bg-transparent text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none"
            maxLength={60}
          />
        </div>
      </div>

      {/* ── Description ─────────────────────────────────────────── */}
      <div>
        <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
          Описание
        </div>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-2">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={(e) => {
              if (!isNew) commitDescription(e.target.value);
            }}
            placeholder="Для себя — любые заметки о бригаде"
            rows={2}
            maxLength={300}
            className="w-full bg-transparent text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none resize-none py-1.5 leading-snug"
          />
        </div>
      </div>

      {/* ── Colour ──────────────────────────────────────────────── */}
      <div>
        <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
          Цвет бригады
        </div>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-4">
          <div className="grid grid-cols-7 gap-2">
            {TEAM_COLORS.map((c) => {
              const picked = c.value === color;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    setColor(c.value);
                    commitColor(c.value);
                  }}
                  aria-label={c.name}
                  className="relative w-full aspect-square rounded-full press-scale flex items-center justify-center"
                  style={{ backgroundColor: c.value }}
                >
                  {picked && (
                    <Check
                      size={16}
                      strokeWidth={3}
                      className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]"
                    />
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-3 text-[12px] text-[var(--label-tertiary)] leading-snug">
            Этот цвет показывает записи бригады в календаре и метит её аватарку в списке.
          </div>
        </div>
      </div>
    </BrigadeSectionShell>
  );
}
