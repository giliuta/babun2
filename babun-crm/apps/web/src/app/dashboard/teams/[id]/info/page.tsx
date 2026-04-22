"use client";

// Sprint 033 Phase I15 — Brigade Info subroute, iOS Settings redesign.
//
// Changes vs previous:
//  · Split one fat card into grouped cards, iOS-style: name, colour,
//    status toggle, destructive action at bottom.
//  · Instant save for existing brigades — text commits on blur, colour
//    + toggle commit on tap. No top-right Save pill. Consistent with
//    Метки / Мастера subroutes.
//  · NEW brigade still has a "Создать" button (record has to be born
//    first; name required).
//  · Removed the "Описание" field (backing `region`). It duplicated
//    the purpose of Метки and was the main source of confusion in
//    the screenshot — users typed city names into it. Legacy `region`
//    left in the data model but no longer edited here.
//  · Status is a proper IOSSwitch row instead of a pill that toggles
//    on tap. Matches the archive gesture on the brigades list.
//  · Delete button at the bottom of the page (existing brigades only)
//    with the same cascade-to-masters+appointments semantics as the
//    list page. Gives users a single natural destructive spot on the
//    detail screen.

import { use, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { haptic } from "@/lib/haptics";
import {
  useAppointments,
  useMasters,
  useTeams,
} from "@/app/dashboard/layout";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import IOSSwitch from "@/components/ui/IOSSwitch";
import {
  TEAM_COLORS,
  generateId,
  type Master,
  type Team,
} from "@/lib/masters";
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
  const router = useRouter();
  const confirm = useConfirm();
  const { teams, upsertTeam, deleteTeam } = useTeams();
  const { masters, setMasters } = useMasters();
  const { appointments, upsertAppointment } = useAppointments();

  const existing = teams.find((t) => t.id === id);
  const initial: Team = isNew
    ? { ...BLANK_TEAM, id: generateId("team"), created_at: new Date().toISOString() }
    : existing ?? BLANK_TEAM;

  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const [active, setActive] = useState(initial.active);

  useEffect(() => {
    if (!isNew && existing) {
      setName(existing.name);
      setColor(existing.color);
      setActive(existing.active);
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
  const commitColor = (next: string) => {
    if (!existing) return;
    if (next === existing.color) return;
    haptic("tap");
    upsertTeam({ ...existing, color: next });
  };
  const commitActive = (next: boolean) => {
    if (!existing) return;
    if (next === existing.active) return;
    haptic("tap");
    upsertTeam({ ...existing, active: next });
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
      color,
      active,
    });
    return true;
  };

  // ── delete (existing only) ──────────────────────────────────────
  const handleDelete = async () => {
    if (!existing) return;
    const orphanCount = appointments.filter(
      (a) => a.team_id === existing.id,
    ).length;
    const extra =
      orphanCount > 0
        ? `У ${orphanCount} записей сбросится привязка к бригаде (сами записи останутся).`
        : "Эта бригада нигде не используется.";
    const ok = await confirm({
      title: `Удалить бригаду «${existing.name}»?`,
      message: extra,
      confirmLabel: "Удалить",
    });
    if (!ok) return;
    haptic("warning");
    deleteTeam(existing.id);
    setMasters(
      masters.map<Master>((m) =>
        m.team_id === existing.id ? { ...m, team_id: null } : m,
      ),
    );
    for (const apt of appointments) {
      if (apt.team_id === existing.id) {
        upsertAppointment({
          ...apt,
          team_id: null,
          updated_at: new Date().toISOString(),
        });
      }
    }
    router.push("/dashboard/teams");
  };

  const sharedShellProps = isNew
    ? {
        saveLabel: "Создать",
        canSave: name.trim().length > 0,
        onSave: handleCreate,
      }
    : { hideSave: true, onDelete: handleDelete, deleteLabel: "Удалить бригаду" };

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
            placeholder="Напр. Юра + Даня"
            className="w-full h-11 bg-transparent text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none"
            maxLength={60}
          />
        </div>
      </div>

      {/* ── Colour ──────────────────────────────────────────────── */}
      <div>
        <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
          Цвет бригады
        </div>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-4">
          <div className="grid grid-cols-5 gap-3 sm:grid-cols-6">
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
                      size={18}
                      strokeWidth={3}
                      className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]"
                    />
                  )}
                  {picked && (
                    <span
                      className="absolute -inset-[3px] rounded-full border-2 pointer-events-none"
                      style={{ borderColor: c.value }}
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

      {/* ── Status toggle ──────────────────────────────────────── */}
      <div>
        <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
          Статус
        </div>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="flex items-center gap-3 px-4 min-h-[52px]">
            <div className="flex-1 min-w-0">
              <div className="text-[15px] text-[var(--label)]">
                Бригада активна
              </div>
              <div className="text-[12px] text-[var(--label-tertiary)] leading-snug">
                {active
                  ? "Показывается в списках, в календаре и в выборе."
                  : "Скрыта из календаря и выбора. Можно вернуть из архива."}
              </div>
            </div>
            <IOSSwitch
              checked={active}
              onChange={(v) => {
                setActive(v);
                commitActive(v);
              }}
              ariaLabel="Активна"
            />
          </div>
        </div>
      </div>
    </BrigadeSectionShell>
  );
}
