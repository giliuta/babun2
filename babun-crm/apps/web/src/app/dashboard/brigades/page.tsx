"use client";

import { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/layout/PageHeader";
import {
  loadBrigades,
  saveBrigades,
  loadBrigadeMembers,
  saveBrigadeMembers,
  type Brigade,
  type BrigadeMember,
} from "@/lib/brigades";
import { useAppointments } from "@/app/dashboard/layout";
import { generateId } from "@/lib/masters";
import { formatEUR } from "@/lib/money";
import {
  WEEKDAY_KEYS,
  WEEKDAY_NAMES,
  HOUR_OPTIONS,
  type WeekdayKey,
} from "@/lib/schedule";

// ─── Brigade work hours ───────────────────────────────────────────────────────

interface BrigadeDayHours {
  isWorking: boolean;
  start: string;
  end: string;
}

type BrigadeWorkHours = Record<WeekdayKey, BrigadeDayHours>;

const DEFAULT_WORK_HOURS: BrigadeWorkHours = {
  mon: { isWorking: true,  start: "09:00", end: "18:00" },
  tue: { isWorking: true,  start: "09:00", end: "18:00" },
  wed: { isWorking: true,  start: "09:00", end: "18:00" },
  thu: { isWorking: true,  start: "09:00", end: "18:00" },
  fri: { isWorking: true,  start: "09:00", end: "18:00" },
  sat: { isWorking: true,  start: "09:00", end: "14:00" },
  sun: { isWorking: false, start: "09:00", end: "18:00" },
};

const WORK_HOURS_KEY = "babun2:brigade-work-hours";

function loadBrigadeWorkHours(): Record<string, BrigadeWorkHours> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(WORK_HOURS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveBrigadeWorkHours(map: Record<string, BrigadeWorkHours>): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(WORK_HOURS_KEY, JSON.stringify(map)); } catch { /**/ }
}

// ─── Color palette ────────────────────────────────────────────────────────────

const COLOR_OPTIONS = [
  "#6366F1", "#8B5CF6", "#EC4899", "#EF4444",
  "#F97316", "#EAB308", "#22C55E", "#14B8A6",
  "#3B82F6", "#64748B",
];

// ─── Edit / Create modal ──────────────────────────────────────────────────────

function BrigadeModal({
  brigade,
  members,
  workHours,
  onSave,
  onCancel,
  title,
}: {
  brigade: Brigade;
  members: BrigadeMember[];
  workHours: BrigadeWorkHours;
  onSave: (brigade: Brigade, members: BrigadeMember[], workHours: BrigadeWorkHours) => void;
  onCancel: () => void;
  title: string;
}) {
  const [name, setName] = useState(brigade.name);
  const [type, setType] = useState(brigade.type);
  const [color, setColor] = useState(brigade.color ?? "#6366F1");
  const [perJobCostEur, setPerJobCostEur] = useState(String(brigade.perJobCostCents / 100));
  const [isActive, setIsActive] = useState(brigade.isActive);
  const [draftMembers, setDraftMembers] = useState<BrigadeMember[]>(
    members.filter((m) => m.brigadeId === brigade.id)
  );
  const [draftHours, setDraftHours] = useState<BrigadeWorkHours>({ ...workHours });
  const [newMasterId, setNewMasterId] = useState("");
  const [tab, setTab] = useState<"main" | "hours">("main");

  const updateMember = (id: string, patch: Partial<BrigadeMember>) => {
    setDraftMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const removeMember = (id: string) => {
    setDraftMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const addMember = () => {
    if (!newMasterId.trim()) return;
    const member: BrigadeMember = {
      id: generateId("bm"),
      masterId: newMasterId.trim(),
      brigadeId: brigade.id,
      role: "helper",
      baseMonthlySalaryCents: 100_000,
      percentRate: 7,
      joinedAt: new Date().toISOString().slice(0, 10),
      leftAt: null,
    };
    setDraftMembers((prev) => [...prev, member]);
    setNewMasterId("");
  };

  const updateDay = (key: WeekdayKey, patch: Partial<BrigadeDayHours>) => {
    setDraftHours((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const submit = () => {
    const updated: Brigade = {
      ...brigade,
      name: name.trim() || brigade.name,
      type,
      color,
      perJobCostCents: Math.round(parseFloat(perJobCostEur || "0") * 100),
      isActive,
    };
    onSave(updated, draftMembers, draftHours);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end lg:items-center justify-center" onClick={onCancel}>
      <div
        className="bg-white rounded-t-2xl lg:rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900 flex-1">{title}</h2>
          <div
            className="w-5 h-5 rounded-full border-2 border-white shadow"
            style={{ backgroundColor: color }}
          />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-4">
          {(["main", "hours"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500"
              }`}
            >
              {t === "main" ? "Основное" : "Рабочие часы"}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {tab === "main" ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Название</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Тип</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as Brigade["type"])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="internal">Внутренняя (% от выручки)</option>
                  <option value="outsource">Аутсорс (фикс. за работу)</option>
                </select>
              </div>

              {type === "outsource" && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Стоимость за выезд (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={perJobCostEur}
                    onChange={(e) => setPerJobCostEur(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-500 mb-2">Цвет на календаре</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        color === c ? "border-gray-800 scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Активна</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  onClick={() => setIsActive((v) => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${isActive ? "bg-indigo-600" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isActive ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>

              {/* Members */}
              <div>
                <label className="block text-xs text-gray-500 mb-2">Участники</label>
                <div className="space-y-2">
                  {draftMembers.map((m) => (
                    <div key={m.id} className="bg-gray-50 rounded-lg p-2.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 text-[13px] font-medium text-gray-800">{m.masterId}</div>
                        <select
                          value={m.role}
                          onChange={(e) => updateMember(m.id, { role: e.target.value as BrigadeMember["role"] })}
                          className="text-[12px] border border-gray-300 rounded px-1.5 py-0.5 bg-white"
                        >
                          <option value="lead">Лид</option>
                          <option value="helper">Помощник</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeMember(m.id)}
                          className="text-rose-500 hover:bg-rose-50 rounded w-7 h-7 flex items-center justify-center"
                        >
                          ×
                        </button>
                      </div>
                      {type === "internal" && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-400">% от выручки</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={m.percentRate}
                              onChange={(e) => updateMember(m.id, { percentRate: Number(e.target.value) || 0 })}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400">Базовая ставка (€/мес)</label>
                            <input
                              type="number"
                              min="0"
                              value={m.baseMonthlySalaryCents / 100}
                              onChange={(e) => updateMember(m.id, { baseMonthlySalaryCents: Math.round(Number(e.target.value) * 100) })}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={newMasterId}
                    onChange={(e) => setNewMasterId(e.target.value)}
                    placeholder="ID мастера (напр. m-yura)"
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={addMember}
                    className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium"
                  >
                    + Добавить
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // ─── Working hours tab ─────────────────────────────────────
            <div className="space-y-2">
              {WEEKDAY_KEYS.map((key) => {
                const day = draftHours[key];
                return (
                  <div key={key} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                    <div className="w-7 text-[12px] font-semibold text-gray-600">{WEEKDAY_NAMES[key]}</div>
                    <button
                      type="button"
                      onClick={() => updateDay(key, { isWorking: !day.isWorking })}
                      className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${day.isWorking ? "bg-indigo-600" : "bg-gray-300"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${day.isWorking ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                    {day.isWorking ? (
                      <>
                        <select
                          value={day.start}
                          onChange={(e) => updateDay(key, { start: e.target.value })}
                          className="flex-1 text-[12px] border border-gray-300 rounded-lg px-1.5 py-1 bg-white"
                        >
                          {HOUR_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <span className="text-[11px] text-gray-400">—</span>
                        <select
                          value={day.end}
                          onChange={(e) => updateDay(key, { end: e.target.value })}
                          className="flex-1 text-[12px] border border-gray-300 rounded-lg px-1.5 py-1 bg-white"
                        >
                          {HOUR_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </>
                    ) : (
                      <span className="text-[12px] text-gray-400 ml-1">Выходной</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm">
            Отмена
          </button>
          <button type="button" onClick={submit} className="flex-1 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-semibold">
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Brigade Card ────────────────────────────────────────────────────────────

function BrigadeCard({
  brigade,
  members,
  onEdit,
  onDelete,
}: {
  brigade: Brigade;
  members: BrigadeMember[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const brigadeMembers = members.filter((m) => m.brigadeId === brigade.id && m.leftAt === null);
  const dotColor = brigade.color ?? "#6366F1";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ backgroundColor: dotColor }}
        >
          {brigade.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-semibold text-gray-900">{brigade.name}</div>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${brigade.type === "internal" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
              {brigade.type === "internal" ? "Внутр." : "Аутсорс"}
            </span>
          </div>
          {brigade.type === "outsource" && brigade.perJobCostCents > 0 && (
            <div className="text-[11px] text-gray-500 mt-0.5">
              {formatEUR(brigade.perJobCostCents)} за выезд
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${brigade.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {brigade.isActive ? "Активна" : "Неактивна"}
          </span>
          <button
            type="button"
            onClick={onEdit}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-rose-400 hover:bg-rose-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      </div>

      {brigadeMembers.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {brigadeMembers.map((m) => (
            <div key={m.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
              <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-[10px] font-bold">
                {m.role === "lead" ? "Л" : "П"}
              </div>
              <div className="flex-1 text-[12px] text-gray-800">{m.masterId}</div>
              {brigade.type === "internal" && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-violet-700 font-semibold">{m.percentRate}%</span>
                  <span className="text-[11px] text-gray-400">{formatEUR(m.baseMonthlySalaryCents)}/мес</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {brigadeMembers.length === 0 && (
        <div className="mt-2 text-[11px] text-gray-400">Нет участников</div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BrigadesPage() {
  const [brigades, setBrigades] = useState<Brigade[]>([]);
  const [members, setMembers] = useState<BrigadeMember[]>([]);
  const [workHoursMap, setWorkHoursMap] = useState<Record<string, BrigadeWorkHours>>({});
  const [editing, setEditing] = useState<Brigade | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteWarning, setDeleteWarning] = useState<{ brigade: Brigade; count: number } | null>(null);
  const { appointments } = useAppointments();

  const reload = useCallback(() => {
    setBrigades(loadBrigades());
    setMembers(loadBrigadeMembers());
    setWorkHoursMap(loadBrigadeWorkHours());
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleSave = (updatedBrigade: Brigade, updatedMembers: BrigadeMember[], updatedHours: BrigadeWorkHours) => {
    let allBrigades: Brigade[];
    if (brigades.some((b) => b.id === updatedBrigade.id)) {
      allBrigades = brigades.map((b) => (b.id === updatedBrigade.id ? updatedBrigade : b));
    } else {
      allBrigades = [...brigades, updatedBrigade];
    }
    saveBrigades(allBrigades);

    const otherMembers = members.filter((m) => m.brigadeId !== updatedBrigade.id);
    saveBrigadeMembers([...otherMembers, ...updatedMembers]);

    const nextMap = { ...workHoursMap, [updatedBrigade.id]: updatedHours };
    saveBrigadeWorkHours(nextMap);

    reload();
    setEditing(null);
    setCreating(false);
  };

  const handleDeleteRequest = (brigade: Brigade) => {
    const count = appointments.filter((a) => {
      const lead = members.find((m) => m.brigadeId === brigade.id && m.role === "lead");
      return lead && a.team_id && a.status !== "cancelled";
    }).length;
    if (count > 0) {
      setDeleteWarning({ brigade, count });
    } else {
      confirmDelete(brigade.id);
    }
  };

  const confirmDelete = (id: string) => {
    saveBrigades(brigades.filter((b) => b.id !== id));
    saveBrigadeMembers(members.filter((m) => m.brigadeId !== id));
    const nextMap = { ...workHoursMap };
    delete nextMap[id];
    saveBrigadeWorkHours(nextMap);
    reload();
    setDeleteWarning(null);
  };

  const newBrigadeTemplate: Brigade = {
    id: generateId("br"),
    name: "",
    type: "internal",
    leadMasterId: null,
    helperMasterIds: [],
    perJobCostCents: 0,
    isActive: true,
    color: COLOR_OPTIONS[0],
    createdAt: new Date().toISOString(),
  };

  return (
    <>
      <PageHeader
        title="Финансовые бригады"
        rightContent={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="text-white lg:text-indigo-600 text-sm font-semibold px-2"
          >
            + Добавить
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-[11px] text-blue-800">
            Финансовые бригады управляют выплатами и расходами. Для управления расписанием в календаре используйте «Расписание команд» в Настройках.
          </div>

          {brigades.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <div className="text-3xl mb-2">🏗</div>
              <div className="text-sm text-gray-500">Бригады ещё не загружены.</div>
              <div className="text-xs text-gray-400 mt-1">Перезагрузите страницу — сид-данные создадутся автоматически.</div>
            </div>
          ) : (
            brigades.map((b) => (
              <BrigadeCard
                key={b.id}
                brigade={b}
                members={members}
                onEdit={() => setEditing(b)}
                onDelete={() => handleDeleteRequest(b)}
              />
            ))
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <BrigadeModal
          title="Редактировать бригаду"
          brigade={editing}
          members={members}
          workHours={workHoursMap[editing.id] ?? DEFAULT_WORK_HOURS}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* Create modal */}
      {creating && (
        <BrigadeModal
          title="Новая бригада"
          brigade={newBrigadeTemplate}
          members={[]}
          workHours={DEFAULT_WORK_HOURS}
          onSave={handleSave}
          onCancel={() => setCreating(false)}
        />
      )}

      {/* Delete warning */}
      {deleteWarning && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full">
            <div className="text-sm font-semibold text-gray-900 mb-2">Удалить бригаду?</div>
            <div className="text-sm text-gray-600 mb-4">
              У бригады <span className="font-semibold">{deleteWarning.brigade.name}</span> есть{" "}
              <span className="font-semibold text-rose-600">{deleteWarning.count}</span> активных записей в календаре.
              Удаление не отменит их, но бригада исчезнет из фильтров.
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteWarning(null)}
                className="flex-1 border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => confirmDelete(deleteWarning.brigade.id)}
                className="flex-1 bg-rose-600 text-white rounded-lg px-4 py-2 text-sm font-semibold"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
