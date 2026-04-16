"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useClients, useAppointments } from "@/app/dashboard/layout";
import { type Client, createBlankClient } from "@/lib/clients";
import { getPaidAmount } from "@/lib/appointments";
import { getAvatarColor, getInitials } from "@/lib/avatar-color";
import { pluralizeAC } from "@/lib/pluralize";
import ClientPanel from "@/components/clients/ClientPanel";

const TAG_CHIPS = [
  { id: "tag-vip", label: "VIP", active: "bg-amber-100 text-amber-700" },
  { id: "tag-b2b", label: "B2B", active: "bg-blue-100 text-blue-700" },
  { id: "tag-regular", label: "Постоянный", active: "bg-purple-100 text-purple-700" },
  { id: "tag-new", label: "Новый", active: "bg-green-100 text-green-700" },
  { id: "tag-problem", label: "Проблемный", active: "bg-red-100 text-red-700" },
];

type SortKey = "recent" | "name" | "revenue" | "equipment";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Недавние",
  name: "Имя",
  revenue: "Доход",
  equipment: "A/C",
};

export default function ClientsPage() {
  const router = useRouter();
  const { clients, upsertClient, deleteClient, tags } = useClients();
  const { appointments } = useAppointments();
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("recent");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null);

  // Compute revenue per client
  const revenueMap = useMemo(() => {
    const map = new Map<string, { total: number; count: number; lastDate: string }>();
    for (const a of appointments) {
      if (!a.client_id || a.status !== "completed") continue;
      const prev = map.get(a.client_id) ?? { total: 0, count: 0, lastDate: "" };
      prev.total += getPaidAmount(a);
      prev.count++;
      if (a.date > prev.lastDate) prev.lastDate = a.date;
      map.set(a.client_id, prev);
    }
    return map;
  }, [appointments]);

  const filtered = useMemo(() => {
    let list = clients;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.full_name.toLowerCase().includes(q) || c.phone.includes(q)
      );
    }

    if (activeTags.length > 0) {
      list = list.filter((c) =>
        activeTags.every((t) => c.tag_ids.includes(t))
      );
    }

    // Sort
    list = [...list].sort((a, b) => {
      if (sort === "name") return a.full_name.localeCompare(b.full_name, "ru");
      if (sort === "revenue") {
        return (revenueMap.get(b.id)?.total ?? 0) - (revenueMap.get(a.id)?.total ?? 0);
      }
      if (sort === "equipment") return b.equipment.length - a.equipment.length;
      // "recent" — by last order date desc, then created_at
      const aDate = revenueMap.get(a.id)?.lastDate ?? a.created_at;
      const bDate = revenueMap.get(b.id)?.lastDate ?? b.created_at;
      return bDate.localeCompare(aDate);
    });

    return list;
  }, [clients, search, activeTags, sort, revenueMap]);

  const toggleTag = (tagId: string) => {
    setActiveTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const selectedClient = selectedId ? clients.find((c) => c.id === selectedId) ?? null : null;

  // ─── Selected client detail view ───
  if (selectedClient) {
    const phoneDigits = selectedClient.phone.replace(/\D/g, "");
    return (
      <>
        <PageHeader
          title={selectedClient.full_name}
          rightContent={
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setConfirmDelete(selectedClient)}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-white lg:text-gray-700 hover:bg-violet-500 lg:hover:bg-gray-100"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6" />
                </svg>
              </button>
            </div>
          }
        />

        {/* Blacklist banner — a blacklisted client should be visible the
            moment Dima opens the card, not 15 fields down on the profile. */}
        {selectedClient.blacklisted && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 flex items-center gap-2 text-rose-700 text-[13px] font-semibold">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
            Клиент в чёрном списке
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-white">
          <div className="max-w-3xl mx-auto" style={{ paddingBottom: "5.5rem" }}>
            <ClientPanel
              client={selectedClient}
              appointments={appointments}
              onUpdate={(updated) => upsertClient(updated)}
              onClose={() => setSelectedId(null)}
            />
          </div>
        </div>

        {/* Sticky action bar — always accessible regardless of active tab.
            Most common flows from a client record: call → SMS → book →
            open chat. Must never require scrolling. */}
        <div
          className="fixed left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 grid grid-cols-4 gap-1 lg:left-[240px]"
          style={{
            bottom: "var(--bottom-nav-height, 0px)",
            paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))",
            zIndex: 35,
          }}
        >
          <a
            href={phoneDigits ? `tel:${phoneDigits}` : undefined}
            onClick={(e) => { if (!phoneDigits) e.preventDefault(); }}
            className={`h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold ${
              phoneDigits ? "text-emerald-700 active:bg-emerald-50" : "text-gray-300"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" />
            </svg>
            Позвонить
          </a>
          <a
            href={phoneDigits ? `sms:${phoneDigits}` : undefined}
            onClick={(e) => { if (!phoneDigits) e.preventDefault(); }}
            className={`h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold ${
              phoneDigits ? "text-sky-700 active:bg-sky-50" : "text-gray-300"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            SMS
          </a>
          <button
            type="button"
            onClick={() => router.push(`/dashboard?new=1&client_id=${selectedClient.id}`)}
            className="h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold text-violet-700 active:bg-violet-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <line x1="12" y1="13" x2="12" y2="19" />
              <line x1="9" y1="16" x2="15" y2="16" />
            </svg>
            Записать
          </button>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/chats?client_id=${selectedClient.id}`)}
            className="h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold text-gray-700 active:bg-gray-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
            </svg>
            Чат
          </button>
        </div>

        {confirmDelete && (
          <ConfirmDialog
            title="Удалить клиента?"
            message={`${confirmDelete.full_name} будет удалён. Это нельзя отменить.`}
            onConfirm={() => { deleteClient(confirmDelete.id); setConfirmDelete(null); setSelectedId(null); }}
            onClose={() => setConfirmDelete(null)}
          />
        )}
      </>
    );
  }

  // ─── Create new client ───
  if (creating) {
    return <CreateClientPage onSave={(c) => { upsertClient(c); setCreating(false); setSelectedId(c.id); }} onBack={() => setCreating(false)} />;
  }

  // ─── Client list ───
  return (
    <>
      <PageHeader
        title={`Клиенты (${filtered.length})`}
        rightContent={
          <>
            <button
              type="button"
              onClick={() => {
                const order: SortKey[] = ["recent", "name", "revenue", "equipment"];
                const next = order[(order.indexOf(sort) + 1) % order.length];
                setSort(next);
              }}
              title={`Сортировка: ${SORT_LABELS[sort]}`}
              className="h-9 px-2.5 flex items-center gap-1 rounded-lg text-white lg:text-gray-700 hover:bg-violet-500 lg:hover:bg-gray-100 text-[12px] font-medium"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="15" y2="12" />
                <line x1="3" y1="18" x2="9" y2="18" />
              </svg>
              {SORT_LABELS[sort]}
            </button>
            <button type="button" onClick={() => setCreating(true)} className="w-9 h-9 flex items-center justify-center rounded-lg text-white lg:text-gray-700 hover:bg-violet-500 lg:hover:bg-gray-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 space-y-2 stagger-children">
          {/* Search */}
          <div className="relative">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени, телефону..."
              className="w-full h-11 pl-9 pr-3 rounded-xl bg-white border border-gray-200 text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Group filter — in-place row of chips, always visible.
              Tapping a chip toggles; selected chips use their brand colors.
              No more popover / hidden UI — Dima sees at a glance what's
              filtered. */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
            <button
              type="button"
              onClick={() => setActiveTags([])}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition ${
                activeTags.length === 0
                  ? "bg-violet-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600"
              }`}
            >
              Все
            </button>
            {TAG_CHIPS.map((t) => {
              const on = activeTags.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTag(t.id)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition ${
                    on ? t.active : "bg-white border border-gray-200 text-gray-600"
                  }`}
                >
                  {on && "✓ "}
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* List */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {filtered.map((client, i) => {
              const rev = revenueMap.get(client.id);
              const color = getAvatarColor(client.full_name);
              const phoneDigits = client.phone.replace(/\D/g, "");

              return (
                <div
                  key={client.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(client.id)}
                  className={`flex gap-3 px-4 py-3 active:bg-gray-50 cursor-pointer ${
                    i < filtered.length - 1 ? "border-b border-gray-100" : ""
                  }`}
                >
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0" style={{ backgroundColor: color }}>
                    {getInitials(client.full_name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[15px] font-semibold text-gray-900 truncate">
                        {client.full_name}
                      </span>
                      {rev?.lastDate && (
                        <span className="text-[11px] text-gray-400 flex-shrink-0">
                          {rev.lastDate.split("-").reverse().join(".")}
                        </span>
                      )}
                    </div>
                    {client.phone && (
                      <div className="text-[13px] text-gray-600 mt-0.5 truncate tabular-nums">
                        {client.phone}
                      </div>
                    )}
                    {((client.equipment.length > 0) || (rev && rev.total > 0) || client.balance < 0 || client.blacklisted) && (
                      <div className="flex items-center gap-2 flex-wrap text-[12px] mt-0.5">
                        {client.blacklisted && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-semibold text-[10px]">
                            Чёрный список
                          </span>
                        )}
                        {client.balance < 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold tabular-nums">
                            Долг €{Math.abs(client.balance)}
                          </span>
                        )}
                        {client.equipment.length > 0 && (
                          <span className="text-gray-500">{pluralizeAC(client.equipment.length)}</span>
                        )}
                        {rev && rev.total > 0 && (
                          <span className="text-emerald-600 font-medium tabular-nums">€{rev.total}</span>
                        )}
                      </div>
                    )}
                    {client.tag_ids.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {client.tag_ids.map((tid) => {
                          const chip = TAG_CHIPS.find((t) => t.id === tid);
                          return chip ? (
                            <span key={tid} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${chip.active}`}>{chip.label}</span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>

                  {phoneDigits && (
                    <a href={`tel:${phoneDigits}`} onClick={(e) => e.stopPropagation()} className="w-11 h-11 flex items-center justify-center text-emerald-600 active:bg-emerald-50 rounded-full flex-shrink-0 self-center">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                      </svg>
                    </a>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                </svg>
                <div className="text-[14px] font-medium text-gray-500">Клиенты не найдены</div>
                <button type="button" onClick={() => setCreating(true)} className="h-10 px-4 rounded-lg border border-violet-600 text-violet-600 text-[13px] font-semibold">
                  + Добавить клиента
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Create client page ─────────────────────────────────────────────

function CreateClientPage({ onSave, onBack }: { onSave: (c: Client) => void; onBack: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");

  const handleSave = () => {
    if (!name.trim()) return;
    const client = createBlankClient({
      full_name: name.trim(),
      phone: phone.trim(),
      comment: comment.trim(),
    });
    onSave(client);
  };

  return (
    <>
      <PageHeader title="Новый клиент" />
      <div className="flex-1 overflow-y-auto bg-white" style={{ paddingBottom: "7rem" }}>
        <div className="max-w-lg mx-auto p-4 space-y-4">
          <FormField label="Имя *" value={name} onChange={setName} autoFocus />
          <FormField label="Телефон" value={phone} onChange={setPhone} type="tel" />
          <div>
            <div className="text-[12px] font-medium text-gray-500 mb-1">Комментарий</div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Язык, предпочтения, особенности..."
              className="w-full px-3 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[15px] resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <p className="text-[12px] text-gray-400 pt-1">
            Адрес, кондиционеры и остальное добавите в первой записи — у
            одного клиента может быть несколько объектов, поэтому всё это
            живёт в заказе.
          </p>
        </div>
      </div>
      <div
        className="fixed left-0 right-0 bottom-0 z-[60] bg-white border-t border-gray-200 px-4 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 12px) + 12px)" }}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={!name.trim()}
          className="w-full h-12 rounded-xl bg-violet-600 text-white text-[15px] font-semibold active:scale-[0.98] disabled:opacity-50"
        >
          Создать клиента
        </button>
      </div>
    </>
  );
}

function FormField({ label, value, onChange, type = "text", autoFocus }: { label: string; value: string; onChange: (v: string) => void; type?: string; autoFocus?: boolean }) {
  return (
    <div>
      <div className="text-[12px] font-medium text-gray-500 mb-1">{label}</div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} className="w-full h-12 px-3 rounded-xl bg-gray-50 border border-gray-200 text-[15px] focus:outline-none focus:ring-2 focus:ring-violet-500" />
    </div>
  );
}
