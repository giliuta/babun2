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
  // STORY audit: «Процент команды» UI убран по запросу. State и
  // commitPayout оставлены неиспользуемыми чтобы был легко обратно
  // включён через возврат блока в JSX. void для линтера.
  // payout_percentage жил только в типе Team, в UI его не
  // было — финансы использовали hardcode 30 % через fallback. Добавляю
  // ввод (5 быстрых пресетов 20/25/30/35/40 + кастомное поле). Сохранение
  // идёт сразу через commitPayout (instant commit как color/description).
  const [payoutPct, setPayoutPct] = useState<number>(
    initial.payout_percentage ?? 30,
  );
  void payoutPct;
  void setPayoutPct;

  useEffect(() => {
    // Reset form fields when `existing` flips (different team picked
    // or realtime sync brought a fresh copy). React batches setters
    // into one re-render; React-Compiler's cascade warning is a
    // false positive for this canonical form-reset pattern.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!isNew && existing) {
      setName(existing.name);
      setDescription(existing.region ?? "");
      setColor(existing.color);
      setPayoutPct(existing.payout_percentage ?? 30);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [existing, isNew]);

  if (!isNew && !existing) {
    return (
      <BrigadeSectionShell brigadeId={id} title="Информация" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Команда не найдена.
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
  const commitPayout = (next: number) => {
    if (!existing) return;
    const clamped = Math.max(0, Math.min(100, Math.round(next)));
    if (clamped === (existing.payout_percentage ?? 30)) return;
    haptic("tap");
    upsertTeam({ ...existing, payout_percentage: clamped });
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
      payout_percentage: Math.max(0, Math.min(100, Math.round(payoutPct))),
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
      title={isNew ? "Новая команда" : "Информация"}
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
            placeholder="Название команды"
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
            placeholder="Для себя — любые заметки о команде"
            rows={2}
            maxLength={300}
            className="w-full bg-transparent text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none resize-none py-1.5 leading-snug"
          />
        </div>
      </div>

      {/* ── Colour ──────────────────────────────────────────────── */}
      <div>
        <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
          Цвет команды
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
            Этот цвет показывает записи команды в календаре и метит её аватарку в списке.
          </div>
        </div>
      </div>

      {/* STORY audit: «Процент команды» UI убран по запросу пользователя.
          Поле payout_percentage остаётся в типе Team и используется в
          useFinanceData с fallback 30 %, но настройка в UI пока скрыта —
          вернём как фичу когда понадобится. */}
    </BrigadeSectionShell>
  );
}
