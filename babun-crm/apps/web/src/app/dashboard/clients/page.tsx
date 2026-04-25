"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2,
  Phone as PhoneIcon,
  MessageSquare,
  CalendarPlus,
  MessageCircle,
  Search,
  ArrowUpDown,
  Cake,
  Check,
  Users,
  Ban,
  PencilLine,
  Wind,
  MapPin,
  Wallet,
  X,
  Send,
  CheckSquare,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Button, Input } from "@/components/ui";
import { useClients, useAppointments } from "@/app/dashboard/layout";
import { type Client, type ClientTag, createBlankClient } from "@/lib/clients";
import { getPaidAmount } from "@/lib/appointments";
import { getAvatarColor, getInitials } from "@/lib/avatar-color";
import { countWordRu } from "@/lib/pluralize";
import ClientPanel from "@/components/clients/ClientPanel";
import { matchesClient } from "@/lib/client-search";
import { haptic } from "@/lib/haptics";

// v312 — tag chips are tenant-managed: read from useClients().tags.
// Settings UI for creating/editing/deleting tags lands in Phase 2.

type SortKey = "recent" | "name" | "revenue" | "equipment";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Недавние",
  name: "Имя",
  revenue: "Доход",
  equipment: "A/C",
};

type Segment = "all" | "debt" | "birthday" | "blacklist";

const SEGMENT_LABELS: Record<Segment, string> = {
  all: "Все",
  debt: "Должники",
  birthday: "ДР скоро",
  blacklist: "Чёрный список",
};

function daysUntilBirthday(iso: string): number | null {
  if (!iso) return null;
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d) return null;
  const now = new Date();
  const thisYear = new Date(now.getFullYear(), m - 1, d);
  thisYear.setHours(0, 0, 0, 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = thisYear;
  if (target < today) {
    target = new Date(now.getFullYear() + 1, m - 1, d);
  }
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export default function ClientsPage() {
  const router = useRouter();
  const { clients, upsertClient, deleteClient, tags } = useClients();
  const { appointments, upsertAppointment, deleteAppointment } = useAppointments();
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [segment, setSegment] = useState<Segment>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Client | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null);
  // v312 — multi-select mode + bulk actions
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmDelete, setBulkConfirmDelete] = useState(false);
  const [smsBlastOpen, setSmsBlastOpen] = useState(false);

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

  // ── Segment counts (auto-derived, not user tags) ─────────────────
  const segmentCounts = useMemo(() => {
    let debt = 0;
    let birthday = 0;
    let blacklist = 0;
    for (const c of clients) {
      const rev = revenueMap.get(c.id);
      if ((rev?.debt ?? 0) > 0 || c.balance < 0) debt += 1;
      const dd = daysUntilBirthday(c.birthday);
      if (dd !== null && dd <= 14) birthday += 1;
      if (c.blacklisted) blacklist += 1;
    }
    return { all: clients.length, debt, birthday, blacklist };
  }, [clients, revenueMap]);

  // Equipment count is now per-location. Aggregate across locations
  // so sort by «A/C» still works.
  const acCount = (c: Client): number =>
    (c.locations ?? []).reduce(
      (sum, loc) => sum + (loc.equipment ?? []).length,
      0,
    ) + c.equipment.length;

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

    // Auto-segment filter
    if (segment === "debt") {
      list = list.filter((c) => {
        const rev = revenueMap.get(c.id);
        return (rev?.debt ?? 0) > 0 || c.balance < 0;
      });
    } else if (segment === "birthday") {
      list = list.filter((c) => {
        const dd = daysUntilBirthday(c.birthday);
        return dd !== null && dd <= 14;
      });
    } else if (segment === "blacklist") {
      list = list.filter((c) => c.blacklisted);
    }

    // Sort
    list = [...list].sort((a, b) => {
      if (sort === "name") return a.full_name.localeCompare(b.full_name, "ru");
      if (sort === "revenue") {
        return (revenueMap.get(b.id)?.total ?? 0) - (revenueMap.get(a.id)?.total ?? 0);
      }
      if (sort === "equipment") return acCount(b) - acCount(a);
      // "recent" — by last order date desc, then created_at
      const aDate = revenueMap.get(a.id)?.lastDate ?? a.created_at;
      const bDate = revenueMap.get(b.id)?.lastDate ?? b.created_at;
      return bDate.localeCompare(aDate);
    });

    return list;
  }, [clients, search, activeTags, segment, sort, revenueMap]);

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
                className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--label-on-accent)] lg:text-[var(--label-secondary)] hover:bg-[var(--accent-pressed)] lg:hover:bg-[var(--fill-quaternary)]"
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
            className={`h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[12px] font-semibold ${
              phoneDigits ? "text-[var(--system-green)] active:bg-[var(--fill-quaternary)]" : "text-[var(--label-tertiary)]"
            }`}
          >
            <PhoneIcon size={18} strokeWidth={2.2} />
            Позвонить
          </a>
          <a
            href={phoneDigits ? `sms:${phoneDigits}` : undefined}
            onClick={(e) => { if (!phoneDigits) e.preventDefault(); }}
            className={`h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[12px] font-semibold ${
              phoneDigits ? "text-[var(--system-blue)] active:bg-[var(--fill-quaternary)]" : "text-[var(--label-tertiary)]"
            }`}
          >
            <MessageSquare size={18} strokeWidth={2.2} />
            SMS
          </a>
          <button
            type="button"
            onClick={() => router.push(`/dashboard?new=1&client_id=${selectedClient.id}`)}
            className="h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[12px] font-semibold text-[var(--accent)] active:bg-[var(--fill-quaternary)]"
          >
            <CalendarPlus size={18} strokeWidth={2.2} />
            Записать
          </button>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/chats?client_id=${selectedClient.id}`)}
            className="h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[12px] font-semibold text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
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

  // ─── Create new client ─── full ClientPanel-based draft view.
  if (draft) {
    const canSave =
      draft.full_name.trim().length > 0 && draft.phone.trim().length > 0;
    return (
      <>
        <PageHeader
          title="Новый клиент"
          rightContent={
            <button
              type="button"
              disabled={!canSave}
              onClick={() => {
                if (!canSave) return;
                haptic("tap");
                upsertClient(draft);
                setSelectedId(draft.id);
                setDraft(null);
              }}
              className={`h-9 px-3 rounded-full text-[14px] font-semibold transition ${
                canSave
                  ? "bg-[var(--accent)] text-[var(--label-on-accent)] active:bg-[var(--accent-pressed)]"
                  : "bg-[var(--fill-tertiary)] text-[var(--label-tertiary)] cursor-not-allowed"
              }`}
            >
              Создать
            </button>
          }
        />
        {!canSave && (
          <div className="bg-[rgba(255,149,0,0.1)] border-b border-[var(--separator)] px-4 py-2.5 flex items-center gap-2 text-[var(--system-orange)] text-[13px] font-semibold">
            Имя и телефон обязательны для сохранения
          </div>
        )}
        <div className="flex-1 overflow-y-auto bg-[var(--surface-card)]">
          <div
            className="max-w-3xl mx-auto"
            style={{ paddingBottom: "5.5rem" }}
          >
            <ClientPanel
              client={draft}
              appointments={[]}
              onUpdate={(updated) => setDraft(updated)}
              onClose={() => setDraft(null)}
            />
          </div>
        </div>
      </>
    );
  }

  // ─── Client list ───
  return (
    <>
      <PageHeader
        title={isSelecting ? `Выбрано ${selectedIds.size}` : "Клиенты"}
        rightContent={
          isSelecting ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  haptic("tap");
                  if (selectedIds.size === filtered.length) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectedIds(new Set(filtered.map((c) => c.id)));
                  }
                }}
                className="h-9 px-2.5 flex items-center gap-1 rounded-full text-[var(--accent)] active:bg-[var(--fill-quaternary)] text-[13px] font-semibold transition"
              >
                {selectedIds.size === filtered.length ? "Снять" : "Все"}
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic("tap");
                  setIsSelecting(false);
                  setSelectedIds(new Set());
                }}
                className="h-9 px-2.5 flex items-center gap-1 rounded-full text-[var(--label-on-accent)] lg:text-[var(--label-secondary)] active:bg-[var(--accent-pressed)] lg:active:bg-[var(--fill-quaternary)] text-[13px] font-semibold transition"
              >
                Готово
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => {
                  haptic("tap");
                  setIsSelecting(true);
                }}
                aria-label="Выбрать"
                className="w-9 h-9 flex items-center justify-center rounded-full text-[var(--label-on-accent)] lg:text-[var(--label-secondary)] active:bg-[var(--accent-pressed)] lg:active:bg-[var(--fill-quaternary)] transition"
              >
                <CheckSquare size={18} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic("tap");
                  setSortOpen(true);
                }}
                title={`Сортировка: ${SORT_LABELS[sort]}`}
                className="h-9 px-2.5 flex items-center gap-1 rounded-full text-[var(--label-on-accent)] lg:text-[var(--label-secondary)] active:bg-[var(--accent-pressed)] lg:active:bg-[var(--fill-quaternary)] text-[13px] font-medium transition"
              >
                <ArrowUpDown size={14} strokeWidth={2} />
                {SORT_LABELS[sort]}
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic("tap");
                  setDraft(createBlankClient());
                }}
                aria-label="Добавить клиента"
                className="w-9 h-9 flex items-center justify-center rounded-full text-[var(--label-on-accent)] lg:text-[var(--accent)] active:bg-[var(--accent-pressed)] lg:active:bg-[var(--accent-tint)] transition"
              >
                <PencilLine size={18} strokeWidth={2} />
              </button>
            </div>
          )
        }
      />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 space-y-3 stagger-children">
          {/* Stats banner removed v311 — будет переосмыслен позже,
              скорее всего как часть AI-инсайтов в /chats. На launch
              страница начинается с поиска. */}

          {/* ── Search ───────────────────────────────────────────── */}
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

          {/* ── Auto-segments + tag chips (one scroll row) ───────── */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5 -mx-1 px-1">
            <SegmentChip
              active={segment === "all"}
              count={segmentCounts.all}
              onClick={() => setSegment("all")}
            >
              Все
            </SegmentChip>
            <SegmentChip
              active={segment === "debt"}
              count={segmentCounts.debt}
              onClick={() => setSegment("debt")}
              tone="bad"
            >
              <Wallet size={12} strokeWidth={2.5} />
              Должники
            </SegmentChip>
            <SegmentChip
              active={segment === "birthday"}
              count={segmentCounts.birthday}
              onClick={() => setSegment("birthday")}
              tone="warn"
            >
              <Cake size={12} strokeWidth={2.5} />
              ДР
            </SegmentChip>
            <SegmentChip
              active={segment === "blacklist"}
              count={segmentCounts.blacklist}
              onClick={() => setSegment("blacklist")}
              tone="bad"
            >
              <Ban size={12} strokeWidth={2.5} />
              ЧС
            </SegmentChip>
            {tags.length > 0 && (
              <span className="self-center text-[var(--separator)] px-1">·</span>
            )}
            {tags.map((t) => (
              <TagChip
                key={t.id}
                tag={t}
                active={activeTags.includes(t.id)}
                onClick={() => toggleTag(t.id)}
              />
            ))}
          </div>

          {/* ── Client cards ─────────────────────────────────────── */}
          <div className="space-y-2">
            {filtered.map((client) => {
              const rev = revenueMap.get(client.id);
              const phoneDigits = client.phone.replace(/\D/g, "");
              const acTotal = acCount(client);
              const primary = (client.locations ?? []).find((l) => l.isPrimary)
                ?? (client.locations ?? [])[0]
                ?? null;
              const debt = (rev?.debt ?? 0) > 0
                ? rev!.debt
                : client.balance < 0
                  ? Math.abs(client.balance)
                  : 0;
              const dd = daysUntilBirthday(client.birthday);
              const isPicked = selectedIds.has(client.id);

              return (
                <ClientCard
                  key={client.id}
                  client={client}
                  tags={tags}
                  acTotal={acTotal}
                  debt={debt}
                  revenue={rev?.total ?? 0}
                  lastDate={rev?.lastDate ?? ""}
                  primaryAddress={primary?.address ?? ""}
                  birthdayInDays={dd}
                  phoneDigits={phoneDigits}
                  selectionMode={isSelecting}
                  picked={isPicked}
                  onOpen={() => {
                    if (isSelecting) {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(client.id)) next.delete(client.id);
                        else next.add(client.id);
                        return next;
                      });
                    } else {
                      setSelectedId(client.id);
                    }
                  }}
                  onLongPress={() => {
                    if (isSelecting) return;
                    haptic("tap");
                    setIsSelecting(true);
                    setSelectedIds(new Set([client.id]));
                  }}
                />
              );
            })}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-12 text-center bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)]">
                <Users size={40} strokeWidth={1.5} className="text-[var(--label-quaternary)]" />
                <div className="text-[14px] font-medium text-[var(--label-secondary)]">
                  По фильтру никого нет
                </div>
                <Button variant="tinted" size="sm" onClick={() => setDraft(createBlankClient())}>
                  + Добавить клиента
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sort picker — opens via header button. Centered modal. */}
      {sortOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-5"
          onClick={() => setSortOpen(false)}
        >
          <div
            className="w-full max-w-[300px] bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[var(--separator)] text-[15px] font-semibold text-[var(--label)]">
              Сортировать по
            </div>
            <div className="divide-y divide-[var(--separator)]">
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => {
                const active = sort === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      haptic("tap");
                      setSort(k);
                      setSortOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 min-h-[48px] active:bg-[var(--fill-quaternary)] transition ${
                      active ? "bg-[var(--accent-tint)]" : ""
                    }`}
                  >
                    <span className={`text-[15px] ${active ? "text-[var(--accent)] font-semibold" : "text-[var(--label)]"}`}>
                      {SORT_LABELS[k]}
                    </span>
                    {active && (
                      <Check size={16} strokeWidth={2.5} className="text-[var(--accent)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Telegram-style compose FAB — hidden in selection mode. */}
      {!isSelecting && (
        <button
          type="button"
          onClick={() => setDraft(createBlankClient())}
          aria-label="Добавить клиента"
          className="fixed right-5 z-[45] w-14 h-14 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] shadow-[var(--shadow-fab)] flex items-center justify-center active:bg-[var(--accent-pressed)] active:scale-[0.96] transition"
          style={{
            bottom:
              "calc(env(safe-area-inset-bottom, 12px) + 76px)",
          }}
        >
          <PencilLine size={22} strokeWidth={2} />
        </button>
      )}

      {/* Bulk action bar — shown while selection mode is active. */}
      {isSelecting && (
        <div
          className="fixed left-0 right-0 z-[45] bg-[var(--surface-card)] border-t border-[var(--separator)] grid grid-cols-2 gap-1 px-2 py-2 lg:left-[240px]"
          style={{
            bottom: "var(--bottom-nav-height, 0px)",
            paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))",
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (selectedIds.size === 0) return;
              haptic("tap");
              setSmsBlastOpen(true);
            }}
            disabled={selectedIds.size === 0}
            className="h-12 flex items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold text-[var(--system-blue)] active:bg-[var(--fill-quaternary)] disabled:opacity-40"
          >
            <Send size={16} strokeWidth={2.2} />
            SMS всем · {selectedIds.size}
          </button>
          <button
            type="button"
            onClick={() => {
              if (selectedIds.size === 0) return;
              haptic("warning");
              setBulkConfirmDelete(true);
            }}
            disabled={selectedIds.size === 0}
            className="h-12 flex items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold text-[var(--system-red)] active:bg-[var(--fill-quaternary)] disabled:opacity-40"
          >
            <Trash2 size={16} strokeWidth={2.2} />
            Удалить · {selectedIds.size}
          </button>
        </div>
      )}

      {/* Bulk delete confirm */}
      {bulkConfirmDelete && (() => {
        const targets = clients.filter((c) => selectedIds.has(c.id));
        const linkedCount = appointments.filter((a) =>
          a.client_id && selectedIds.has(a.client_id),
        ).length;
        return (
          <ConfirmDialog
            title={`Удалить ${targets.length} ${countWordRu(targets.length, "клиента", "клиентов", "клиентов")}?`}
            message={
              linkedCount === 0
                ? "Связанных записей нет — удаление безопасно."
                : `Связано ${linkedCount} ${countWordRu(linkedCount, "запись", "записи", "записей")}. Записи останутся в базе без клиента.`
            }
            confirmLabel={linkedCount === 0 ? "Удалить" : "Удалить и открепить"}
            onConfirm={() => {
              for (const apt of appointments) {
                if (apt.client_id && selectedIds.has(apt.client_id)) {
                  upsertAppointment({
                    ...apt,
                    client_id: null,
                    comment:
                      apt.comment ||
                      targets.find((t) => t.id === apt.client_id)?.full_name ||
                      "",
                    updated_at: new Date().toISOString(),
                  });
                }
              }
              for (const id of selectedIds) {
                deleteClient(id);
              }
              setBulkConfirmDelete(false);
              setIsSelecting(false);
              setSelectedIds(new Set());
            }}
            onClose={() => setBulkConfirmDelete(false)}
          />
        );
      })()}

      {/* Bulk SMS blast */}
      {smsBlastOpen && (
        <BulkSmsSheet
          recipients={clients.filter((c) => selectedIds.has(c.id))}
          onClose={() => setSmsBlastOpen(false)}
          onAfterSend={() => {
            setSmsBlastOpen(false);
            setIsSelecting(false);
            setSelectedIds(new Set());
          }}
        />
      )}
    </>
  );
}

// ─── Segment chip (auto-derived filter) ────────────────────────────

function SegmentChip({
  active,
  count,
  tone = "default",
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  tone?: "default" | "warn" | "bad";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeBg =
    tone === "bad"
      ? "bg-[var(--system-red)] text-white"
      : tone === "warn"
        ? "bg-[var(--system-orange)] text-white"
        : "bg-[var(--accent)] text-[var(--label-on-accent)]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 h-8 px-3 rounded-full text-[12px] font-semibold whitespace-nowrap transition shrink-0 ${
        active
          ? activeBg
          : "bg-[var(--surface-card)] border border-[var(--separator)] text-[var(--label)] active:bg-[var(--fill-quaternary)]"
      }`}
    >
      {children}
      <span
        className={`tabular-nums ${
          active ? "opacity-90" : "text-[var(--label-tertiary)]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

// ─── Client list card ──────────────────────────────────────────────

function ClientCard({
  client,
  tags,
  acTotal,
  debt,
  revenue,
  lastDate,
  primaryAddress,
  birthdayInDays,
  phoneDigits,
  selectionMode,
  picked,
  onOpen,
  onLongPress,
}: {
  client: Client;
  tags: ClientTag[];
  acTotal: number;
  debt: number;
  revenue: number;
  lastDate: string;
  primaryAddress: string;
  birthdayInDays: number | null;
  phoneDigits: string;
  selectionMode: boolean;
  picked: boolean;
  onOpen: () => void;
  onLongPress: () => void;
}) {
  const color = getAvatarColor(client.full_name);
  const initials = getInitials(client.full_name || "?");
  const lastDateLabel = lastDate
    ? lastDate.split("-").reverse().join(".")
    : null;
  const birthdaySoon =
    birthdayInDays !== null && birthdayInDays >= 0 && birthdayInDays <= 14;

  const tagChips = client.tag_ids
    .map((tid) => tags.find((t) => t.id === tid))
    .filter((t): t is ClientTag => Boolean(t));

  // Long-press detection — 500ms hold without movement.
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  const startPress = (e: React.PointerEvent) => {
    longPressFired.current = false;
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
    }
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      onLongPress();
    }, 500);
  };
  const cancelPress = () => {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  const handleClick = (e: React.MouseEvent) => {
    if (longPressFired.current) {
      e.preventDefault();
      e.stopPropagation();
      longPressFired.current = false;
      return;
    }
    onOpen();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      onPointerLeave={cancelPress}
      onPointerMove={(e) => {
        if (Math.abs(e.movementX) > 4 || Math.abs(e.movementY) > 4) {
          cancelPress();
        }
      }}
      className={`bg-[var(--surface-card)] rounded-[14px] shadow-[var(--shadow-card)] p-3 flex gap-3 active:scale-[0.995] active:bg-[var(--fill-quaternary)] transition cursor-pointer select-none ${
        picked
          ? "ring-2 ring-[var(--accent)]"
          : ""
      }`}
      style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
    >
      {selectionMode ? (
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition ${
            picked
              ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
              : "bg-[var(--fill-tertiary)] text-[var(--label-tertiary)] border-2 border-[var(--separator)]"
          }`}
        >
          {picked && <Check size={20} strokeWidth={3} />}
        </div>
      ) : (
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-[var(--label-on-accent)] font-bold text-[14px] shrink-0"
          style={{ backgroundColor: color }}
        >
          {initials}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[16px] font-semibold text-[var(--label)] truncate">
              {client.full_name || "Без имени"}
            </span>
            {client.blacklisted && (
              <span
                title="Чёрный список"
                className="shrink-0 w-5 h-5 rounded-full bg-[rgba(255,59,48,0.12)] text-[var(--system-red)] flex items-center justify-center"
              >
                <Ban size={11} strokeWidth={2.5} />
              </span>
            )}
            {birthdaySoon && (
              <span
                title={
                  birthdayInDays === 0 ? "Сегодня ДР!" : `Через ${birthdayInDays} дн.`
                }
                className="shrink-0 w-5 h-5 rounded-full bg-[rgba(255,149,0,0.12)] text-[var(--system-orange)] flex items-center justify-center"
              >
                <Cake size={11} strokeWidth={2.5} />
              </span>
            )}
          </div>
          {lastDateLabel && (
            <span className="text-[11px] text-[var(--label-tertiary)] shrink-0 tabular-nums">
              {lastDateLabel}
            </span>
          )}
        </div>

        {client.phone && (
          <div className="text-[12px] text-[var(--label-tertiary)] truncate tabular-nums mt-0.5">
            {client.phone}
          </div>
        )}

        {primaryAddress && (
          <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 flex items-center gap-1 truncate">
            <MapPin size={11} strokeWidth={2} className="shrink-0" />
            <span className="truncate">{primaryAddress}</span>
          </div>
        )}

        {(debt > 0 || revenue > 0 || acTotal > 0 || tagChips.length > 0) && (
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            {debt > 0 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 h-5 rounded-full bg-[rgba(255,59,48,0.12)] text-[var(--system-red)] text-[11px] font-bold tabular-nums">
                <Wallet size={10} strokeWidth={2.5} />
                €{debt}
              </span>
            )}
            {revenue > 0 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 h-5 rounded-full bg-[rgba(52,199,89,0.12)] text-[var(--system-green)] text-[11px] font-semibold tabular-nums">
                €{Math.round(revenue)}
              </span>
            )}
            {acTotal > 0 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 h-5 rounded-full bg-[var(--fill-tertiary)] text-[var(--label-secondary)] text-[11px] font-semibold tabular-nums">
                <Wind size={10} strokeWidth={2.5} />
                {acTotal}
              </span>
            )}
            {tagChips.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center px-1.5 h-5 rounded-full text-[11px] font-semibold"
                style={{
                  background: tagAlpha(tag.color, 0.14),
                  color: tag.color,
                }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {phoneDigits && !selectionMode && (
        <a
          href={`tel:${phoneDigits}`}
          onClick={(e) => e.stopPropagation()}
          aria-label="Позвонить"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-[rgba(52,199,89,0.12)] text-[var(--system-green)] active:bg-[rgba(52,199,89,0.24)] shrink-0 self-center"
        >
          <PhoneIcon size={17} strokeWidth={2.2} />
        </a>
      )}
    </div>
  );
}

// ─── Tag chip with dynamic color ────────────────────────────────────

function TagChip({
  tag,
  active,
  onClick,
}: {
  tag: ClientTag;
  active: boolean;
  onClick: () => void;
}) {
  const style = active
    ? {
        background: tagAlpha(tag.color, 0.14),
        color: tag.color,
        borderColor: tagAlpha(tag.color, 0.24),
      }
    : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={`inline-flex items-center gap-1 h-8 px-3 rounded-full text-[12px] font-semibold whitespace-nowrap transition shrink-0 border ${
        active
          ? ""
          : "bg-[var(--surface-card)] border-[var(--separator)] text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
      }`}
    >
      {active && <Check size={11} strokeWidth={2.5} />}
      {tag.name}
    </button>
  );
}

// Convert hex color (#RRGGBB) into rgba with given alpha for tag tints.
function tagAlpha(hex: string, alpha: number): string {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) return `rgba(124,124,128,${alpha})`;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Bulk SMS sheet ─────────────────────────────────────────────────

function BulkSmsSheet({
  recipients,
  onClose,
  onAfterSend,
}: {
  recipients: Client[];
  onClose: () => void;
  onAfterSend: () => void;
}) {
  const [text, setText] = useState("");

  const phones = recipients
    .map((c) => c.phone.replace(/\D/g, ""))
    .filter((p) => p.length > 0);

  const sendSms = () => {
    if (!text.trim() || phones.length === 0) return;
    haptic("tap");
    // iOS supports comma-separated numbers in sms: link with body=…
    const url = `sms:${phones.join(",")}?body=${encodeURIComponent(text.trim())}`;
    window.location.href = url;
    onAfterSend();
  };

  const copyPhones = async () => {
    try {
      await navigator.clipboard.writeText(phones.join("\n"));
      haptic("tap");
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-2"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] bg-[var(--surface-card)] rounded-t-[20px] sm:rounded-[20px] shadow-[var(--shadow-sheet)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--separator)]">
          <div>
            <div className="text-[15px] font-semibold text-[var(--label)]">
              SMS-рассылка
            </div>
            <div className="text-[12px] text-[var(--label-secondary)] mt-0.5">
              {phones.length} {countWordRu(phones.length, "номер", "номера", "номеров")}
              {phones.length < recipients.length && (
                <> · {recipients.length - phones.length} без телефона пропущены</>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
        <div className="p-3 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Текст сообщения…"
            rows={4}
            maxLength={500}
            className="w-full px-3 py-2 rounded-[10px] bg-[var(--fill-tertiary)] text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none resize-none leading-snug"
          />
          <div className="text-[11px] text-[var(--label-tertiary)] leading-snug">
            Откроется системное приложение SMS со всеми номерами и текстом —
            подтверди отправку там. Если нужно через WhatsApp, скопируй номера.
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={sendSms}
              disabled={!text.trim() || phones.length === 0}
              className="flex-1 h-11 rounded-[10px] bg-[var(--system-blue)] text-white text-[14px] font-semibold press-scale disabled:opacity-40"
            >
              Открыть SMS
            </button>
            <button
              type="button"
              onClick={copyPhones}
              disabled={phones.length === 0}
              className="h-11 px-4 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--label)] text-[14px] press-scale disabled:opacity-40"
            >
              Скопировать номера
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// CreateClientPage replaced v312 — new clients use the full ClientPanel
// view in draft mode with required name+phone validation.
