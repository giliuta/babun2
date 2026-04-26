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
  Wind,
  MapPin,
  Wallet,
  X,
  Send,
  Plus,
  Pin,
  Clock,
  Eye,
  ChevronRight,
  ChevronLeft,
  Bell,
  Sparkles,
  Star,
} from "@babun/shared/icons";
import PageHeader from "@/components/layout/PageHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Button, Input } from "@/components/ui";
import SwipeableRow from "@/components/ui/SwipeableRow";
import ContextMenu, { type ContextMenuOption } from "@/components/ui/ContextMenu";
import { useClients, useAppointments } from "@/app/dashboard/layout";
import { type Client, type ClientTag, createBlankClient } from "@babun/shared/local/clients";
import { getAvatarColor, getInitials } from "@babun/shared/common/utils/avatar-color";
import { countWordRu } from "@babun/shared/common/utils/pluralize";
import ClientPanel from "@/components/clients/ClientPanel";
import { matchesClient } from "@babun/shared/local/selectors/client-search";
import { haptic } from "@/lib/haptics";
import {
  buildStatsMap,
  getClientDisplayState,
  isLongSilence,
  isLoyalClient,
  isNewClient,
  type ClientStats,
} from "@babun/shared/local/selectors/client-stats";
import ClientCardStats from "@/components/clients/ClientCardStats";
import ClientStatusBadges from "@/components/clients/ClientStatusBadges";
import ClientQuickActionsSheet from "@/components/clients/ClientQuickActionsSheet";

// v312 — tag chips are tenant-managed: read from useClients().tags.
// Settings UI for creating/editing/deleting tags lands in Phase 2.

type SortKey = "recent" | "name" | "revenue" | "equipment";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Недавние",
  name: "Имя",
  revenue: "Доход",
  equipment: "A/C",
};

type Segment =
  | "all"
  | "debt"
  | "birthday"
  | "blacklist"
  | "silent"
  | "new"
  | "loyal";

const SEGMENT_LABELS: Record<Segment, string> = {
  all: "Все",
  debt: "Должники",
  birthday: "ДР",
  blacklist: "ЧС",
  silent: "Давно не были",
  new: "Новые",
  loyal: "Постоянные",
};

// v329 — daysUntilBirthday moved into lib/client-stats.ts as part
// of the unified ClientStats roll-up (read via statsMap.get(id)
// .birthdayInDays).  Local copy removed.

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
  // v313 — long-press context menu + reminder picker
  const [ctxMenu, setCtxMenu] = useState<{
    client: Client;
    anchor: { x: number; y: number };
  } | null>(null);
  const [reminderFor, setReminderFor] = useState<Client | null>(null);
  const [singleConfirmDelete, setSingleConfirmDelete] = useState<Client | null>(null);
  // v333 — long-press on the green phone icon opens this contact-
  // channel picker (Звонок / WhatsApp / SMS / Telegram).
  const [quickActionsFor, setQuickActionsFor] = useState<Client | null>(null);
  // v314 — search hidden above the fold, reveals on pull-down
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Hide the search bar above the scroll fold on mount. User pulls
  // the list DOWN (overscroll up) to reveal it. iOS-Mail style.
  useEffect(() => {
    if (!scrollRef.current || !searchRef.current) return;
    if (search.trim()) return; // keep visible if typing
    scrollRef.current.scrollTop =
      searchRef.current.offsetHeight + 12;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // v329 — single source of truth for client roll-up stats.  Walks
  // appointments once, returns Map<clientId, ClientStats>; the page
  // reads visits / totalSpent / lastVisitDays / nextApt / debt /
  // ageDays / birthdayInDays in O(1).  Replaces the older
  // revenueMap and the inline daysUntilBirthday.
  const statsMap = useMemo(
    () => buildStatsMap(clients, appointments),
    [clients, appointments]
  );

  // ── Segment counts (auto-derived, not user tags) ─────────────────
  const segmentCounts = useMemo(() => {
    let debt = 0;
    let birthday = 0;
    let birthdayThisWeek = 0;
    let blacklist = 0;
    let silent = 0;
    let newClients = 0;
    let newThisMonth = 0;
    let loyal = 0;
    const monthIdx = new Date().getMonth();
    const yearIdx = new Date().getFullYear();
    for (const c of clients) {
      const s = statsMap.get(c.id);
      if ((s?.debt ?? 0) > 0 || c.balance < 0) debt += 1;
      const dd = s?.birthdayInDays ?? null;
      if (dd !== null && dd <= 14) birthday += 1;
      if (dd !== null && dd <= 7) birthdayThisWeek += 1;
      if (c.blacklisted) blacklist += 1;
      if (s && isLongSilence(s)) silent += 1;
      if (s && isNewClient(s)) newClients += 1;
      if (s && isLoyalClient(s)) loyal += 1;
      // Hero strip "новых в этом месяце" — created_at falls in
      // current calendar month.  Different from `isNewClient`
      // (last 30 d window).
      if (c.created_at) {
        const cd = new Date(c.created_at);
        if (
          !Number.isNaN(cd.getTime()) &&
          cd.getMonth() === monthIdx &&
          cd.getFullYear() === yearIdx
        ) {
          newThisMonth += 1;
        }
      }
    }
    return {
      all: clients.length,
      debt,
      birthday,
      birthdayThisWeek,
      blacklist,
      silent,
      new: newClients,
      newThisMonth,
      loyal,
    };
  }, [clients, statsMap]);

  const currentMonthRu = useMemo(
    () =>
      new Date()
        .toLocaleDateString("ru-RU", { month: "long" })
        .toLowerCase(),
    [],
  );

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
        const s = statsMap.get(c.id);
        return (s?.debt ?? 0) > 0 || c.balance < 0;
      });
    } else if (segment === "birthday") {
      list = list.filter((c) => {
        const dd = statsMap.get(c.id)?.birthdayInDays ?? null;
        return dd !== null && dd <= 14;
      });
    } else if (segment === "blacklist") {
      list = list.filter((c) => c.blacklisted);
    } else if (segment === "silent") {
      list = list.filter((c) => {
        const s = statsMap.get(c.id);
        return s ? isLongSilence(s) : false;
      });
    } else if (segment === "new") {
      list = list.filter((c) => {
        const s = statsMap.get(c.id);
        return s ? isNewClient(s) : false;
      });
    } else if (segment === "loyal") {
      list = list.filter((c) => {
        const s = statsMap.get(c.id);
        return s ? isLoyalClient(s) : false;
      });
    }

    // Sort — pinned clients always go first regardless of active sort.
    list = [...list].sort((a, b) => {
      const aPinned = a.pinned_at ? 1 : 0;
      const bPinned = b.pinned_at ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      if (aPinned && bPinned) {
        return (b.pinned_at ?? "").localeCompare(a.pinned_at ?? "");
      }
      if (sort === "name") return a.full_name.localeCompare(b.full_name, "ru");
      if (sort === "revenue") {
        return (
          (statsMap.get(b.id)?.totalSpent ?? 0) -
          (statsMap.get(a.id)?.totalSpent ?? 0)
        );
      }
      if (sort === "equipment") return acCount(b) - acCount(a);
      // "recent" — by last order date desc, then created_at
      const aDate = statsMap.get(a.id)?.lastVisitDate || a.created_at;
      const bDate = statsMap.get(b.id)?.lastVisitDate || b.created_at;
      return bDate.localeCompare(aDate);
    });

    return list;
  }, [clients, search, activeTags, segment, sort, statsMap]);

  const toggleTag = (tagId: string) => {
    setActiveTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const togglePin = (client: Client) => {
    haptic("tap");
    upsertClient({
      ...client,
      pinned_at: client.pinned_at ? null : new Date().toISOString(),
    });
  };

  const setReminder = (client: Client, iso: string | null) => {
    haptic("tap");
    upsertClient({ ...client, reminder_at: iso });
  };

  const selectedClient = selectedId ? clients.find((c) => c.id === selectedId) ?? null : null;

  // ─── Selected client detail view ───
  if (selectedClient) {
    const phoneDigits = selectedClient.phone.replace(/\D/g, "");
    return (
      <>
        <PageHeader
          title={selectedClient.full_name}
          leftContent={
            <button
              type="button"
              onClick={() => {
                haptic("light");
                setSelectedId(null);
              }}
              aria-label="Назад к клиентам"
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full text-[var(--accent)] active:bg-[var(--fill-tertiary)] press-scale"
            >
              <ChevronLeft size={24} strokeWidth={2.5} />
            </button>
          }
          rightContent={
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setConfirmDelete(selectedClient)}
                aria-label="Удалить клиента"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--system-red)] active:bg-[var(--fill-quaternary)] press-scale"
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
          leftContent={
            <button
              type="button"
              onClick={() => {
                haptic("light");
                setDraft(null);
              }}
              aria-label="Отмена"
              className="lg:hidden h-10 px-2 flex items-center text-[var(--accent)] text-[15px] font-medium active:opacity-70 press-scale"
            >
              Отмена
            </button>
          }
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
        showBack={false}
        onTitleClick={
          isSelecting ? undefined : () => {
            haptic("tap");
            setSortOpen(true);
          }
        }
        leftContent={
          <button
            type="button"
            onClick={() => {
              haptic("tap");
              if (isSelecting) {
                setIsSelecting(false);
                setSelectedIds(new Set());
              } else {
                setIsSelecting(true);
              }
            }}
            className="h-9 px-3 flex items-center rounded-full text-[var(--accent)] active:bg-[var(--accent-tint)] text-[14px] font-semibold transition"
          >
            {isSelecting ? "Готово" : "Править"}
          </button>
        }
        rightContent={
          isSelecting ? (
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
              className="h-9 px-3 flex items-center rounded-full text-[var(--accent)] active:bg-[var(--accent-tint)] text-[14px] font-semibold transition"
            >
              {selectedIds.size === filtered.length ? "Снять" : "Все"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                haptic("tap");
                // STORY-034 Group 4 — quick-create lives at its own
                // route now; the inline draft view is gone.
                router.push("/dashboard/clients/new");
              }}
              aria-label="Добавить клиента"
              className="w-9 h-9 flex items-center justify-center rounded-full text-[var(--accent)] active:bg-[var(--accent-tint)] transition"
            >
              <Plus size={20} strokeWidth={2.2} />
            </button>
          )
        }
      />

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]"
      >
        <div className="max-w-3xl mx-auto p-3 lg:p-4 space-y-3 stagger-children">
          {/* v334 — Hero strip with three at-a-glance stats.  Each
                  segment is a button that activates the matching
                  segment filter.  Numbers come from segmentCounts,
                  not hardcode. */}
          <div className="flex items-center justify-center gap-1.5 h-8 -mt-1 text-[12px] text-[var(--label-secondary)] tabular-nums">
            <button
              type="button"
              onClick={() => {
                haptic("tap");
                setSegment("all");
              }}
              className="active:opacity-60 truncate"
            >
              {segmentCounts.all}{" "}
              {countWordRu(segmentCounts.all, "клиент", "клиента", "клиентов")}
            </button>
            {segmentCounts.newThisMonth > 0 && (
              <>
                <span className="text-[var(--label-quaternary)]">·</span>
                <button
                  type="button"
                  onClick={() => {
                    haptic("tap");
                    setSegment("new");
                  }}
                  className="active:opacity-60 truncate"
                >
                  {segmentCounts.newThisMonth}{" "}
                  {countWordRu(
                    segmentCounts.newThisMonth,
                    "новый",
                    "новых",
                    "новых",
                  )}{" "}
                  в&nbsp;{currentMonthRu}
                </button>
              </>
            )}
            {segmentCounts.birthdayThisWeek > 0 && (
              <>
                <span className="text-[var(--label-quaternary)]">·</span>
                <button
                  type="button"
                  onClick={() => {
                    haptic("tap");
                    setSegment("birthday");
                  }}
                  className="active:opacity-60 truncate text-[var(--system-orange)]"
                >
                  {segmentCounts.birthdayThisWeek}{" "}
                  {countWordRu(
                    segmentCounts.birthdayThisWeek,
                    "ДР",
                    "ДР",
                    "ДР",
                  )}{" "}
                  на&nbsp;неделе
                </button>
              </>
            )}
          </div>

          {/* ── Search (hidden above the fold; pull list down to
                 reveal — iOS-Mail style) ────────────────────────── */}
          <div ref={searchRef} className="relative">
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
            {/* v331 — smart filters: silence / new / loyal.  Each one
                hides itself when the bucket is empty so the chip row
                stays compact for fresh tenants. */}
            {segmentCounts.silent > 0 && (
              <SegmentChip
                active={segment === "silent"}
                count={segmentCounts.silent}
                onClick={() => setSegment("silent")}
                tone="warn"
              >
                <Clock size={12} strokeWidth={2.5} />
                Давно не были
              </SegmentChip>
            )}
            {segmentCounts.new > 0 && (
              <SegmentChip
                active={segment === "new"}
                count={segmentCounts.new}
                onClick={() => setSegment("new")}
                tone="good"
              >
                <Sparkles size={12} strokeWidth={2.5} />
                Новые
              </SegmentChip>
            )}
            {segmentCounts.loyal > 0 && (
              <SegmentChip
                active={segment === "loyal"}
                count={segmentCounts.loyal}
                onClick={() => setSegment("loyal")}
                tone="good"
              >
                <Star size={12} strokeWidth={2.5} />
                Постоянные
              </SegmentChip>
            )}
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
              const stats = statsMap.get(client.id);
              const phoneDigits = client.phone.replace(/\D/g, "");
              const acTotal = acCount(client);
              const primary = (client.locations ?? []).find((l) => l.isPrimary)
                ?? (client.locations ?? [])[0]
                ?? null;
              const debt = (stats?.debt ?? 0) > 0
                ? stats!.debt
                : client.balance < 0
                  ? Math.abs(client.balance)
                  : 0;
              const isPicked = selectedIds.has(client.id);
              const isPinned = Boolean(client.pinned_at);

              // In selection mode swipe is disabled (multi-select takes
              // priority and users tap cards to toggle).
              const card = (
                <ClientCard
                  client={client}
                  tags={tags}
                  stats={stats}
                  acTotal={acTotal}
                  debt={debt}
                  primaryAddress={primary?.address ?? ""}
                  phoneDigits={phoneDigits}
                  selectionMode={isSelecting}
                  picked={isPicked}
                  pinned={isPinned}
                  reminderAt={client.reminder_at ?? null}
                  onPhoneLongPress={() => {
                    haptic("medium");
                    setQuickActionsFor(client);
                  }}
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
                  onLongPress={(anchor) => {
                    if (isSelecting) return;
                    haptic("tap");
                    setCtxMenu({ client, anchor });
                  }}
                />
              );

              if (isSelecting) {
                return <div key={client.id}>{card}</div>;
              }

              return (
                <div key={client.id} className="rounded-[14px] overflow-hidden">
                  <SwipeableRow
                    leftActions={[
                      {
                        label: isPinned ? "Открепить" : "Закрепить",
                        icon: <Pin size={18} strokeWidth={2.2} />,
                        color: "bg-[var(--accent)]",
                        onSelect: () => togglePin(client),
                      },
                    ]}
                    rightActions={[
                      {
                        label: "Записать",
                        icon: <CalendarPlus size={18} strokeWidth={2.2} />,
                        color: "bg-[var(--system-blue)]",
                        onSelect: () => {
                          haptic("tap");
                          router.push(
                            `/dashboard?new=1&client_id=${client.id}`,
                          );
                        },
                      },
                      {
                        label: "Напомнить",
                        icon: <Clock size={18} strokeWidth={2.2} />,
                        color: "bg-[var(--system-orange)]",
                        onSelect: () => setReminderFor(client),
                      },
                      {
                        label: "Удалить",
                        icon: <Trash2 size={18} strokeWidth={2.2} />,
                        color: "bg-[var(--system-red)]",
                        onSelect: () => setSingleConfirmDelete(client),
                      },
                    ]}
                  >
                    {card}
                  </SwipeableRow>
                </div>
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

      {/* FAB removed v313 — header «+» button is the canonical entry. */}

      {/* Long-press context menu — iOS-Recents style quick actions. */}
      {ctxMenu &&
        (() => {
          const c = ctxMenu.client;
          const phoneDigits = c.phone.replace(/\D/g, "");
          const isPinned = Boolean(c.pinned_at);
          const opts: ContextMenuOption[] = [];
          if (phoneDigits) {
            opts.push({
              label: "Сообщение",
              icon: <MessageSquare size={18} strokeWidth={2} />,
              onSelect: () => {
                window.location.href = `sms:${phoneDigits}`;
              },
            });
            opts.push({
              label: "Звонок",
              icon: <PhoneIcon size={18} strokeWidth={2} />,
              onSelect: () => {
                window.location.href = `tel:${phoneDigits}`;
              },
            });
          }
          opts.push({
            label: "Открыть карточку",
            icon: <Eye size={18} strokeWidth={2} />,
            onSelect: () => setSelectedId(c.id),
          });
          opts.push({
            label: isPinned ? "Открепить" : "Закрепить",
            icon: <Pin size={18} strokeWidth={2} />,
            onSelect: () => togglePin(c),
          });
          opts.push({
            label: "Напомнить",
            icon: <Clock size={18} strokeWidth={2} />,
            onSelect: () => setReminderFor(c),
          });
          opts.push({
            label: "Удалить",
            icon: <Trash2 size={18} strokeWidth={2} />,
            danger: true,
            onSelect: () => setSingleConfirmDelete(c),
          });
          return (
            <ContextMenu
              open
              anchor={ctxMenu.anchor}
              title={c.full_name || "Клиент"}
              options={opts}
              onClose={() => setCtxMenu(null)}
            />
          );
        })()}

      {/* Reminder picker — quick presets + clear */}
      {reminderFor && (
        <ReminderPicker
          client={reminderFor}
          onPick={(iso) => {
            setReminder(reminderFor, iso);
            setReminderFor(null);
          }}
          onClose={() => setReminderFor(null)}
        />
      )}

      {/* Single delete confirm (from swipe / context menu) */}
      {singleConfirmDelete && (() => {
        const linked = appointments.filter(
          (a) => a.client_id === singleConfirmDelete.id,
        );
        return (
          <ConfirmDialog
            title={`Удалить ${singleConfirmDelete.full_name}?`}
            message={
              linked.length === 0
                ? "Связанных записей нет — удаление безопасно."
                : `У клиента ${linked.length} ${countWordRu(linked.length, "запись", "записи", "записей")}. Записи останутся в базе без клиента.`
            }
            confirmLabel={linked.length === 0 ? "Удалить" : "Удалить и открепить"}
            onConfirm={() => {
              for (const apt of linked) {
                upsertAppointment({
                  ...apt,
                  client_id: null,
                  comment: apt.comment || singleConfirmDelete.full_name,
                  updated_at: new Date().toISOString(),
                });
              }
              deleteClient(singleConfirmDelete.id);
              setSingleConfirmDelete(null);
            }}
            onClose={() => setSingleConfirmDelete(null)}
          />
        );
      })()}

      {/* Bulk action bar — shown while selection mode is active.
          iOS-Recents inspired: «Выбрать всех» on the left, then SMS
          and Удалить (last is destructive red). */}
      {isSelecting && (
        <div
          className="fixed left-0 right-0 z-[45] bg-[var(--surface-card)] border-t border-[var(--separator)] grid grid-cols-3 gap-1 px-2 py-2 lg:left-[240px]"
          style={{
            bottom: "var(--bottom-nav-height, 0px)",
            paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))",
          }}
        >
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
            className="h-12 flex items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold text-[var(--accent)] active:bg-[var(--fill-quaternary)]"
          >
            <Check size={16} strokeWidth={2.2} />
            {selectedIds.size === filtered.length ? "Снять всех" : "Выбрать всех"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (selectedIds.size === 0) return;
              haptic("tap");
              setSmsBlastOpen(true);
            }}
            disabled={selectedIds.size === 0}
            className="h-12 flex items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold text-[var(--system-blue)] active:bg-[var(--fill-quaternary)] disabled:opacity-40"
          >
            <Send size={16} strokeWidth={2.2} />
            SMS · {selectedIds.size}
          </button>
          <button
            type="button"
            onClick={() => {
              if (selectedIds.size === 0) return;
              haptic("warning");
              setBulkConfirmDelete(true);
            }}
            disabled={selectedIds.size === 0}
            className="h-12 flex items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold text-[var(--system-red)] active:bg-[var(--fill-quaternary)] disabled:opacity-40"
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

      {/* v333 — long-press phone icon → contact channel picker */}
      {quickActionsFor && (
        <ClientQuickActionsSheet
          client={quickActionsFor}
          onClose={() => setQuickActionsFor(null)}
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
  tone?: "default" | "warn" | "bad" | "good";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeBg =
    tone === "bad"
      ? "bg-[var(--system-red)] text-white"
      : tone === "warn"
        ? "bg-[var(--system-orange)] text-white"
        : tone === "good"
          ? "bg-[var(--system-green)] text-white"
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
  stats,
  acTotal,
  debt,
  primaryAddress,
  phoneDigits,
  selectionMode,
  picked,
  pinned,
  reminderAt,
  onOpen,
  onLongPress,
  onPhoneLongPress,
}: {
  client: Client;
  tags: ClientTag[];
  stats: ClientStats | undefined;
  acTotal: number;
  debt: number;
  primaryAddress: string;
  phoneDigits: string;
  selectionMode: boolean;
  picked: boolean;
  pinned: boolean;
  reminderAt: string | null;
  onOpen: () => void;
  onLongPress: (anchor: { x: number; y: number }) => void;
  /** Fires when the green phone icon is held ≥500 ms.  Opens the
   *  channel picker (Звонок / WhatsApp / SMS / Telegram). */
  onPhoneLongPress: () => void;
}) {
  const color = getAvatarColor(client.full_name);
  const initials = getInitials(client.full_name || "?");
  // v330 — LTV pill replaces the old DD.MM.YYYY label.  Money is
  // more useful than "last visit date" at a glance — and the second
  // row carries the natural-language age now ("Был 3 дня назад").
  const ltv = Math.round(stats?.totalSpent ?? 0);
  const displayState = stats ? getClientDisplayState(stats) : null;
  // v332 — when there's a debt pill we bank one of the three icon
  // slots, so ClientStatusBadges renders at most 2 extra icons.
  const showDebtPill = debt > 0;
  const iconBudget = showDebtPill ? 2 : 3;

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
    const anchor = { x: e.clientX, y: e.clientY };
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      onLongPress(anchor);
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
            {pinned && (
              <span
                title="Закреплён"
                className="shrink-0 text-[var(--accent)]"
              >
                <Pin size={12} strokeWidth={2.5} />
              </span>
            )}
            <span className="text-[16px] font-semibold text-[var(--label)] truncate">
              {client.full_name || "Без имени"}
            </span>
            {showDebtPill && (
              <span
                title={`Долг €${debt}`}
                className="shrink-0 inline-flex items-center px-1.5 h-5 rounded-full bg-[rgba(255,59,48,0.12)] text-[var(--system-red)] text-[11px] font-bold tabular-nums"
              >
                €{debt}
              </span>
            )}
            <ClientStatusBadges
              client={client}
              stats={stats}
              budget={iconBudget}
            />
            {reminderAt && (
              <span
                title={`Напомнить ${formatReminderShort(reminderAt)}`}
                className="shrink-0 w-2 h-2 rounded-full bg-[var(--system-orange)]"
                aria-label="Активно напоминание"
              />
            )}
          </div>
          {ltv > 0 && (
            <span
              className="text-[11px] font-semibold text-[var(--label-secondary)] shrink-0 tabular-nums"
              title="Сумма всех визитов"
            >
              €{ltv.toLocaleString("ru-RU")}
            </span>
          )}
        </div>

        {/* v330 — phone + state line: «+357…  ·  Был 3 дня назад» */}
        {(client.phone || displayState) && (
          <div className="flex items-center gap-1.5 text-[12px] mt-0.5 truncate">
            {client.phone && (
              <span className="text-[var(--label-tertiary)] tabular-nums shrink-0">
                {client.phone}
              </span>
            )}
            {client.phone && displayState && (
              <span className="text-[var(--label-quaternary)] shrink-0">·</span>
            )}
            {displayState && <ClientCardStats display={displayState} />}
          </div>
        )}

        {primaryAddress && (
          <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 flex items-center gap-1 truncate">
            <MapPin size={11} strokeWidth={2} className="shrink-0" />
            <span className="truncate">{primaryAddress}</span>
          </div>
        )}

        {/* v332 — debt pill moved up next to the name; this strip
            now hosts non-urgent secondary chips only. */}
        {(acTotal > 0 || tagChips.length > 0) && (
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
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
        <PhoneActionButton
          phoneDigits={phoneDigits}
          onLongPress={onPhoneLongPress}
        />
      )}
    </div>
  );
}

// ─── Phone action button (tap = call, hold = channel picker) ───────

function PhoneActionButton({
  phoneDigits,
  onLongPress,
}: {
  phoneDigits: string;
  onLongPress: () => void;
}) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const start = (e: React.PointerEvent) => {
    e.stopPropagation();
    fired.current = false;
    timer.current = window.setTimeout(() => {
      fired.current = true;
      onLongPress();
    }, 500);
  };
  const cancel = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  return (
    <a
      href={`tel:${phoneDigits}`}
      onClick={(e) => {
        e.stopPropagation();
        if (fired.current) {
          // Long-press already fired — swallow the click so we
          // don't kick off a tel: navigation as well.
          e.preventDefault();
          fired.current = false;
        }
      }}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onPointerMove={(e) => {
        if (Math.abs(e.movementX) > 4 || Math.abs(e.movementY) > 4) cancel();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!fired.current) {
          fired.current = true;
          onLongPress();
        }
      }}
      aria-label="Позвонить · удержать для других каналов"
      className="w-10 h-10 flex items-center justify-center rounded-full bg-[rgba(52,199,89,0.12)] text-[var(--system-green)] active:bg-[rgba(52,199,89,0.24)] shrink-0 self-center select-none"
    >
      <PhoneIcon size={17} strokeWidth={2.2} />
    </a>
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

// ─── Reminder picker (iOS-Recents style presets) ────────────────────

function ReminderPicker({
  client,
  onPick,
  onClose,
}: {
  client: Client;
  onPick: (iso: string | null) => void;
  onClose: () => void;
}) {
  const [customMode, setCustomMode] = useState(false);
  const [customDate, setCustomDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [customTime, setCustomTime] = useState("09:00");

  const presets: { label: string; subtitle: string; date: () => Date }[] = [
    {
      label: "Через 1 час",
      subtitle: "",
      date: () => {
        const d = new Date();
        d.setHours(d.getHours() + 1);
        return d;
      },
    },
    {
      label: "Сегодня вечером",
      subtitle: "в 19:00",
      date: () => {
        const d = new Date();
        d.setHours(19, 0, 0, 0);
        if (d <= new Date()) d.setDate(d.getDate() + 1);
        return d;
      },
    },
    {
      label: "Завтра утром",
      subtitle: "в 09:00",
      date: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d;
      },
    },
  ];

  const submitCustom = () => {
    const [y, mo, da] = customDate.split("-").map(Number);
    const [h, mi] = customTime.split(":").map(Number);
    if (!y || !mo || !da) return;
    const d = new Date(y, mo - 1, da, h || 0, mi || 0, 0, 0);
    if (Number.isNaN(d.getTime())) return;
    onPick(d.toISOString());
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[380px] bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--separator)]">
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-[var(--label)] truncate">
              {customMode ? "Своё время" : `Напомнить про ${client.full_name || "клиента"}`}
            </div>
            <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 leading-snug">
              Babun пришлёт push-уведомление, когда наступит время
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (customMode) {
                setCustomMode(false);
              } else {
                onClose();
              }
            }}
            aria-label={customMode ? "Назад" : "Закрыть"}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {customMode ? (
          <div className="px-4 py-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--label-tertiary)]">
                  Дата
                </span>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="h-12 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none tabular-nums"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--label-tertiary)]">
                  Время
                </span>
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="h-12 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none tabular-nums"
                />
              </label>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-[var(--accent-tint)] text-[12px] text-[var(--accent)] font-semibold">
              <Bell size={12} strokeWidth={2.2} />
              Push-уведомление сработает в это время
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCustomMode(false)}
                className="h-11 px-4 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--label)] text-[14px] font-medium press-scale"
              >
                Назад
              </button>
              <button
                type="button"
                onClick={submitCustom}
                className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[14px] font-semibold press-scale"
              >
                Сохранить
              </button>
            </div>
          </div>
        ) : (
          <>
            {client.reminder_at && (
              <div className="px-4 py-2 bg-[var(--fill-tertiary)] text-[12px] text-[var(--label-secondary)] flex items-center gap-1.5">
                <Clock size={11} strokeWidth={2.2} />
                Сейчас: {formatReminderShort(client.reminder_at)}
              </div>
            )}
            <div className="divide-y divide-[var(--separator)]">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onPick(p.date().toISOString())}
                  className="w-full flex items-center gap-3 px-4 py-3 min-h-[52px] text-left active:bg-[var(--fill-quaternary)] transition"
                >
                  <span className="w-8 h-8 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
                    <Clock size={16} strokeWidth={2.2} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-[15px] font-medium text-[var(--label)]">
                      {p.label}
                    </span>
                    {p.subtitle && (
                      <span className="block text-[12px] text-[var(--label-tertiary)] mt-0.5">
                        {p.subtitle}
                      </span>
                    )}
                  </span>
                  <ChevronRight size={16} className="text-[var(--label-quaternary)] shrink-0" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCustomMode(true)}
                className="w-full flex items-center gap-3 px-4 py-3 min-h-[52px] text-left active:bg-[var(--fill-quaternary)] transition"
              >
                <span className="w-8 h-8 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
                  <CalendarPlus size={16} strokeWidth={2.2} />
                </span>
                <span className="flex-1">
                  <span className="block text-[15px] font-medium text-[var(--label)]">
                    Своё время и дата
                  </span>
                  <span className="block text-[12px] text-[var(--label-tertiary)] mt-0.5">
                    выбрать конкретный день и час
                  </span>
                </span>
                <ChevronRight size={16} className="text-[var(--label-quaternary)] shrink-0" />
              </button>
              {client.reminder_at && (
                <button
                  type="button"
                  onClick={() => onPick(null)}
                  className="w-full flex items-center gap-3 px-4 py-3 min-h-[52px] text-left active:bg-[rgba(255,59,48,0.08)] transition text-[var(--system-red)]"
                >
                  <span className="w-8 h-8 rounded-full bg-[rgba(255,59,48,0.1)] flex items-center justify-center shrink-0">
                    <X size={16} strokeWidth={2.5} />
                  </span>
                  <span className="flex-1 text-[15px] font-medium">
                    Снять напоминание
                  </span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatReminderShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();
  const time = d.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (sameDay) return `сегодня в ${time}`;
  if (isTomorrow) return `завтра в ${time}`;
  return `${d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} в ${time}`;
}
