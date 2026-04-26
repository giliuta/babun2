"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, User as UserIcon, CalendarClock } from "@babun/shared/icons";
import type { Client } from "@babun/shared/local/clients";
import type { Appointment } from "@babun/shared/local/appointments";
import { matchesClient } from "@babun/shared/local/selectors/client-search";

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  appointments: Appointment[];
}

// Spotlight-style global search. Searches clients (full_name, phone,
// extra phones, addresses, social handles, comment) AND appointments
// (comment, address). Sprint 020 F4 — replaces the absent "phone rang
// while I'm in chats, where do I look this up?" path.
//
// Triggered by long-press on the Календарь tab in BottomTabBar, or
// Cmd+K / Ctrl+K on desktop. Centered overlay; tap a result to jump.
//
// Result types:
//   * Client — routes to /dashboard/clients?id=X
//   * Appointment — routes to /dashboard with TODO open-by-id (out of
//     scope for v1; today we just navigate to the date in URL).
const MAX_RESULTS = 12;

export default function GlobalSearch({
  open,
  onClose,
  clients,
  appointments,
}: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const clientHits = useMemo(() => {
    if (!query.trim()) return [];
    return clients
      .filter((c) => matchesClient(c, query))
      .slice(0, MAX_RESULTS);
  }, [clients, query]);

  const aptHits = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return appointments
      .filter((a) => {
        const fields = [a.comment, a.address, a.address_note].filter(Boolean);
        return fields.some((f) => f.toLowerCase().includes(q));
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, MAX_RESULTS);
  }, [appointments, query]);

  const empty =
    query.trim().length > 0 &&
    clientHits.length === 0 &&
    aptHits.length === 0;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] bg-black/50 backdrop-blur-[2px] flex items-start justify-center pt-[10vh] px-3"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--surface-card)] rounded-[14px] shadow-[var(--shadow-sheet)] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "75vh" }}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--separator)]">
          <span className="text-[var(--label-tertiary)] shrink-0">
            <Search size={18} strokeWidth={2} />
          </span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Имя, телефон, адрес…"
            className="flex-1 h-10 text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none bg-transparent"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="shrink-0 w-8 h-8 flex items-center justify-center text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)] rounded-full transition"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!query.trim() && (
            <div className="px-5 py-10 text-center text-[12px] text-[var(--label-tertiary)]">
              Поиск по клиентам и записям. Введите имя, номер, адрес или
              фрагмент комментария.
            </div>
          )}

          {empty && (
            <div className="px-5 py-10 text-center text-[13px] text-[var(--label-secondary)]">
              Ничего не нашлось по «{query.trim()}»
            </div>
          )}

          {clientHits.length > 0 && (
            <div>
              <div className="px-4 pt-3 pb-1 text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
                Клиенты ({clientHits.length})
              </div>
              {clientHits.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push(`/dashboard/clients?id=${c.id}`);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-[var(--fill-quaternary)] min-h-[48px] transition"
                >
                  <span className="w-9 h-9 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
                    <UserIcon size={16} strokeWidth={2} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-medium text-[var(--label)] truncate">
                      {c.full_name}
                    </div>
                    {c.phone && (
                      <div className="text-[12px] text-[var(--label-secondary)] truncate tabular-nums">
                        {c.phone}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {aptHits.length > 0 && (
            <div>
              <div className="px-4 pt-3 pb-1 text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
                Записи ({aptHits.length})
              </div>
              {aptHits.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push(`/dashboard?date=${a.date}`);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-[var(--fill-quaternary)] min-h-[48px] transition"
                >
                  <span className="w-9 h-9 rounded-lg bg-[rgba(0,122,255,0.12)] text-[var(--system-blue)] flex items-center justify-center shrink-0">
                    <CalendarClock size={16} strokeWidth={2} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-medium text-[var(--label)] truncate">
                      {a.comment || a.address || "Запись"}
                    </div>
                    <div className="text-[12px] text-[var(--label-secondary)] tabular-nums">
                      {a.date} · {a.time_start}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
