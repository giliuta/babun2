"use client";

import { useEffect, useMemo, useState } from "react";
import type { Service, ServiceCategory } from "@/lib/services";
import DialogModal from "./DialogModal";

interface ServicePickerSheetProps {
  open: boolean;
  onClose: () => void;
  services: Service[];
  categories: ServiceCategory[];
  // Incoming selection — duplicates encode quantity (e.g. [id, id] = x2).
  initialSelectedIds: string[];
  onConfirm: (selectedIds: string[]) => void;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-zа-я0-9]/gi, "");
}

// Convert string[] (with duplicates) into an id→quantity map.
function toQuantities(ids: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ids) {
    out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}

// Convert id→quantity map back to a flat string[] array, stable order.
function fromQuantities(
  qty: Record<string, number>,
  services: Service[]
): string[] {
  const out: string[] = [];
  for (const s of services) {
    const q = qty[s.id] ?? 0;
    for (let i = 0; i < q; i++) out.push(s.id);
  }
  return out;
}

export default function ServicePickerSheet({
  open,
  onClose,
  services,
  categories,
  initialSelectedIds,
  onConfirm,
}: ServicePickerSheetProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    toQuantities(initialSelectedIds)
  );
  const [query, setQuery] = useState("");

  // Re-seed when the sheet opens with a fresh appointment.
  useEffect(() => {
    if (open) {
      setQuantities(toQuantities(initialSelectedIds));
      setQuery("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filteredServices = useMemo(() => {
    const q = normalize(query);
    if (!q) return services;
    return services.filter((s) => normalize(s.name).includes(q));
  }, [services, query]);

  const grouped = useMemo(() => {
    const byCat = new Map<string | null, Service[]>();
    for (const s of filteredServices) {
      const key = s.category_id;
      const arr = byCat.get(key) ?? [];
      arr.push(s);
      byCat.set(key, arr);
    }
    const orderedGroups: { category: ServiceCategory | null; items: Service[] }[] = [];
    for (const cat of categories) {
      const items = byCat.get(cat.id);
      if (items && items.length > 0) orderedGroups.push({ category: cat, items });
    }
    const uncategorized = byCat.get(null);
    if (uncategorized && uncategorized.length > 0) {
      orderedGroups.push({ category: null, items: uncategorized });
    }
    return orderedGroups;
  }, [filteredServices, categories]);

  const setQty = (id: string, next: number) => {
    setQuantities((prev) => {
      const clamped = Math.max(0, next);
      if (clamped === 0) {
        const { [id]: _removed, ...rest } = prev;
        void _removed;
        return rest;
      }
      return { ...prev, [id]: clamped };
    });
  };

  const totals = useMemo(() => {
    let count = 0;
    let sum = 0;
    let duration = 0;
    for (const [id, qty] of Object.entries(quantities)) {
      const s = services.find((x) => x.id === id);
      if (!s) continue;
      count += qty;
      sum += s.price * qty;
      duration += s.duration_minutes * qty;
    }
    return { count, sum, duration };
  }, [quantities, services]);

  const handleConfirm = () => {
    onConfirm(fromQuantities(quantities, services));
    onClose();
  };

  const countWord = (n: number) =>
    n === 1 ? "услуга" : n < 5 ? "услуги" : "услуг";

  return (
    <DialogModal
      open={open}
      onClose={onClose}
      title="Услуги"
      footer={
        <button
          type="button"
          onClick={handleConfirm}
          disabled={totals.count === 0}
          className="w-full h-12 bg-indigo-600 text-white rounded-xl font-semibold text-[14px] active:scale-[0.98] transition disabled:opacity-40 flex items-center justify-between px-4"
        >
          <span>
            {totals.count > 0
              ? `${totals.count} ${countWord(totals.count)} · ${totals.duration} мин`
              : "Ничего не выбрано"}
          </span>
          <span>{totals.sum > 0 ? `${totals.sum}€` : "Готово"}</span>
        </button>
      }
    >
      <div className="p-3 space-y-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск услуги"
          className="w-full h-10 px-3 bg-gray-100 rounded-lg text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        {grouped.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            {query ? "Ничего не нашли" : "Услуг ещё нет"}
          </div>
        ) : (
          grouped.map(({ category, items }) => (
            <div key={category?.id ?? "none"} className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-0.5 pt-1.5">
                {category?.name ?? "Без категории"}
              </div>
              {items.map((s) => {
                const qty = quantities[s.id] ?? 0;
                const selected = qty > 0;
                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border-2 transition ${
                      selected
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <div
                      className="w-1 h-9 rounded-full flex-shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <button
                      type="button"
                      onClick={() => setQty(s.id, qty > 0 ? qty : 1)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="text-[13px] font-medium text-gray-900 truncate">
                        {s.name}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {s.duration_minutes} мин · {s.price}€
                      </div>
                    </button>
                    {selected ? (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setQty(s.id, qty - 1)}
                          className="w-7 h-7 rounded-full bg-white border border-gray-300 text-gray-700 flex items-center justify-center active:scale-95 text-[15px]"
                          aria-label="Уменьшить"
                        >
                          −
                        </button>
                        <div className="w-7 text-center text-[13px] font-semibold text-indigo-700 tabular-nums">
                          {qty}
                        </div>
                        <button
                          type="button"
                          onClick={() => setQty(s.id, qty + 1)}
                          className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center active:scale-95 text-[15px]"
                          aria-label="Увеличить"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setQty(s.id, 1)}
                        className="w-7 h-7 rounded-full border-2 border-gray-300 text-gray-400 flex items-center justify-center active:scale-95 flex-shrink-0 text-[14px]"
                        aria-label="Добавить"
                      >
                        +
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </DialogModal>
  );
}
