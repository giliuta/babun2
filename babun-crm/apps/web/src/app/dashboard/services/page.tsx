"use client";

import { useState, useMemo } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useServices, useTeams } from "@/app/dashboard/layout";
import type { Team } from "@/lib/masters";
import {
  createBlankService,
  getServiceMaterialCost,
  WEEKDAY_LABELS,
  type Service,
  type ServiceCategory,
  type ServiceMaterialCost,
  type Weekday,
} from "@/lib/services";
import { generateId } from "@/lib/masters";

const PALETTE = [
  "#3b82f6",
  "#8b5cf6",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#14b8a6",
  "#6366f1",
  "#06b6d4",
  "#eab308",
];

export default function ServicesPage() {
  const { services, upsertService, deleteService, categories, setCategories } = useServices();
  const { teams } = useTeams();
  const [editing, setEditing] = useState<Service | null>(null);
  const [showCategories, setShowCategories] = useState(false);

  const grouped = useMemo(() => {
    const groups = new Map<string, Service[]>();
    for (const s of services) {
      const key = s.category_id ?? "uncategorized";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    return Array.from(groups.entries());
  }, [services]);

  const categoryById = useMemo(() => {
    const m = new Map<string, ServiceCategory>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const handleNew = () => {
    setEditing(createBlankService({ category_id: categories[0]?.id ?? null }));
  };

  const handleSave = (svc: Service) => {
    upsertService(svc);
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("Удалить услугу?")) return;
    deleteService(id);
    setEditing(null);
  };

  return (
    <>
      <PageHeader
        title="Услуги"
        subtitle={`${services.length} услуг в ${categories.length} категориях`}
        rightContent={
          <button
            type="button"
            onClick={handleNew}
            className="px-3 py-1.5 bg-white text-indigo-700 lg:bg-indigo-600 lg:text-white rounded-lg text-sm font-semibold"
          >
            + Новая
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 pb-24 space-y-4">
          <button
            type="button"
            onClick={() => setShowCategories((x) => !x)}
            className="w-full bg-white rounded-lg border border-gray-200 px-4 py-3 text-sm text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-between"
          >
            <span>⚙️ Категории услуг ({categories.length})</span>
            <span className="text-gray-400">{showCategories ? "▲" : "▼"}</span>
          </button>

          {showCategories && (
            <CategoriesEditor
              categories={categories}
              onChange={setCategories}
            />
          )}

          {grouped.map(([catKey, svcList]) => {
            const cat = categoryById.get(catKey);
            return (
              <section key={catKey} className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_2px_0_rgba(15,23,42,0.04),0_1px_3px_0_rgba(15,23,42,0.06)] overflow-hidden">
                <div
                  className="px-4 py-2 text-sm font-semibold border-b border-gray-200 flex items-center gap-2"
                  style={{ backgroundColor: cat ? `${cat.color}15` : undefined }}
                >
                  {cat && (
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                  )}
                  <span className="text-gray-800">{cat?.name ?? "Без категории"}</span>
                  <span className="text-xs text-gray-400">({svcList.length})</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {svcList.map((s) => {
                    const matCost = getServiceMaterialCost(s);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setEditing(s)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                      >
                        <div
                          className="w-2 h-10 rounded-full shrink-0"
                          style={{ backgroundColor: s.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate flex items-center gap-2">
                            <span className="truncate">{s.name || "Без названия"}</span>
                            {!s.is_countable && (
                              <span className="text-[9px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-medium uppercase tracking-wide flex-shrink-0">
                                ×1
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 flex flex-wrap gap-2">
                            <span>{s.duration_minutes} мин/шт</span>
                            <span>•</span>
                            <span className="text-emerald-600 font-medium">{s.price}€/шт</span>
                            {s.bulk_threshold > 0 && s.bulk_price > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-violet-600 font-medium">
                                  от {s.bulk_threshold}шт → {s.bulk_price}€/шт
                                </span>
                              </>
                            )}
                            {s.cost_per_unit > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-rose-500">
                                  −{s.cost_per_unit}€/шт расход
                                </span>
                              </>
                            )}
                            {matCost > 0 && s.cost_per_unit === 0 && (
                              <>
                                <span>•</span>
                                <span className="text-rose-500">−{matCost}€ расход</span>
                              </>
                            )}
                          </div>
                          {s.brigade_ids.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {s.brigade_ids.map((bid) => {
                                const t = teams.find((tm) => tm.id === bid);
                                if (!t) return null;
                                return (
                                  <span
                                    key={bid}
                                    className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                    style={{
                                      background: `${t.color}22`,
                                      color: t.color,
                                    }}
                                  >
                                    {t.name}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          {s.available_weekdays.length > 0 && (
                            <div className="text-xs text-gray-400 mt-0.5">
                              {s.available_weekdays.map((d) => WEEKDAY_LABELS[d]).join(",")}
                            </div>
                          )}
                        </div>
                        {!s.is_active && (
                          <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                            скрыта
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {editing && (
        <ServiceEditorSheet
          service={editing}
          categories={categories}
          teams={teams}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}

function CategoriesEditor({
  categories,
  onChange,
}: {
  categories: ServiceCategory[];
  onChange: (next: ServiceCategory[]) => void;
}) {
  const [name, setName] = useState("");

  const handleAdd = () => {
    if (!name.trim()) return;
    onChange([
      ...categories,
      { id: generateId("cat"), name: name.trim(), color: PALETTE[categories.length % PALETTE.length] },
    ]);
    setName("");
  };

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_2px_0_rgba(15,23,42,0.04),0_1px_3px_0_rgba(15,23,42,0.06)] p-4 space-y-3">
      {categories.map((c, i) => (
        <div key={c.id} className="flex items-center gap-2">
          <input
            type="color"
            value={c.color}
            onChange={(e) => {
              const next = [...categories];
              next[i] = { ...c, color: e.target.value };
              onChange(next);
            }}
            className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
          />
          <input
            type="text"
            value={c.name}
            onChange={(e) => {
              const next = [...categories];
              next[i] = { ...c, name: e.target.value };
              onChange(next);
            }}
            className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900"
          />
          <button
            type="button"
            onClick={() => onChange(categories.filter((x) => x.id !== c.id))}
            className="w-8 h-8 text-red-500 hover:bg-red-50 rounded"
          >
            ×
          </button>
        </div>
      ))}
      <div className="flex gap-2 pt-2 border-t border-gray-100">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Новая категория..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!name.trim()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold disabled:bg-gray-300"
        >
          +
        </button>
      </div>
    </section>
  );
}

function ServiceEditorSheet({
  service,
  categories,
  teams,
  onClose,
  onSave,
  onDelete,
}: {
  service: Service;
  categories: ServiceCategory[];
  teams: Team[];
  onClose: () => void;
  onSave: (svc: Service) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Service>(service);

  const toggleWeekday = (day: Weekday) => {
    setDraft((d) => ({
      ...d,
      available_weekdays: d.available_weekdays.includes(day)
        ? d.available_weekdays.filter((x) => x !== day)
        : [...d.available_weekdays, day].sort() as Weekday[],
    }));
  };

  const addCost = () => {
    setDraft((d) => ({
      ...d,
      material_costs: [
        ...d.material_costs,
        { id: generateId("mc"), name: "", amount: 0 },
      ],
    }));
  };

  const updateCost = (id: string, patch: Partial<ServiceMaterialCost>) => {
    setDraft((d) => ({
      ...d,
      material_costs: d.material_costs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  };

  const removeCost = (id: string) => {
    setDraft((d) => ({
      ...d,
      material_costs: d.material_costs.filter((c) => c.id !== id),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40">
      <div className="w-full lg:max-w-lg bg-white rounded-t-2xl lg:rounded-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            {service.name ? "Редактировать услугу" : "Новая услуга"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-500 text-xl"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Название</label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Категория</label>
            <select
              value={draft.category_id ?? ""}
              onChange={(e) => setDraft({ ...draft, category_id: e.target.value || null })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
            >
              <option value="">— Без категории —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Длительность, мин</label>
              <input
                type="number"
                min={5}
                step={5}
                value={draft.duration_minutes}
                onChange={(e) => setDraft({ ...draft, duration_minutes: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Цена, €</label>
              <input
                type="number"
                min={0}
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
              />
            </div>
          </div>

          {/* MEGA-UPDATE — countable toggle */}
          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Количество регулируется
              </div>
              <div className="text-xs text-gray-500">
                Степпер [− N +] в записи. Выключите для ремонта / диагностики.
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                setDraft({ ...draft, is_countable: !draft.is_countable })
              }
              className={`w-11 h-6 rounded-full relative transition-colors ${
                draft.is_countable ? "bg-violet-600" : "bg-gray-300"
              }`}
              aria-pressed={draft.is_countable}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  draft.is_countable ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Bulk pricing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                От N штук (bulk)
              </label>
              <input
                type="number"
                min={0}
                value={draft.bulk_threshold}
                onChange={(e) =>
                  setDraft({ ...draft, bulk_threshold: Number(e.target.value) || 0 })
                }
                placeholder="0 = без bulk"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Цена bulk, €/шт
              </label>
              <input
                type="number"
                min={0}
                value={draft.bulk_price}
                onChange={(e) =>
                  setDraft({ ...draft, bulk_price: Number(e.target.value) || 0 })
                }
                placeholder="0 = без bulk"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
              />
            </div>
          </div>

          {/* Cost per unit */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Расход на штуку, € (химия, фреон…)
            </label>
            <input
              type="number"
              min={0}
              value={draft.cost_per_unit}
              onChange={(e) =>
                setDraft({ ...draft, cost_per_unit: Number(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
            />
          </div>

          {/* Brigades */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">
              Бригады, которые делают (пусто = все)
            </label>
            <div className="flex flex-wrap gap-2">
              {teams
                .filter((t) => t.active)
                .map((t) => {
                  const active = draft.brigade_ids.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? draft.brigade_ids.filter((x) => x !== t.id)
                          : [...draft.brigade_ids, t.id];
                        setDraft({ ...draft, brigade_ids: next });
                      }}
                      className="h-9 px-3 rounded-lg text-[13px] font-semibold border-2 transition"
                      style={{
                        borderColor: active ? t.color : "#e5e7eb",
                        background: active ? `${t.color}14` : "white",
                        color: active ? t.color : "#475569",
                      }}
                    >
                      {active && "✓ "}
                      {t.name}
                    </button>
                  );
                })}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Цвет на календаре</label>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDraft({ ...draft, color: c })}
                  className={`w-8 h-8 rounded-full border-2 ${
                    draft.color === c ? "border-gray-900 scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={draft.color}
                onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Доступность по дням недели (пусто = любой день)
            </label>
            <div className="flex gap-1">
              {([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((day) => {
                const on = draft.available_weekdays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWeekday(day)}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg border ${
                      on
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {WEEKDAY_LABELS[day]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={draft.online_enabled}
                onChange={(e) => setDraft({ ...draft, online_enabled: e.target.checked })}
                className="w-4 h-4"
              />
              Доступна для онлайн-записи
            </label>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                className="w-4 h-4"
              />
              Услуга активна (видна в записях)
            </label>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500">Материальные расходы на услугу</label>
              <button
                type="button"
                onClick={addCost}
                className="text-xs text-indigo-600 font-medium"
              >
                + Добавить
              </button>
            </div>
            {draft.material_costs.length === 0 && (
              <div className="text-xs text-gray-400">Нет привязанных расходов</div>
            )}
            <div className="space-y-2">
              {draft.material_costs.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={c.name}
                    onChange={(e) => updateCost(c.id, { name: e.target.value })}
                    placeholder="Материал"
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-900"
                  />
                  <input
                    type="number"
                    min={0}
                    value={c.amount}
                    onChange={(e) => updateCost(c.id, { amount: Number(e.target.value) || 0 })}
                    className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm text-right text-gray-900"
                  />
                  <span className="text-xs text-gray-500">€</span>
                  <button
                    type="button"
                    onClick={() => removeCost(c.id)}
                    className="w-7 h-7 text-red-500 hover:bg-red-50 rounded"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            {draft.material_costs.length > 0 && (
              <div className="text-xs text-right text-gray-600 mt-2">
                Итого расход: <span className="font-semibold text-red-600">
                  −{draft.material_costs.reduce((s, c) => s + c.amount, 0)}€
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 px-4 py-3 flex gap-2">
          {service.name && (
            <button
              type="button"
              onClick={() => onDelete(service.id)}
              className="px-4 py-2 text-red-600 text-sm font-medium hover:bg-red-50 rounded-lg"
            >
              Удалить
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            disabled={!draft.name.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 disabled:bg-gray-300"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
