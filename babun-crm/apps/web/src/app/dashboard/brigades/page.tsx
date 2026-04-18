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
import { generateId } from "@/lib/masters";
import { formatEUR } from "@/lib/money";

// ─── Edit Modal ──────────────────────────────────────────────────────────────

function BrigadeEditModal({
  brigade,
  members,
  onSave,
  onCancel,
}: {
  brigade: Brigade;
  members: BrigadeMember[];
  onSave: (brigade: Brigade, members: BrigadeMember[]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(brigade.name);
  const [type, setType] = useState(brigade.type);
  const [perJobCostEur, setPerJobCostEur] = useState(String(brigade.perJobCostCents / 100));
  const [isActive, setIsActive] = useState(brigade.isActive);
  const [draftMembers, setDraftMembers] = useState<BrigadeMember[]>(
    members.filter((m) => m.brigadeId === brigade.id)
  );
  const [newMasterId, setNewMasterId] = useState("");

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

  const submit = () => {
    const updated: Brigade = {
      ...brigade,
      name: name.trim() || brigade.name,
      type,
      perJobCostCents: Math.round(parseFloat(perJobCostEur || "0") * 100),
      isActive,
    };
    onSave(updated, draftMembers);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end lg:items-center justify-center" onClick={onCancel}>
      <div
        className="bg-white rounded-t-2xl lg:rounded-2xl p-4 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-900 mb-4">Редактировать бригаду</h2>

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
            <div className="text-[10px] text-gray-400 mt-1">
              Введите ID мастера из системы (из masters.ts). Это финансовая привязка, не влияет на календарь.
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
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
}: {
  brigade: Brigade;
  members: BrigadeMember[];
  onEdit: () => void;
}) {
  const brigadeMembers = members.filter((m) => m.brigadeId === brigade.id && m.leftAt === null);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {brigade.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
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
  const [editing, setEditing] = useState<Brigade | null>(null);

  const reload = useCallback(() => {
    setBrigades(loadBrigades());
    setMembers(loadBrigadeMembers());
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleSave = (updatedBrigade: Brigade, updatedMembers: BrigadeMember[]) => {
    const allBrigades = brigades.map((b) => (b.id === updatedBrigade.id ? updatedBrigade : b));
    saveBrigades(allBrigades);

    const otherMembers = members.filter((m) => m.brigadeId !== updatedBrigade.id);
    saveBrigadeMembers([...otherMembers, ...updatedMembers]);

    reload();
    setEditing(null);
  };

  return (
    <>
      <PageHeader
        title="Финансовые бригады"
        rightContent={
          <span className="text-[11px] text-white/70 lg:text-gray-400 px-2">
            {brigades.length} бригад
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-[11px] text-blue-800">
            Финансовые бригады управляют выплатами и расходами. Для управления составом команды в календаре используйте раздел «Бригады и мастера».
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
              />
            ))
          )}
        </div>
      </div>

      {editing && (
        <BrigadeEditModal
          brigade={editing}
          members={members}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}
    </>
  );
}
