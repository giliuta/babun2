"use client";

import { useMemo, useState } from "react";
import type { Service, ServiceCategory } from "@/lib/services";
import BottomSheet from "./BottomSheet";

interface ServicePickerSheetProps {
  open: boolean;
  onClose: () => void;
  services: Service[];
  categories: ServiceCategory[];
  initialSelectedIds: string[];
  onConfirm: (selectedIds: string[]) => void;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-zа-я0-9]/gi, "");
}

export default function ServicePickerSheet({
  open,
  onClose,
  services,
  categories,
  initialSelectedIds,
  onConfirm,
}: ServicePickerSheetProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [query, setQuery] = useState("");

  // Re-seed selection whenever the sheet opens with fresh initial ids
  useMemo(() => {
    if (open) setSelectedIds(initialSelectedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filteredServices = useMemo(() => {
    const q = normalize(query);
    if (!q) return services;
    return services.filter((s) => normalize(s.name).includes(q));
  }, [services, query]);

  // Group by category, preserving category order
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

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const totalSum = useMemo(
    () =>
      selectedIds.reduce((sum, id) => {
        const s = services.find((x) => x.id === id);
        return sum + (s?.price ?? 0);
      }, 0),
    [selectedIds, services]
  );

  const totalDuration = useMemo(
    () =>
      selectedIds.reduce((sum, id) => {
        const s = services.find((x) => x.id === id);
        return sum + (s?.duration_minutes ?? 0);
      }, 0),
    [selectedIds, services]
  );

  const handleConfirm = () => {
    onConfirm(selectedIds);
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Услуги"
      footer={
        <button
          type="button"
          onClick={handleConfirm}
          disabled={selectedIds.length === 0}
          className="w-full h-14 bg-indigo-600 text-white rounded-xl font-semibold text-base active:scale-[0.98] transition disabled:opacity-40 flex items-center justify-between px-5"
        >
          <span>
            {selectedIds.length > 0
              ? `${selectedIds.length} ${selectedIds.length === 1 ? "услуга" : selectedIds.length < 5 ? "услуги" : "услуг"} · ${totalDuration} мин`
              : "Ничего не выбрано"}
          </span>
          <span>{totalSum > 0 ? `${totalSum}€` : "Готово"}</span>
        </button>
      }
    >
      <div className="p-4 space-y-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск услуги"
          className="w-full h-12 px-4 bg-gray-100 rounded-xl text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        {grouped.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            {query ? "Ничего не нашли" : "Услуг ещё нет"}
          </div>
        ) : (
          grouped.map(({ category, items }) => (
            <div key={category?.id ?? "none"} className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-1 pt-2">
                {category?.name ?? "Без категории"}
              </div>
              {items.map((s) => {
                const selected = selectedIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left active:scale-[0.99] transition ${
                      selected
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <div
                      className="w-2 h-11 rounded-full flex-shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-medium text-gray-900 truncate">
                        {s.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {s.duration_minutes} мин · {s.price}€
                      </div>
                    </div>
                    <div
                      className={`w-6 h-6 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${
                        selected
                          ? "bg-indigo-600 border-indigo-600"
                          : "border-gray-300"
                      }`}
                    >
                      {selected && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </BottomSheet>
  );
}
