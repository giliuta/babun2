"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2,
  Phone as PhoneIcon,
  MessageSquare,
  CalendarPlus,
  MessageCircle,
  Search,
  ArrowUpDown,
  Check,
  Users,
  Ban,
  PencilLine,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Button, Chip, Input } from "@/components/ui";
import { useClients, useAppointments } from "@/app/dashboard/layout";
import { type Client, createBlankClient } from "@/lib/clients";
import { getPaidAmount } from "@/lib/appointments";
import { getAvatarColor, getInitials } from "@/lib/avatar-color";
import { pluralizeAC, countWordRu } from "@/lib/pluralize";
import ClientPanel from "@/components/clients/ClientPanel";
import { matchesClient } from "@/lib/client-search";

const TAG_CHIPS = [
  { id: "tag-vip", label: "VIP", active: "bg-[rgba(255,149,0,0.14)] text-[var(--system-orange)]" },
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
  const { appointments, upsertAppointment, deleteAppointment } = useAppointments();
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("recent");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null);

  // Deep link from chat: /dashboard/clients?id=<id> auto-opens a card.
  // Dima taps "Открыть карточку" in a chat and lands directly on the
  // full client detail view. URL is tidied up after consumption.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      setSelectedId((prev) => prev ?? id);
      window.history.replaceState({}, "", "/dashboard/clients");
    }
  }, []);

  // Compute revenue + debt per client in a single pass.
  // Debt = sum over completed appointments of `max(0, total − paid)`.
  // It's derived from the unified payment model; no ClientDebt table
  // yet.
  const revenueMap = useMemo(() => {
    const map = new Map<
      string,
      { total: number; count: number; lastDate: string; debt: number }
    >();
    for (const a of appointments) {
      if (!a.client_id || a.status !== "completed") continue;
      const prev = map.get(a.client_id) ?? { total: 0, count: 0, lastDate: "", debt: 0 };
      const paid = getPaidAmount(a);
      prev.total += paid;
      prev.debt += Math.max(0, a.total_amount - paid);
      prev.count++;
      if (a.date > prev.lastDate) prev.lastDate = a.date;
      map.set(a.client_id, prev);
    }
    return map;
  }, [appointments]);

  const filtered = useMemo(() => {
    let list = clients;

    if (search.trim()) {
      list = list.filter((c) => matchesClient(c, search));
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
                aria-label="Удалить клиента"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-white lg:text-[var(--label-secondary)] hover:bg-[var(--accent-pressed)] lg:hover:bg-[var(--fill-quaternary)]"
              >
                <Trash2 size={18} strokeWidth={2} />
              </button>
            </div>
          }
        />

        {/* Blacklist banner — a blacklisted client should be visible the
            moment Dima opens the card, not 15 fields down on the profile. */}
        {selectedClient.blacklisted && (
          <div className="bg-[rgba(255,59,48,0.1)] border-b border-[var(--separator)] px-4 py-2.5 flex items-center gap-2 text-[var(--system-red)] text-[13px] font-semibold">
            <Ban size={18} strokeWidth={2.2} />
            Клиент в чёрном списке
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-[var(--surface-card)]">
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
          className="fixed left-0 right-0 bg-[var(--surface-card)] border-t border-[var(--separator)] px-2 py-2 grid grid-cols-4 gap-1 lg:left-[240px]"
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
              phoneDigits ? "text-[var(--system-green)] active:bg-[var(--fill-quaternary)]" : "text-[var(--label-tertiary)]"
            }`}
          >
            <PhoneIcon size={18} strokeWidth={2.2} />
            Позвонить
          </a>
          <a
            href={phoneDigits ? `sms:${phoneDigits}` : undefined}
            onClick={(e) => { if (!phoneDigits) e.preventDefault(); }}
            className={`h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold ${
              phoneDigits ? "text-[var(--system-blue)] active:bg-[var(--fill-quaternary)]" : "text-[var(--label-tertiary)]"
            }`}
          >
            <MessageSquare size={18} strokeWidth={2.2} />
            SMS
          </a>
          <button
            type="button"
            onClick={() => router.push(`/dashboard?new=1&client_id=${selectedClient.id}`)}
            className="h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold text-[var(--accent)] active:bg-[var(--fill-quaternary)]"
          >
            <CalendarPlus size={18} strokeWidth={2.2} />
            Записать
          </button>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/chats?client_id=${selectedClient.id}`)}
            className="h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
          >
            <MessageCircle size={18} strokeWidth={2.2} />
            Чат
          </button>
        </div>

        {confirmDelete && (() => {
          // Sprint 024 STORY-003 / C2 — count linked appointments and
          // offer the dispatcher three explicit choices instead of the
          // earlier silent delete that orphaned records and broke
          // finance totals.
          const linked = appointments.filter(
            (a) => a.client_id === confirmDelete.id
          );
          const linkedCount = linked.length;
          return (
            <ConfirmDialog
              title={`Удалить ${confirmDelete.full_name}?`}
              message={
                linkedCount === 0
                  ? "Связанных записей нет — удаление безопасно."
                  : `У клиента ${linkedCount} ${countWordRu(linkedCount, "запись", "записи", "записей")}. При удалении мы открепим записи (история сохранится без имени клиента).`
              }
              confirmLabel={linkedCount === 0 ? "Удалить" : "Удалить и открепить"}
              onConfirm={() => {
                // Detach appointments first so finance/route totals stay intact.
                for (const apt of linked) {
                  upsertAppointment({
                    ...apt,
                    client_id: null,
                    comment: apt.comment || confirmDelete.full_name,
                    updated_at: new Date().toISOString(),
                  });
                }
                deleteClient(confirmDelete.id);
                setConfirmDelete(null);
                setSelectedId(null);
              }}
              onClose={() => setConfirmDelete(null)}
            />
          );
        })()}
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
              className="h-9 px-2.5 flex items-center gap-1 rounded-full text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)] text-[13px] font-medium transition"
            >
              <ArrowUpDown size={14} strokeWidth={2} />
              {SORT_LABELS[sort]}
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 space-y-2 stagger-children">
          {/* Search */}
          <div className="relative">
            <Search
              size={16}
              strokeWidth={2}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--label-tertiary)] pointer-events-none z-10"
            />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени, телефону..."
              className="pl-9"
            />
          </div>

          {/* Group filter — in-place row of chips, always visible.
              Tapping a chip toggles; selected chips use their brand colors.
              No more popover / hidden UI — Dima sees at a glance what's
              filtered. */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
            <Chip
              active={activeTags.length === 0}
              onClick={() => setActiveTags([])}
            >
              Все
            </Chip>
            {TAG_CHIPS.map((t) => {
              const on = activeTags.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTag(t.id)}
                  className={`inline-flex items-center gap-1 h-8 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition ${
                    on
                      ? t.active
                      : "bg-[var(--surface-card)] border border-[var(--separator)] text-[var(--label)] active:bg-[var(--fill-quaternary)]"
                  }`}
                >
                  {on && <Check size={12} strokeWidth={2.5} />}
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* List */}
          <div className="bg-[var(--surface-card)] rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
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
                  className={`flex gap-3 px-4 py-3 active:bg-[var(--fill-quaternary)] cursor-pointer ${
                    i < filtered.length - 1 ? "border-b border-[var(--separator)]" : ""
                  }`}
                >
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0" style={{ backgroundColor: color }}>
                    {getInitials(client.full_name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[17px] font-semibold text-[var(--label)] truncate">
                        {client.full_name}
                      </span>
                      {rev?.lastDate && (
                        <span className="text-[11px] text-[var(--label-tertiary)] flex-shrink-0 tabular-nums">
                          {rev.lastDate.split("-").reverse().join(".")}
                        </span>
                      )}
                    </div>
                    {client.phone && (
                      <div className="text-[12px] text-[var(--label-tertiary)] mt-0.5 truncate tabular-nums">
                        {client.phone}
                      </div>
                    )}
                    {((client.equipment.length > 0) || (rev && rev.total > 0) || client.balance < 0 || (rev && rev.debt > 0) || client.blacklisted) && (
                      <div className="flex items-center gap-2 flex-wrap text-[13px] mt-0.5">
                        {client.blacklisted && (
                          <span className="px-1.5 py-0.5 rounded bg-[rgba(255,59,48,0.12)] text-[var(--system-red)] font-semibold text-[10px]">
                            Чёрный список
                          </span>
                        )}
                        {/* Prefer the derived appointment-debt (explicit
                            unpaid visits) over the legacy balance field
                            when both disagree. Falling back to balance
                            keeps manual adjustments visible. */}
                        {rev && rev.debt > 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-[rgba(255,59,48,0.12)] text-[var(--system-red)] font-bold tabular-nums">
                            Должен €{rev.debt}
                          </span>
                        ) : client.balance < 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-[rgba(255,59,48,0.12)] text-[var(--system-red)] font-bold tabular-nums">
                            Долг €{Math.abs(client.balance)}
                          </span>
                        ) : null}
                        {client.equipment.length > 0 && (
                          <span className="text-[var(--label-secondary)]">{pluralizeAC(client.equipment.length)}</span>
                        )}
                        {rev && rev.total > 0 && (
                          <span className="text-[var(--system-green)] font-medium tabular-nums">€{rev.total}</span>
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
                    <a
                      href={`tel:${phoneDigits}`}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Позвонить"
                      className="w-11 h-11 flex items-center justify-center text-[var(--system-green)] active:bg-[var(--fill-quaternary)] rounded-full flex-shrink-0 self-center"
                    >
                      <PhoneIcon size={18} strokeWidth={2.2} />
                    </a>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Users size={40} strokeWidth={1.5} className="text-[var(--label-quaternary)]" />
                <div className="text-[14px] font-medium text-[var(--label-secondary)]">Клиенты не найдены</div>
                <Button variant="tinted" size="sm" onClick={() => setCreating(true)}>
                  + Добавить клиента
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Telegram-style compose FAB — blue circle with a pencil, bottom
          right above the BottomTabBar. The de-facto Telegram "new chat"
          button, reused here for "new client". */}
      <button
        type="button"
        onClick={() => setCreating(true)}
        aria-label="Добавить клиента"
        className="fixed right-5 z-[45] w-14 h-14 rounded-full bg-[var(--accent)] text-white shadow-[0_12px_28px_-12px_rgba(42,171,238,0.65)] flex items-center justify-center active:bg-[var(--accent-pressed)] active:scale-[0.96] transition"
        style={{
          bottom:
            "calc(env(safe-area-inset-bottom, 12px) + 76px)",
        }}
      >
        <PencilLine size={22} strokeWidth={2} />
      </button>
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
      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]" style={{ paddingBottom: "7rem" }}>
        <div className="max-w-lg mx-auto p-4 space-y-4">
          <Input
            label="Имя *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <Input
            label="Телефон"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
          />
          <div>
            <div className="text-[12px] font-medium text-[var(--label-secondary)] mb-1.5 tracking-wide">
              Комментарий
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Язык, предпочтения, особенности..."
              className="w-full px-3.5 py-3 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] resize-none focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
            />
          </div>
          <p className="text-[12px] text-[var(--label-tertiary)] pt-1 leading-snug">
            Адрес, кондиционеры и остальное добавите в первой записи — у
            одного клиента может быть несколько объектов, поэтому всё это
            живёт в заказе.
          </p>
        </div>
      </div>
      <div
        className="fixed left-0 right-0 bottom-0 z-[60] bg-[var(--surface-card)] border-t border-[var(--separator)] px-4 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 12px) + 12px)" }}
      >
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleSave}
          disabled={!name.trim()}
        >
          Создать клиента
        </Button>
      </div>
    </>
  );
}
