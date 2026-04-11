"use client";

import { useMemo, useState } from "react";
import type { Client } from "@/lib/clients";
import type { DraftClient } from "@/lib/draft-clients";
import { upsertDraftClient } from "@/lib/draft-clients";
import { generateId } from "@/lib/masters";
import DialogModal from "./DialogModal";

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
  const [newTelegram, setNewTelegram] = useState("");
  const [newInstagram, setNewInstagram] = useState("");
  const [newCity, setNewCity] = useState("");

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
      telegram_username: newTelegram.trim().replace(/^@+/, ""),
      instagram_username: newInstagram.trim().replace(/^@+/, ""),
      city: newCity.trim(),
    };
    upsertDraftClient(draft);
    onSelect(draft);
    resetForm();
    setShowNewForm(false);
    onClose();
  };

  const resetForm = () => {
    setNewName("");
    setNewPhone("");
    setNewTelegram("");
    setNewInstagram("");
    setNewCity("");
  };

  const resetAndClose = () => {
    setShowNewForm(false);
    resetForm();
    setQuery("");
    onClose();
  };

  return (
    <DialogModal open={open} onClose={resetAndClose} title="Выбрать клиента">
      <div className="p-3 space-y-2">
        {/* Search */}
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени или телефону"
            className="w-full h-11 px-3 bg-gray-100 rounded-lg text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* New client button or inline form */}
        {!showNewForm ? (
          <button
            type="button"
            onClick={() => {
              // Pre-fill: if the search looks like a phone, seed phone;
              // otherwise seed the name. Saves a couple of taps in the
              // common "couldn't find, add new" flow.
              const q = query.trim();
              if (/^[+\d\s()-]+$/.test(q) && q.replace(/\D/g, "").length >= 5) {
                setNewPhone(q);
              } else if (q) {
                setNewName(q);
              }
              setShowNewForm(true);
            }}
            className="w-full h-10 flex items-center justify-center gap-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-[13px] font-semibold active:scale-[0.98] transition"
          >
            <span className="text-[15px] leading-none">+</span>
            <span>Новый клиент{query.trim() ? ` «${query.trim()}»` : ""}</span>
          </button>
        ) : (
          <div className="space-y-2 bg-indigo-50 rounded-xl p-3">
            <input
              type="text"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Имя клиента"
              className="w-full h-11 px-3 bg-white rounded-lg text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex items-center gap-2 bg-white rounded-lg px-3 h-11">
              <span className="text-emerald-600 flex-shrink-0" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </span>
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+357 99 ..."
                className="flex-1 text-[14px] text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2 bg-white rounded-lg px-3 h-11">
              <span className="text-[#229ED9] flex-shrink-0" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9.417 15.181l-.397 5.584c.568 0 .814-.244 1.109-.537l2.663-2.545 5.518 4.041c1.012.564 1.725.267 1.998-.931L23.93 3.821l.001-.001c.321-1.496-.541-2.081-1.527-1.714L1.114 10.247c-1.462.568-1.44 1.384-.249 1.752l5.535 1.723 12.856-8.09c.605-.402 1.155-.179.703.223z" />
                </svg>
              </span>
              <input
                type="text"
                value={newTelegram}
                onChange={(e) => setNewTelegram(e.target.value)}
                placeholder="Telegram @username"
                className="flex-1 text-[14px] text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2 bg-white rounded-lg px-3 h-11">
              <span
                className="flex-shrink-0 text-white w-5 h-5 rounded flex items-center justify-center"
                style={{
                  background:
                    "radial-gradient(circle at 30% 110%, #ffd86b 0%, #fa8a3c 25%, #e6313b 50%, #c13584 75%, #833ab4 100%)",
                }}
                aria-hidden
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </span>
              <input
                type="text"
                value={newInstagram}
                onChange={(e) => setNewInstagram(e.target.value)}
                placeholder="Instagram @username"
                className="flex-1 text-[14px] text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none"
              />
            </div>
            <input
              type="text"
              value={newCity}
              onChange={(e) => setNewCity(e.target.value)}
              placeholder="Город (Пафос, Лимассол…)"
              className="w-full h-11 px-3 bg-white rounded-lg text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowNewForm(false);
                  resetForm();
                }}
                className="flex-1 h-11 text-gray-700 font-medium"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleCreateNew}
                disabled={!newName.trim()}
                className="flex-1 h-11 bg-indigo-600 text-white rounded-lg font-semibold disabled:opacity-40"
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
                    className="w-full flex items-center gap-2.5 py-2 active:bg-gray-50"
                  >
                    <div className="w-9 h-9 flex-shrink-0 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-[13px]">
                      {initials(c.full_name)}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-[13px] font-medium text-gray-900 truncate">
                        {c.full_name}
                      </div>
                      {c.phone && (
                        <div className="text-[11px] text-gray-500 truncate">{c.phone}</div>
                      )}
                    </div>
                    {isRecent && (
                      <div className="text-[9px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
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
    </DialogModal>
  );
}
