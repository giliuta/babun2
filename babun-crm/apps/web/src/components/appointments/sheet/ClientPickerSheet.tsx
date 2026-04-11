"use client";

import { useMemo, useState } from "react";
import type { Client } from "@/lib/clients";
import type { DraftClient } from "@/lib/draft-clients";
import { upsertDraftClient } from "@/lib/draft-clients";
import { generateId } from "@/lib/masters";
import BottomSheet from "./BottomSheet";

interface ClientPickerSheetProps {
  open: boolean;
  onClose: () => void;
  onSelect: (client: Client | DraftClient) => void;
  clients: Client[];
  draftClients: DraftClient[];
  // Used to sort: id of clients that appear in recent appointments
  recentClientIds?: string[];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-zа-я0-9]/gi, "");
}

export default function ClientPickerSheet({
  open,
  onClose,
  onSelect,
  clients,
  draftClients,
  recentClientIds = [],
}: ClientPickerSheetProps) {
  const [query, setQuery] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const all = useMemo<(Client | DraftClient)[]>(() => {
    const map = new Map<string, Client | DraftClient>();
    for (const c of clients) map.set(c.id, c);
    for (const d of draftClients) map.set(d.id, d);
    return Array.from(map.values());
  }, [clients, draftClients]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return all;
    return all.filter((c) => {
      const name = normalize(c.full_name);
      const phone = normalize(c.phone ?? "");
      return name.includes(q) || phone.includes(q);
    });
  }, [all, query]);

  const sorted = useMemo(() => {
    const recentSet = new Set(recentClientIds);
    const withRank = filtered.map((c) => ({
      c,
      recentIdx: recentClientIds.indexOf(c.id),
    }));
    return withRank.sort((a, b) => {
      const aRecent = recentSet.has(a.c.id);
      const bRecent = recentSet.has(b.c.id);
      if (aRecent && !bRecent) return -1;
      if (!aRecent && bRecent) return 1;
      if (aRecent && bRecent) return a.recentIdx - b.recentIdx;
      return a.c.full_name.localeCompare(b.c.full_name, "ru");
    });
  }, [filtered, recentClientIds]);

  const handleSelect = (c: Client | DraftClient) => {
    onSelect(c);
    onClose();
  };

  const handleCreateNew = () => {
    const name = newName.trim();
    if (!name) return;
    const draft: DraftClient = {
      id: generateId("draft"),
      full_name: name,
      phone: newPhone.trim(),
    };
    upsertDraftClient(draft);
    onSelect(draft);
    setNewName("");
    setNewPhone("");
    setShowNewForm(false);
    onClose();
  };

  const resetAndClose = () => {
    setShowNewForm(false);
    setNewName("");
    setNewPhone("");
    setQuery("");
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={resetAndClose} title="Выбрать клиента">
      <div className="p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени или телефону"
            className="w-full h-12 px-4 bg-gray-100 rounded-xl text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* New client button or inline form */}
        {!showNewForm ? (
          <button
            type="button"
            onClick={() => setShowNewForm(true)}
            className="w-full h-14 flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 rounded-xl font-semibold active:scale-[0.98] transition"
          >
            <span className="text-xl">+</span>
            <span>Новый клиент</span>
          </button>
        ) : (
          <div className="space-y-2 bg-indigo-50 rounded-xl p-3">
            <input
              type="text"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Имя клиента"
              className="w-full h-12 px-4 bg-white rounded-lg text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="+357 99 ..."
              className="w-full h-12 px-4 bg-white rounded-lg text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="flex-1 h-12 text-gray-700 font-medium"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleCreateNew}
                disabled={!newName.trim()}
                className="flex-1 h-12 bg-indigo-600 text-white rounded-lg font-semibold disabled:opacity-40"
              >
                Добавить
              </button>
            </div>
          </div>
        )}

        {/* Client list */}
        <div>
          {sorted.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              {query ? "Никого не нашли" : "Клиентов пока нет"}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {sorted.map(({ c }) => {
                const isRecent = recentClientIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelect(c)}
                    className="w-full flex items-center gap-3 py-3 active:bg-gray-50"
                  >
                    <div className="w-11 h-11 flex-shrink-0 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold">
                      {initials(c.full_name)}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-base font-medium text-gray-900 truncate">
                        {c.full_name}
                      </div>
                      {c.phone && (
                        <div className="text-sm text-gray-500 truncate">{c.phone}</div>
                      )}
                    </div>
                    {isRecent && (
                      <div className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                        недавний
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
