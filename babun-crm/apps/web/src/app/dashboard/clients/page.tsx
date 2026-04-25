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
  Cake,
  Check,
  Users,
  Ban,
  PencilLine,
  Wind,
  MapPin,
  Wallet,
  X,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Button, Input } from "@/components/ui";
import { useClients, useAppointments } from "@/app/dashboard/layout";
import { type Client, createBlankClient } from "@/lib/clients";
import { getPaidAmount } from "@/lib/appointments";
import { getAvatarColor, getInitials } from "@/lib/avatar-color";
import { countWordRu } from "@/lib/pluralize";
import ClientPanel from "@/components/clients/ClientPanel";
import { matchesClient } from "@/lib/client-search";
import { haptic } from "@/lib/haptics";

const TAG_CHIPS = [
  { id: "tag-vip", label: "VIP", active: "bg-[rgba(255,149,0,0.14)] text-[var(--system-orange)]" },
  { id: "tag-b2b", label: "B2B", active: "bg-[rgba(62,136,247,0.14)] text-[var(--system-blue)]" },
  { id: "tag-regular", label: "Постоянный", active: "bg-purple-100 text-purple-700" },
  { id: "tag-new", label: "Новый", active: "bg-[rgba(52,199,89,0.14)] text-[var(--system-green)]" },
  { id: "tag-problem", label: "Проблемный", active: "bg-[rgba(255,59,48,0.14)] text-[var(--system-red)]" },
];

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

  // ── Top-of-page stats banner ─────────────────────────────────────
  const statsSummary = useMemo(() => {
    let totalRevenue = 0;
    let totalDebt = 0;
    for (const v of revenueMap.values()) {
      totalRevenue += v.total;
      totalDebt += v.debt;
    }
    // Add legacy negative balances on top of derived debt for visibility.
    for (const c of clients) {
      if (c.balance < 0) totalDebt += Math.abs(c.balance);
    }
    return {
      total: clients.length,
      revenue: Math.round(totalRevenue),
      debt: Math.round(totalDebt),
      birthday: segmentCounts.birthday,
    };
  }, [clients, revenueMap, segmentCounts.birthday]);

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

  // ─── Create new client ───
  if (creating) {
    return <CreateClientPage onSave={(c) => { upsertClient(c); setCreating(false); setSelectedId(c.id); }} onBack={() => setCreating(false)} />;
  }

  // ─── Client list ───
  return (
    <>
      <PageHeader
        title="Клиенты"
        rightContent={
          <button
            type="button"
            onClick={() => {
              haptic("tap");
              setSortOpen(true);
            }}
            title={`Сортировка: ${SORT_LABELS[sort]}`}
            className="h-9 px-2.5 flex items-center gap-1 rounded-full text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)] text-[13px] font-medium transition"
          >
            <ArrowUpDown size={14} strokeWidth={2} />
            {SORT_LABELS[sort]}
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 space-y-3 stagger-children">
          {/* ── Stats banner ─────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-1.5">
            <StatTile
              label="Клиентов"
              value={String(statsSummary.total)}
              icon={<Users size={14} strokeWidth={2} />}
            />
            <StatTile
              label="Доход"
              value={
                statsSummary.revenue > 0
                  ? `€${statsSummary.revenue.toLocaleString("ru-RU")}`
                  : "—"
              }
              tone={statsSummary.revenue > 0 ? "good" : "default"}
              icon={<Wallet size={14} strokeWidth={2} />}
            />
            <StatTile
              label="Долг"
              value={
                statsSummary.debt > 0 ? `€${statsSummary.debt}` : "—"
              }
              tone={statsSummary.debt > 0 ? "bad" : "default"}
            />
            <StatTile
              label="ДР скоро"
              value={String(statsSummary.birthday)}
              tone={statsSummary.birthday > 0 ? "warn" : "default"}
              icon={<Cake size={14} strokeWidth={2} />}
            />
          </div>

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
            <span className="self-center text-[var(--separator)] px-1">·</span>
            {TAG_CHIPS.map((t) => {
              const on = activeTags.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTag(t.id)}
                  className={`inline-flex items-center gap-1 h-8 px-3 rounded-full text-[12px] font-semibold whitespace-nowrap transition shrink-0 ${
                    on
                      ? t.active
                      : "bg-[var(--surface-card)] border border-[var(--separator)] text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
                  }`}
                >
                  {on && <Check size={11} strokeWidth={2.5} />}
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Active filter readout — visible reset when something is on. */}
          {(activeTags.length > 0 || segment !== "all" || search.trim()) && (
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-[var(--label-secondary)]">
                {filtered.length} {countWordRu(filtered.length, "клиент", "клиента", "клиентов")} по фильтру
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveTags([]);
                  setSegment("all");
                  setSearch("");
                }}
                className="inline-flex items-center gap-1 h-7 px-2 rounded-full text-[var(--accent)] font-semibold active:bg-[var(--accent-tint)]"
              >
                <X size={12} strokeWidth={2.5} />
                Сбросить
              </button>
            </div>
          )}

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

              return (
                <ClientCard
                  key={client.id}
                  client={client}
                  acTotal={acTotal}
                  debt={debt}
                  revenue={rev?.total ?? 0}
                  lastDate={rev?.lastDate ?? ""}
                  primaryAddress={primary?.address ?? ""}
                  birthdayInDays={dd}
                  phoneDigits={phoneDigits}
                  onOpen={() => setSelectedId(client.id)}
                />
              );
            })}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-12 text-center bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)]">
                <Users size={40} strokeWidth={1.5} className="text-[var(--label-quaternary)]" />
                <div className="text-[14px] font-medium text-[var(--label-secondary)]">
                  По фильтру никого нет
                </div>
                <Button variant="tinted" size="sm" onClick={() => setCreating(true)}>
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

      {/* Telegram-style compose FAB — blue circle with a pencil, bottom
          right above the BottomTabBar. The de-facto Telegram "new chat"
          button, reused here for "new client". */}
      <button
        type="button"
        onClick={() => setCreating(true)}
        aria-label="Добавить клиента"
        className="fixed right-5 z-[45] w-14 h-14 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] shadow-[var(--shadow-fab)] flex items-center justify-center active:bg-[var(--accent-pressed)] active:scale-[0.96] transition"
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

// ─── Stats tile (top banner) ────────────────────────────────────────

function StatTile({
  label,
  value,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "bad" | "warn";
  icon?: React.ReactNode;
}) {
  const valueColor =
    tone === "good"
      ? "text-[var(--system-green)]"
      : tone === "bad"
        ? "text-[var(--system-red)]"
        : tone === "warn"
          ? "text-[var(--system-orange)]"
          : "text-[var(--label)]";
  return (
    <div className="rounded-[12px] bg-[var(--surface-card)] shadow-[var(--shadow-card)] px-2.5 py-2">
      <div className="flex items-center gap-1 text-[var(--label-tertiary)]">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-semibold">
          {label}
        </span>
      </div>
      <div className={`text-[15px] font-bold tabular-nums leading-tight mt-0.5 ${valueColor}`}>
        {value}
      </div>
    </div>
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
  acTotal,
  debt,
  revenue,
  lastDate,
  primaryAddress,
  birthdayInDays,
  phoneDigits,
  onOpen,
}: {
  client: Client;
  acTotal: number;
  debt: number;
  revenue: number;
  lastDate: string;
  primaryAddress: string;
  birthdayInDays: number | null;
  phoneDigits: string;
  onOpen: () => void;
}) {
  const color = getAvatarColor(client.full_name);
  const initials = getInitials(client.full_name || "?");
  const lastDateLabel = lastDate
    ? lastDate.split("-").reverse().join(".")
    : null;
  const birthdaySoon =
    birthdayInDays !== null && birthdayInDays >= 0 && birthdayInDays <= 14;

  const tagChips = client.tag_ids
    .map((tid) => TAG_CHIPS.find((t) => t.id === tid))
    .filter((t): t is (typeof TAG_CHIPS)[number] => Boolean(t));

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      className="bg-[var(--surface-card)] rounded-[14px] shadow-[var(--shadow-card)] p-3 flex gap-3 active:scale-[0.995] active:bg-[var(--fill-quaternary)] transition cursor-pointer"
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-[var(--label-on-accent)] font-bold text-[14px] shrink-0"
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>

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
            {tagChips.map((chip) => (
              <span
                key={chip.id}
                className={`inline-flex items-center px-1.5 h-5 rounded-full text-[11px] font-semibold ${chip.active}`}
              >
                {chip.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {phoneDigits && (
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
