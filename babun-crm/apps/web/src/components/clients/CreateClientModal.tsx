"use client";

import { useEffect, useMemo, useState } from "react";
import type { Client } from "@/lib/clients";
import { createBlankClient } from "@/lib/clients";
import { haptic } from "@/lib/haptics";

interface CreateClientModalProps {
  open: boolean;
  onClose: () => void;
  /** All existing clients for the "link existing" tab */
  clients: Client[];
  /** Pre-fill from the chat contact */
  prefillName?: string;
  prefillPhone?: string;
  prefillChannel?: string;
  /** Called when a new client is created */
  onCreate: (client: Client) => void;
  /** Called when linking to an existing client */
  onLink: (clientId: string) => void;
  /** Which tab to show first */
  initialTab?: "new" | "existing";
}

// Minimal quick-create modal. A client is just a person — name, phone,
// optional comment. Addresses, cities, property types and equipment all
// live on each appointment (a client may have multiple objects, and the
// dispatcher types those details in the record anyway).

export default function CreateClientModal({
  open,
  onClose,
  clients,
  prefillName = "",
  prefillPhone = "",
  onCreate,
  onLink,
  initialTab = "new",
}: CreateClientModalProps) {
  const [tab, setTab] = useState<"new" | "existing">(initialTab);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setName(prefillName);
      setPhone(prefillPhone);
      setNote("");
      setSearch("");
      setTab(initialTab);
    }
  }, [open, prefillName, prefillPhone, initialTab]);

  const searchResults = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = q
      ? clients.filter(
          (c) =>
            c.full_name.toLowerCase().includes(q) ||
            c.phone.includes(q)
        )
      : clients.slice().sort(
          (a, b) => b.created_at.localeCompare(a.created_at)
        );
    return list.slice(0, 20);
  }, [clients, search]);

  const handleCreate = () => {
    if (!name.trim()) return;
    haptic("success");
    const client = createBlankClient({
      full_name: name.trim(),
      phone: phone.trim(),
      comment: note.trim(),
    });
    onCreate(client);
    onClose();
  };

  const handleLink = (clientId: string) => {
    haptic("success");
    onLink(clientId);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-white lg:items-center lg:justify-center lg:bg-black/40">
      <div className="flex flex-col h-full lg:h-auto lg:max-h-[85vh] lg:w-[480px] lg:rounded-2xl lg:bg-white lg:shadow-2xl lg:overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-600 active:bg-gray-100"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h2 className="text-[17px] font-semibold text-gray-900">
            {tab === "new" ? "Новый клиент" : "Найти клиента"}
          </h2>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 flex p-2 gap-1 bg-gray-50">
          <TabBtn active={tab === "new"} onClick={() => setTab("new")}>Новый</TabBtn>
          <TabBtn active={tab === "existing"} onClick={() => setTab("existing")}>Существующий</TabBtn>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === "new" ? (
            <div className="p-4 space-y-4 pb-28">
              <Field label="Имя *" value={name} onChange={setName} placeholder="Имя клиента" autoFocus />
              <Field label="Телефон" value={phone} onChange={setPhone} placeholder="+357 99 ..." type="tel" />
              <div>
                <div className="text-[12px] font-medium text-gray-500 mb-1">Комментарий</div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Язык, предпочтения, особенности..."
                  rows={3}
                  className="w-full px-3 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[15px] text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <p className="text-[12px] text-gray-400">
                Адрес и оборудование привяжутся при создании записи — у
                клиента может быть несколько объектов.
              </p>
            </div>
          ) : (
            <div className="pb-20">
              {/* Search */}
              <div className="sticky top-0 bg-white px-4 py-3 border-b border-gray-100 z-10">
                <div className="relative">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Имя или телефон"
                    autoFocus
                    className="w-full h-12 pl-9 pr-3 rounded-xl bg-gray-50 border border-gray-200 text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              {/* Results */}
              <div>
                {searchResults.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 px-4 py-3 border-b border-gray-100"
                  >
                    <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-bold text-[13px] flex-shrink-0">
                      {c.full_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium text-gray-900 truncate">
                        {c.full_name}
                      </div>
                      {c.phone && (
                        <div className="text-[12px] text-gray-500 tabular-nums">{c.phone}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleLink(c.id)}
                      className="h-9 px-4 rounded-lg bg-violet-50 text-violet-600 text-[13px] font-semibold active:bg-violet-100 flex-shrink-0"
                    >
                      Привязать
                    </button>
                  </div>
                ))}
                {searchResults.length === 0 && (
                  <div className="text-center py-10">
                    <div className="text-[13px] text-gray-500">Клиентов не найдено</div>
                    <button
                      type="button"
                      onClick={() => setTab("new")}
                      className="mt-2 text-[13px] text-violet-600 font-semibold"
                    >
                      Создать нового →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sticky action button — new tab only */}
        {tab === "new" && (
          <div
            className="flex-shrink-0 px-4 pt-3 bg-white border-t border-gray-200"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 12px) + 12px)" }}
          >
            <button
              type="button"
              onClick={handleCreate}
              disabled={!name.trim()}
              className="w-full h-12 rounded-xl bg-violet-600 text-white text-[15px] font-semibold active:scale-[0.98] transition disabled:opacity-50 disabled:pointer-events-none"
            >
              Создать и привязать
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 h-11 rounded-lg text-[14px] font-semibold transition ${
        active ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", autoFocus,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; autoFocus?: boolean;
}) {
  return (
    <div>
      <div className="text-[12px] font-medium text-gray-500 mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full h-12 px-3 rounded-xl bg-gray-50 border border-gray-200 text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
    </div>
  );
}
