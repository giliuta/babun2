"use client";

import { useState, useMemo } from "react";
import { MOCK_CLIENTS, type MockClient } from "@/lib/mock-data";
import ClientCard from "./ClientCard";

interface ClientsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ClientsDialog({ open, onClose }: ClientsDialogProps) {
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [selectedClient, setSelectedClient] = useState<MockClient | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return MOCK_CLIENTS;
    const q = search.toLowerCase();
    return MOCK_CLIENTS.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.phone.includes(q),
    );
  }, [search]);

  if (!open) return null;

  if (selectedClient) {
    return (
      <ClientCard
        client={selectedClient}
        onClose={() => setSelectedClient(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 text-white px-4 py-3 flex items-center gap-2">
          <h2 className="flex-1 text-base font-semibold">
            Все клиенты ({filtered.length})
          </h2>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-indigo-500"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-indigo-500">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="px-4 py-2 border-b border-gray-200">
            <input
              type="text"
              placeholder="Поиск по имени или телефону..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        {/* Client list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map((client) => (
            <button
              key={client.id}
              onClick={() => setSelectedClient(client)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-100 text-left"
            >
              <div className="w-10 h-10 rounded-full bg-amber-400 text-white flex items-center justify-center font-bold text-sm shrink-0">
                {client.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {client.full_name}
                </div>
                <div className="text-xs text-gray-500">{client.phone}</div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-gray-400 py-10 text-sm">
              Клиенты не найдены
            </div>
          )}
        </div>

        {/* Bottom */}
        <div className="px-4 py-3 border-t border-gray-200 flex items-center">
          <button
            onClick={onClose}
            className="flex-1 text-center text-sm text-gray-600 hover:text-gray-900"
          >
            Закрыть
          </button>
        </div>

        {/* FAB */}
        <button className="absolute bottom-20 right-8 w-12 h-12 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-indigo-700 transition-colors">
          +
        </button>
      </div>
    </div>
  );
}
