"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { useMasters, useTeams } from "@/app/dashboard/layout";
import {
  TEAM_COLORS,
  ROLE_LABELS,
  generateId,
  getInitials,
  getTeamMembers,
  type Master,
  type MasterRole,
  type Team,
} from "@/lib/masters";

// ─── Page ────────────────────────────────────────────────────────────────

export default function TeamsPage() {
  const router = useRouter();
  const { teams, upsertTeam, deleteTeam } = useTeams();
  const { masters, setMasters } = useMasters();

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

  const handleDelete = (team: Team) => {
    if (!window.confirm(`Удалить бригаду "${team.name}"?`)) return;
    deleteTeam(team.id);
    // Clear team_id on any master that was in this team
    const updatedMasters = masters.map<Master>((m) =>
      m.team_id === team.id ? { ...m, team_id: null } : m,
    );
    setMasters(updatedMasters);
  };

  return (
    <>
      <PageHeader
        title="Бригады и мастера"
        rightContent={
          <>
            <button
              type="button"
              onClick={() => router.push("/dashboard/masters")}
              aria-label="Мастера"
              className="px-2.5 h-9 flex items-center gap-1.5 rounded-lg text-white lg:text-gray-700 hover:bg-indigo-600 lg:hover:bg-gray-100 text-[12px] font-medium"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Мастера
            </button>
            <button
              type="button"
              onClick={openNew}
              aria-label="Добавить бригаду"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-white lg:text-gray-700 hover:bg-indigo-600 lg:hover:bg-gray-100"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto bg-gray-50 relative">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 space-y-3 stagger-children">
          {teams.length === 0 && (
            <div className="text-center text-gray-400 py-10 text-sm">
              Нет бригад. Нажмите «+» чтобы создать.
            </div>
          )}

          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-1">
            Бригады
          </div>
          {teams.map((team) => {
            const { lead, helpers } = getTeamMembers(team, masters);
            return (
              <div
                key={team.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_2px_0_rgba(15,23,42,0.04),0_1px_3px_0_rgba(15,23,42,0.06)] p-4"
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
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {team.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {team.region || "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(team)}
                      aria-label="Редактировать"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(team)}
                      aria-label="Удалить"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                      </svg>
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
                      <div className="text-xs text-gray-700 whitespace-nowrap">
                        Бригадир:{" "}
                        <span className="font-medium text-gray-900">
                          {lead.full_name}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-gray-400">
                      Бригадир не назначен
                    </div>
                  )}
                </div>

                {/* Helpers row */}
                {helpers.length > 0 && (
                  <div className="mt-2 flex items-start gap-2">
                    <div className="text-xs text-gray-500 shrink-0 pt-0.5">
                      Помощники:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {helpers.map((h) => (
                        <span
                          key={h.id}
                          className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px] whitespace-nowrap"
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
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {team.active ? "Активна" : "Неактивна"}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Мастера section — inline access from the teams page.
              Tap any master to jump to /dashboard/masters for edit. */}
          <div className="pt-4 flex items-center justify-between px-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Мастера ({masters.length})
            </div>
            <button
              type="button"
              onClick={() => router.push("/dashboard/masters")}
              className="text-[11px] font-medium text-indigo-600 active:text-indigo-700"
            >
              Все мастера →
            </button>
          </div>

          {masters.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_2px_0_rgba(15,23,42,0.04),0_1px_3px_0_rgba(15,23,42,0.06)] p-4 text-center text-[12px] text-gray-400">
              Пока нет мастеров. Добавьте их на странице «Мастера».
            </div>
          )}

          {masters.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_2px_0_rgba(15,23,42,0.04),0_1px_3px_0_rgba(15,23,42,0.06)] overflow-hidden">
              {masters.map((m, i) => {
                const team = m.team_id
                  ? teams.find((t) => t.id === m.team_id) ?? null
                  : null;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      router.push(`/dashboard/masters?edit=${m.id}`)
                    }
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50 ${
                      i < masters.length - 1 ? "border-b border-gray-100" : ""
                    }`}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold shrink-0"
                      style={{ backgroundColor: team?.color ?? "#9ca3af" }}
                    >
                      {getInitials(m.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-gray-900 truncate">
                        {m.full_name || "Без имени"}
                      </div>
                      <div className="text-[11px] text-gray-500 truncate">
                        {ROLE_LABELS[m.role]}
                        {team ? ` · ${team.name}` : " · Без бригады"}
                      </div>
                    </div>
                    {!m.is_active && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        Неактивен
                      </span>
                    )}
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="text-gray-300 ml-1"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                );
              })}
            </div>
          )}

          {/* Unassigned hint if any */}
          {unassignedMasters.length > 0 && (
            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {unassignedMasters.length}{" "}
              {unassignedMasters.length === 1
                ? "мастер не привязан"
                : "мастера не привязаны"}{" "}
              к бригадам. Откройте бригаду и добавьте их в состав.
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
      className="fixed inset-0 z-40 bg-black/50 flex items-end lg:items-center justify-center"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-t-2xl lg:rounded-2xl p-4 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          {team ? "Редактировать бригаду" : "Новая бригада"}
        </h2>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Название</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Region */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Регион</label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Например: Пафос, Лимассол"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Default city */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Базовый город
            </label>
            <input
              type="text"
              value={defaultCity}
              onChange={(e) => setDefaultCity(e.target.value)}
              placeholder="Например: Пафос"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="text-[11px] text-gray-400 mt-1">
              Ставится дефолтом на каждый день в календаре. Можно переопределить
              тапом по дню.
            </div>
          </div>

          {/* Payout percentage */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Зарплата (% от чистого дохода)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                value={payoutPercentage}
                onChange={(e) => setPayoutPercentage(Number(e.target.value) || 0)}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 tabular-nums"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <div className="text-[11px] text-gray-400 mt-1">
              Применяется к (доход − расход бригады) за выбранный период.
              Используется на странице Финансы → Зарплата.
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Цвет</label>
            <div className="grid grid-cols-8 gap-2">
              {TEAM_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  aria-label={c.name}
                  className={`w-8 h-8 rounded-full transition-all ${
                    color === c.value
                      ? "ring-2 ring-indigo-600 ring-offset-2"
                      : ""
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>

          {/* Lead */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Бригадир (Лид)
            </label>
            <select
              value={leadId ?? ""}
              onChange={(e) => setLeadId(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            <label className="block text-xs text-gray-500 mb-2">Помощники</label>
            <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {availableHelpers.length === 0 && (
                <div className="text-xs text-gray-400 px-2 py-1">
                  Нет доступных мастеров
                </div>
              )}
              {availableHelpers.map((m) => {
                const checked = helperIds.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleHelper(m.id)}
                      className="w-4 h-4 accent-indigo-600"
                    />
                    <span className="text-sm text-gray-800">{m.full_name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Активна</span>
            <ToggleSwitch checked={active} onChange={setActive} />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toggle Switch ──────────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors ${
        checked ? "bg-indigo-600" : "bg-gray-300"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}
