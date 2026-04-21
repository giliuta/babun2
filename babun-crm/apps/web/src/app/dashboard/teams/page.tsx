"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronRight, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { Button, IOSSwitch, Input } from "@/components/ui";
import { useAppointments, useMasters, useTeams } from "@/app/dashboard/layout";
import {
  TEAM_COLORS,
  generateId,
  getInitials,
  getTeamMembers,
  type Master,
  type Team,
} from "@/lib/masters";

// ─── Page ────────────────────────────────────────────────────────────────

export default function TeamsPage() {
  const router = useRouter();
  const { teams, upsertTeam, deleteTeam } = useTeams();
  const { masters, setMasters } = useMasters();
  const { appointments, upsertAppointment } = useAppointments();
  const confirm = useConfirm();

  const [editing, setEditing] = useState<Team | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Group masters by their team_id so the "Мастера" section below can
  // render them clustered with the team they belong to (plus a
  // "Без бригады" bucket for unassigned ones).
  const mastersByTeam = useMemo(() => {
    const groups = new Map<string | null, Master[]>();
    for (const m of masters) {
      const key = m.team_id ?? null;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    }
    return groups;
  }, [masters]);

  const unassignedMasters = mastersByTeam.get(null) ?? [];

  const openNew = () => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (team: Team) => {
    setEditing(team);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const handleSave = (team: Team, leadId: string | null, helperIds: string[]) => {
    upsertTeam(team);

    // Update master.team_id for lead and helpers → set to team.id
    // For masters that were previously in this team but are no longer → set to null
    const newMemberIds = new Set<string>();
    if (leadId) newMemberIds.add(leadId);
    helperIds.forEach((id) => newMemberIds.add(id));

    const updatedMasters = masters.map<Master>((m) => {
      const wasInThisTeam = m.team_id === team.id;
      const isInThisTeamNow = newMemberIds.has(m.id);

      if (isInThisTeamNow) {
        if (m.team_id !== team.id) {
          return { ...m, team_id: team.id };
        }
        return m;
      }

      if (wasInThisTeam) {
        return { ...m, team_id: null };
      }

      return m;
    });

    setMasters(updatedMasters);
    closeForm();
  };

  const handleDelete = async (team: Team) => {
    const orphanCount = appointments.filter((a) => a.team_id === team.id).length;
    const extra =
      orphanCount > 0
        ? `У ${orphanCount} записей сбросится привязка к бригаде (записи останутся, team_id будет пустым).`
        : "Эта бригада нигде не используется.";
    const ok = await confirm({
      title: `Удалить бригаду «${team.name}»?`,
      message: extra,
    });
    if (!ok) return;
    deleteTeam(team.id);
    // Clear team_id on any master that was in this team
    const updatedMasters = masters.map<Master>((m) =>
      m.team_id === team.id ? { ...m, team_id: null } : m,
    );
    setMasters(updatedMasters);
    // Cascade to appointments so route/calendar don't show orphans
    for (const apt of appointments) {
      if (apt.team_id === team.id) {
        upsertAppointment({ ...apt, team_id: null, updated_at: new Date().toISOString() });
      }
    }
  };

  return (
    <>
      <PageHeader
        title="Бригады"
        subtitle={`${teams.length} ${teams.length === 1 ? "бригада" : "бригад"}`}
        rightContent={
          <button
            type="button"
            onClick={openNew}
            aria-label="Добавить бригаду"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-white lg:text-[var(--label)] hover:bg-[var(--accent)] lg:hover:bg-[var(--fill-tertiary)]"
          >
            <Plus size={20} strokeWidth={2.5} />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)] relative">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-5 stagger-children">
          {teams.length === 0 && (
            <div className="text-center text-[var(--label-tertiary)] py-10 text-[13px]">
              Нет бригад. Нажмите «+» чтобы создать.
            </div>
          )}

          <div className="px-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
            Бригады
          </div>
          <div className="space-y-3">
            {teams.map((team) => {
              const { lead, helpers } = getTeamMembers(team, masters);
              return (
                <div
                  key={team.id}
                  className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4"
                >
                  {/* Top row: color circle + name/region + actions */}
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                      style={{ backgroundColor: team.color }}
                    >
                      {team.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-semibold text-[var(--label)] truncate">
                        {team.name}
                      </div>
                      <div className="text-[13px] text-[var(--label-secondary)] truncate">
                        {team.region || "—"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(team)}
                        aria-label="Редактировать"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--label-secondary)] hover:bg-[var(--fill-tertiary)]"
                      >
                        <Pencil size={16} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(team)}
                        aria-label="Удалить"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--system-red)] hover:bg-[rgba(255,59,48,0.1)]"
                      >
                        <Trash2 size={16} strokeWidth={2} />
                      </button>
                    </div>
                  </div>

                  {/* Lead row */}
                  <div className="mt-3 flex items-center gap-2">
                    {lead ? (
                      <>
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0"
                          style={{ backgroundColor: team.color }}
                        >
                          {getInitials(lead.full_name)}
                        </div>
                        <div className="text-[13px] text-[var(--label-secondary)] whitespace-nowrap">
                          Бригадир:{" "}
                          <span className="font-medium text-[var(--label)]">
                            {lead.full_name}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-[13px] text-[var(--label-tertiary)]">
                        Бригадир не назначен
                      </div>
                    )}
                  </div>

                  {/* Helpers row */}
                  {helpers.length > 0 && (
                    <div className="mt-2 flex items-start gap-2">
                      <div className="text-[13px] text-[var(--label-secondary)] shrink-0 pt-0.5">
                        Помощники:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {helpers.map((h) => (
                          <span
                            key={h.id}
                            className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--fill-tertiary)] text-[var(--label)] text-[11px] whitespace-nowrap"
                          >
                            {h.full_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Status chip */}
                  <div className="mt-3">
                    <span
                      className={`inline-block text-[11px] px-2 py-0.5 rounded-full ${
                        team.active
                          ? "bg-[rgba(52,199,89,0.15)] text-[var(--system-green)]"
                          : "bg-[var(--fill-tertiary)] text-[var(--label-secondary)]"
                      }`}
                    >
                      {team.active ? "Активна" : "Неактивна"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sprint 026: Мастера — отдельная страница. Здесь ссылка-
              напоминалка, чтобы не забыть где их заводить и редактировать. */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => router.push("/dashboard/masters")}
              className="w-full flex items-center justify-between bg-[var(--surface-card)] rounded-2xl px-4 py-3 active:bg-[var(--fill-quaternary)] transition shadow-[var(--shadow-card)]"
            >
              <div className="text-left">
                <div className="text-[15px] font-semibold text-[var(--label)]">
                  Мастера ({masters.length})
                </div>
                <div className="text-[12px] text-[var(--label-secondary)]">
                  Добавить сотрудника, ЗП, доступы, документы
                </div>
              </div>
              <ChevronRight size={16} className="text-[var(--label-tertiary)]" />
            </button>
          </div>

          {unassignedMasters.length > 0 && (
            <div className="flex items-start gap-2 text-[12px] text-[var(--system-orange)] bg-[rgba(255,149,0,0.1)] rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>
                {unassignedMasters.length}{" "}
                {unassignedMasters.length === 1
                  ? "мастер не привязан"
                  : "мастера не привязаны"}{" "}
                к бригадам. Откройте бригаду и добавьте их в состав.
              </span>
            </div>
          )}
        </div>

      </div>

      {showForm && (
        <TeamFormModal
          key={editing?.id ?? "new"}
          team={editing}
          masters={masters}
          onCancel={closeForm}
          onSave={handleSave}
        />
      )}
    </>
  );
}

// ─── Team Form Modal ────────────────────────────────────────────────────

function TeamFormModal({
  team,
  masters,
  onCancel,
  onSave,
}: {
  team: Team | null;
  masters: Master[];
  onCancel: () => void;
  onSave: (team: Team, leadId: string | null, helperIds: string[]) => void;
}) {
  const [name, setName] = useState(team?.name ?? "");
  const [region, setRegion] = useState(team?.region ?? "");
  const [defaultCity, setDefaultCity] = useState(team?.default_city ?? "");
  const [color, setColor] = useState(team?.color ?? TEAM_COLORS[0].value);
  const [leadId, setLeadId] = useState<string | null>(team?.lead_id ?? null);
  const [helperIds, setHelperIds] = useState<string[]>(team?.helper_ids ?? []);
  const [active, setActive] = useState(team?.active ?? true);
  const [payoutPercentage, setPayoutPercentage] = useState<number>(
    team?.payout_percentage ?? 30
  );

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const activeMasters = useMemo(
    () => masters.filter((m) => m.is_active),
    [masters],
  );

  // Helpers can't include the lead
  const availableHelpers = useMemo(
    () => activeMasters.filter((m) => m.id !== leadId),
    [activeMasters, leadId],
  );

  // If lead changes and was in helper list → remove from helpers
  useEffect(() => {
    if (leadId && helperIds.includes(leadId)) {
      setHelperIds((prev) => prev.filter((id) => id !== leadId));
    }
  }, [leadId, helperIds]);

  const toggleHelper = (id: string) => {
    setHelperIds((prev) =>
      prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id],
    );
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      window.alert("Введите название бригады");
      return;
    }

    const nowIso = new Date().toISOString();
    const nextTeam: Team = {
      id: team?.id ?? generateId("team"),
      name: name.trim(),
      region: region.trim(),
      default_city: defaultCity.trim(),
      color,
      lead_id: leadId,
      helper_ids: helperIds,
      payout_percentage: Math.max(0, Math.min(100, payoutPercentage || 0)),
      active,
      created_at: team?.created_at ?? nowIso,
    };

    onSave(nextTeam, leadId, helperIds);
  };

  const masterTeamLabel = (m: Master): string => {
    if (!m.team_id) return "без бригады";
    return "";
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-[var(--surface-overlay)] backdrop-blur-[2px] flex items-center justify-center p-2"
      onClick={onCancel}
    >
      <div
        className="bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] p-4 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-semibold text-[var(--label)] mb-4 tracking-tight">
          {team ? "Редактировать бригаду" : "Новая бригада"}
        </h2>

        <div className="space-y-4">
          {/* Name */}
          <Input
            label="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          {/* Region */}
          <Input
            label="Регион"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Например: Пафос, Лимассол"
          />

          {/* Default city */}
          <Input
            label="Базовый город"
            value={defaultCity}
            onChange={(e) => setDefaultCity(e.target.value)}
            placeholder="Например: Пафос"
            hint="Ставится дефолтом на каждый день в календаре. Можно переопределить тапом по дню."
          />

          {/* Payout percentage */}
          <div>
            <div className="block text-[12px] font-medium text-[var(--label-secondary)] mb-1.5 tracking-wide">
              Зарплата (% от чистого дохода)
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                value={payoutPercentage}
                onChange={(e) => setPayoutPercentage(Number(e.target.value) || 0)}
                className="w-24 h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition tabular-nums"
              />
              <span className="text-[15px] text-[var(--label-secondary)]">%</span>
            </div>
            <div className="text-[11px] text-[var(--label-tertiary)] mt-1.5 leading-snug">
              Применяется к (доход − расход бригады) за выбранный период.
              Используется на странице Финансы → Зарплата.
            </div>
          </div>

          {/* Color */}
          <div>
            <div className="block text-[12px] font-medium text-[var(--label-secondary)] mb-2 tracking-wide">
              Цвет
            </div>
            <div className="grid grid-cols-8 gap-2">
              {TEAM_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  aria-label={c.name}
                  className={`w-8 h-8 rounded-full transition-all ${
                    color === c.value
                      ? "ring-2 ring-[var(--accent)] ring-offset-2"
                      : ""
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>

          {/* Lead */}
          <div>
            <div className="block text-[12px] font-medium text-[var(--label-secondary)] mb-1.5 tracking-wide">
              Бригадир (Лид)
            </div>
            <select
              value={leadId ?? ""}
              onChange={(e) => setLeadId(e.target.value || null)}
              className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
            >
              <option value="">— Не выбран —</option>
              {activeMasters.map((m) => {
                const suffix = masterTeamLabel(m);
                return (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                    {suffix ? ` (${suffix})` : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Helpers */}
          <div>
            <div className="block text-[12px] font-medium text-[var(--label-secondary)] mb-2 tracking-wide">
              Помощники
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto border border-[var(--separator)] rounded-[10px] p-2">
              {availableHelpers.length === 0 && (
                <div className="text-[13px] text-[var(--label-tertiary)] px-2 py-1">
                  Нет доступных мастеров
                </div>
              )}
              {availableHelpers.map((m) => {
                const checked = helperIds.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--fill-quaternary)] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleHelper(m.id)}
                      className="w-4 h-4 accent-[var(--accent)]"
                    />
                    <span className="text-[15px] text-[var(--label)]">{m.full_name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <span className="text-[15px] text-[var(--label)]">Активна</span>
            <IOSSwitch checked={active} onChange={setActive} ariaLabel="Активна" />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="secondary" size="md" onClick={onCancel}>
            Отмена
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit}>
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  );
}
