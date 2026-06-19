"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
// clients-99 F2.11 — virtualization when filtered list > VIRTUAL_THRESHOLD.
import { VirtualList, VIRTUAL_THRESHOLD } from "@/components/clients/VirtualList";
import { track } from "@/lib/analytics/track";
import { useToast } from "@/components/ui/Toast";
import { ReactivationWidget } from "@/components/clients/ReactivationWidget";
import {
  Trash2,
  Phone as PhoneIcon,
  MessageSquare,
  CalendarPlus,
  MessageCircle,
  Search,
  Check,
  Users,
  Ban,
  X,
  Send,
  Plus,
  Pin,
  Clock,
  Eye,
  ChevronRight,
  ChevronLeft,
  Bell,
  Settings,
} from "@babun/shared/icons";
import { exportClientsCsv } from "@/lib/csv/csv-export";
import PageHeader from "@/components/layout/PageHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Button, Input } from "@/components/ui";
import EmptyState from "@/components/ui/EmptyState";
import { CsvImportHint } from "@/components/onboarding/CsvImportHint";
import { TutorialOverlay } from "@/components/onboarding/TutorialOverlay";
import { useTutorialState } from "@/components/onboarding/useTutorialState";
import { useTenantQuota } from "@/lib/quota/useTenantQuota";
import { isUnlimited } from "@/components/settings/billing/types";
import QuotaBanner from "@/components/quota/QuotaBanner";
import SwipeableRow from "@/components/ui/SwipeableRow";
import ContextMenu, { type ContextMenuOption } from "@/components/ui/ContextMenu";
import { useClients, useAppointments, useTeams } from "@/components/layout/DashboardClientLayout";
import { type Client, type ClientTag } from "@babun/shared/local/clients";
// v809 — one summary bar + one centered «Фильтры» panel replace the
// old chip row + sort modal.
import { ClientsFilterBar } from "@/components/clients/filters/ClientsFilterBar";
import { ClientsFilterPanel } from "@/components/clients/filters/ClientsFilterPanel";
import {
  useClientFilters,
  type ClientFilterState,
} from "@/components/clients/filters/useClientFilters";
import type { ActiveToken, PeriodValue } from "@/components/clients/filters/types";
import { getAvatarColor, getInitials } from "@babun/shared/common/utils/avatar-color";
import { countWordRu } from "@babun/shared/common/utils/pluralize";
// v811 — gear → «Настройки клиентов» + live «Что показывать на карточке».
import { ClientsSettingsScreen } from "@/components/clients/ClientsSettingsScreen";
import { CardFieldsScreen } from "@/components/clients/CardFieldsScreen";
import {
  getCardFields,
  setCardFields,
  DEFAULT_CARD_FIELDS,
  type CardField,
  type CardFieldPrefs,
} from "@/lib/client-card-prefs";
// ClientPanel is the full client profile view (~1500 lines). Mobile
// renders it as a slide-up sheet on row tap; desktop renders it as a
// right-side panel only when a client is selected. Either way it's
// gated behind user interaction, so lazy-loading saves a big chunk
// from the initial /dashboard/clients parse.
const ClientPanel = dynamic(
  () => import("@/components/clients/ClientPanel"),
  { ssr: false },
);
import { haptic } from "@/lib/haptics";
import {
  buildStatsMap,
  isLongSilence,
  isLoyalClient,
  isNewClient,
  type ClientStats,
} from "@babun/shared/local/selectors/client-stats";
// ClientQuickActionsSheet — bottom sheet that opens on long-press of
// a client row. ImportClientsModal — opens from the page menu. Both
// gated on user action, neither needs to ship in the initial bundle.
const ClientQuickActionsSheet = dynamic(
  () => import("@/components/clients/ClientQuickActionsSheet"),
  { ssr: false },
);
import ClientsListSkeleton from "@/components/clients/ClientsListSkeleton";
import { DelayedSkeleton } from "@/components/ui/DelayedSkeleton";
const ImportClientsModal = dynamic(
  () => import("@/components/clients/import/ImportClientsModal"),
  { ssr: false },
);
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useTenantId } from "@/components/layout/DashboardClientLayout";
import {
  loadResumeState,
  clearResumeState,
} from "@/components/clients/import/csv-resume";

// v312 — tag chips are tenant-managed: read from useClients().tags.
// Settings UI for creating/editing/deleting tags lands in Phase 2.

// v809 — SortKey kept for the ?sort= URL effect; SORT_LABELS moved into
// the filter panel's SortPills (the only place that renders the labels).
type SortKey = "recent" | "name" | "revenue" | "equipment";

// v811 — RU labels for the «Сортировка» row in the settings screen.
const SORT_LABELS_RU: Record<SortKey, string> = {
  recent: "Недавно посещали",
  name: "По имени (А–Я)",
  revenue: "По доходу",
  equipment: "По технике",
};

type Segment =
  | "all"
  | "debt"
  | "birthday"
  | "blacklist"
  | "silent"
  | "new"
  | "loyal";


// v329 — daysUntilBirthday moved into lib/client-stats.ts as part
// of the unified ClientStats roll-up (read via statsMap.get(id)
// .birthdayInDays).  Local copy removed.

export default function ClientsPage() {
  const router = useRouter();
  const {
    clients,
    clientsLoading,
    clientsError,
    reloadClients,
    upsertClient,
    deleteClient,
    tags,
  } = useClients();
  const { appointments, upsertAppointment } = useAppointments();
  // v809 — teams power the КОМАНДА facet (each client's team set is
  // derived from their appointments' team_id).
  const { teams } = useTeams();
  // STORY-052 G6 — quota state for the "Добавить клиента" gating.
  const { snapshot: quotaSnap } = useTenantQuota();
  const clientsAtCap =
    !!quotaSnap &&
    !isUnlimited(quotaSnap.quotas.clients) &&
    quotaSnap.usage.clients >= quotaSnap.quotas.clients;
  const clientsCapTooltip = clientsAtCap
    ? `Достигнут лимит ${quotaSnap.quotas.clients} клиентов. Перейдите на Pro в Настройках → Тариф и оплата.`
    : undefined;
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [segment, setSegment] = useState<Segment>("all");
  // v809 — multi-select facets + period for the «Фильтры» panel.
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [period, setPeriod] = useState<PeriodValue | null>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  // v811 — gear settings overlay + nested card-fields + live card prefs.
  const [clientSettingsOpen, setClientSettingsOpen] = useState(false);
  const [cardFieldsOpen, setCardFieldsOpen] = useState(false);
  const [cardFields, setCardFieldsState] =
    useState<CardFieldPrefs>(DEFAULT_CARD_FIELDS);
  // SSR-safe hydrate of the persisted card-field visibility prefs.
  useEffect(() => {
    setCardFieldsState(getCardFields());
  }, []);
  // clients-99 F2.10 — sort mirrors `?sort=…` so a deep-link survives
  // refresh + share.
  const searchParams = useSearchParams();
  const sortFromUrl = (searchParams?.get("sort") as SortKey | null) ?? null;
  const VALID_SORT: SortKey[] = ["recent", "name", "revenue", "equipment"];
  const initialSort: SortKey =
    sortFromUrl && VALID_SORT.includes(sortFromUrl) ? sortFromUrl : "recent";
  const [sort, setSort] = useState<SortKey>(initialSort);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (sort === "recent") params.delete("sort");
    else params.set("sort", sort);
    const qs = params.toString();
    const next = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname;
    if (next !== window.location.pathname + window.location.search) {
      // Preserve the current history state — when the «Фильтры» panel is
      // open it owns the top entry ({babunModal:…}); nulling it here would
      // orphan that sentinel and break the hardware Back button on close.
      window.history.replaceState(window.history.state, "", next);
    }
  }, [sort]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Client | null>(null);
  // STORY-059 — first-visit tutorial pointing at the "+" button. Only
  // fires when the tenant has zero clients (otherwise the user has
  // clearly already used this page; tutorial would be noise).
  const tutorialClients = useTutorialState("clients-add");
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
  // STORY-046 — CSV import modal + role gate + resume toast.
  const tenantId = useTenantId();
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [resumeBannerOpen, setResumeBannerOpen] = useState(false);
  const [resumeFileName, setResumeFileName] = useState<string>("");
  useEffect(() => {
    // Two distinct external-state-sync paths in one effect:
    // 1. Caller-role fetched from Supabase tenant_members table.
    // 2. CSV-import resume state hydrated from localStorage.
    // React-Compiler flags the setters as cascading renders but both
    // are canonical «sync to external store» — first is async, the
    // localStorage call is bounded to one extra render.
    /* eslint-disable react-hooks/set-state-in-effect */
    void (async () => {
      const supabase = getSupabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("tenant_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      setCallerRole(data?.role ?? null);
    })();
    const resume = loadResumeState();
    if (resume) {
      setResumeFileName(resume.fileName);
      setResumeBannerOpen(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [tenantId]);
  const canImport = callerRole === "owner" || callerRole === "dispatcher";
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

  // clients-99 F4.5 — keyboard shortcuts (ignored while typing).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || t?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        const input = searchRef.current?.querySelector("input");
        input?.focus();
      } else if (e.key === "n" || e.key === "т") {
        if (clientsAtCap) return;
        e.preventDefault();
        router.push("/dashboard/clients/new");
      } else if (e.key === "Escape" && isSelecting) {
        setIsSelecting(false);
        setSelectedIds(new Set());
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [clientsAtCap, isSelecting, router]);

  // clients-99 F4.9 — page-view ping (once per mount).
  useEffect(() => {
    track("clients.page_view", { count: clients.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // clients-99 F4.9 — debounced search ping.
  useEffect(() => {
    if (!search.trim()) return;
    const t = window.setTimeout(() => {
      track("clients.search", { length: search.trim().length });
    }, 800);
    return () => window.clearTimeout(t);
  }, [search]);

  // clients-99 F3.2 — soft-delete with 10s undo.


  // Deep link from chat: /dashboard/clients?id=<id> auto-opens a card.
  // Dima taps "Открыть карточку" in a chat and lands directly on the
  // full client detail view. URL is tidied up after consumption.
  // STORY-065 — `?id=X` deep-link now routes to /dashboard/clients/[id]
  // (the canonical detail page) instead of toggling an inline panel.
  // Single source of truth for the detail UI.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      router.replace(`/dashboard/clients/${id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // P2 #37 (CRM Core brief) — Intl returns nominative ("май") so
  // «1 новый в май» read wrong. Use the dedicated prepositional table.

  // v809 — filtering, contextual facet counts, and the active-token
  // list are delegated to useClientFilters. `filtered` keeps the EXACT
  // legacy predicate order + pinned-first comparator + 4 sort keys, so
  // every downstream consumer (selection, bulk, export, virtual list,
  // empty states) is unchanged.
  const filterState: ClientFilterState = useMemo(
    () => ({
      search,
      sort,
      segment,
      selectedTeams,
      selectedCities,
      activeTags,
      period,
      panelOpen: filterPanelOpen,
    }),
    [
      search,
      sort,
      segment,
      selectedTeams,
      selectedCities,
      activeTags,
      period,
      filterPanelOpen,
    ],
  );
  const filterResult = useClientFilters(
    clients,
    appointments,
    teams,
    tags,
    statsMap,
    filterState,
  );
  const filtered = filterResult.filtered;

  const toggleTag = (tagId: string) => {
    setActiveTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const toggleTeam = (id: string) => {
    setSelectedTeams((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  const toggleCity = (city: string) => {
    setSelectedCities((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city],
    );
  };

  // Clear all FILTER values (teams / cities / tags / segment / period).
  // Sort is intentionally preserved — it's not a filter.
  const resetFilters = () => {
    setSelectedTeams([]);
    setSelectedCities([]);
    setActiveTags([]);
    setSegment("all");
    setPeriod(null);
  };

  // Remove a single value token from the summary bar (live).
  const removeToken = (token: ActiveToken) => {
    if (token.key === "team") toggleTeam(token.val);
    else if (token.key === "city") toggleCity(token.val);
    else if (token.key === "tag") toggleTag(token.val);
    else if (token.key === "period") setPeriod(null);
    else if (token.key === "segment") setSegment("all");
  };

  // Stable identity — the panel's history-back + scroll-lock effects key
  // on onClose; a fresh closure per render would re-register the modal
  // sentinel on every live filter tap (history thrash / spurious close).
  const closeFilterPanel = useCallback(() => setFilterPanelOpen(false), []);

  // v811 — settings overlays. Stable identities for the same reason
  // (each screen registers a hardware-back sentinel keyed on its close).
  const closeClientSettings = useCallback(() => setClientSettingsOpen(false), []);
  const closeCardFields = useCallback(() => setCardFieldsOpen(false), []);
  const toggleCardField = useCallback((f: CardField) => {
    setCardFieldsState((prev) => {
      const next = { ...prev, [f]: !prev[f] };
      setCardFields(next);
      return next;
    });
  }, []);

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
      {tutorialClients.show && clients.length === 0 && !clientsLoading && (
        <TutorialOverlay
          targetId="clients-add"
          text="Здесь добавляйте клиентов. Нажмите «+», заполните имя и телефон — и контакт появится в списке."
          onDismiss={tutorialClients.complete}
        />
      )}
      <PageHeader
        title={isSelecting ? `Выбрано ${selectedIds.size}` : "Клиенты"}
        showBack={false}
        onTitleClick={
          isSelecting ? undefined : () => {
            haptic("tap");
            setFilterPanelOpen(true);
          }
        }
        leftContent={
          isSelecting ? (
            <button
              type="button"
              onClick={() => {
                haptic("tap");
                setIsSelecting(false);
                setSelectedIds(new Set());
              }}
              className="h-9 px-3 flex items-center rounded-full text-[var(--accent)] active:bg-[var(--accent-tint)] text-[14px] font-semibold transition"
            >
              Готово
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                haptic("tap");
                setClientSettingsOpen(true);
              }}
              aria-label="Настройки клиентов"
              title="Настройки клиентов"
              className="w-9 h-9 flex items-center justify-center rounded-full text-[var(--accent)] active:bg-[var(--accent-tint)] transition"
            >
              <Settings size={20} strokeWidth={2.2} />
            </button>
          )
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
            <div className="flex items-center gap-1">
              {/* v811 — CSV import/export moved into «Настройки клиентов»
                  (gear). Header keeps only the «+» add action, per mockup. */}
              <button
                type="button"
                data-tutorial="clients-add"
                data-testid="add-client-btn"
                onClick={() => {
                  haptic("tap");
                  // clients-99 F1.1 — quota gate emits explicit feedback
                  // (toast + analytics) instead of silently disabled
                  // button. Operator must know *why* the click bounced.
                  if (clientsAtCap) {
                    track("clients.add_button_quota_block", {
                      quota: quotaSnap?.quotas.clients ?? null,
                    });
                    toast.show({
                      variant: "info",
                      durationMs: 6000,
                      message: clientsCapTooltip ?? "Лимит клиентов достигнут — перейдите на Pro в Настройках → Тариф",
                    });
                    return;
                  }
                  track("clients.add_button_click");
                  router.push("/dashboard/clients/new");
                }}
                title={clientsCapTooltip}
                aria-label="Добавить клиента"
                // STORY audit: 36 → 44 — primary add-action на самом
                // частом списке; не должна быть меньше iOS floor.
                className={`w-11 h-11 flex items-center justify-center rounded-full transition ${clientsAtCap ? "text-[var(--label-tertiary)] bg-[var(--fill-tertiary)]" : "text-[var(--accent)] active:bg-[var(--accent-tint)]"}`}
              >
                <Plus size={20} strokeWidth={2.2} />
              </button>
            </div>
          )
        }
      />

      {/* STORY-052 G6 — quota nudge banner; scope=clients keeps the
          message focused on this page's relevant kind. */}
      {quotaSnap && (
        <QuotaBanner
          plan={quotaSnap.plan}
          quotas={quotaSnap.quotas}
          usage={quotaSnap.usage}
          scope="clients"
        />
      )}

      {/* STORY-059 — CSV import hint, shown only when 1 ≤ N < 5. */}
      <CsvImportHint clientsCount={clients.length} />

      {/* clients-99 F3.3 — reactivation reminder strip. Hidden when no
          one is silent or when the user already filtered to silent. */}
      {clients.length > 0 && segmentCounts.silent > 0 && segment !== "silent" && (
        <div className="mx-3 mt-3 lg:mx-4">
          <ReactivationWidget
            count={segmentCounts.silent}
            onFilter={() => {
              haptic("tap");
              track("clients.filter_segment", { segment: "silent", source: "reactivation_widget" });
              setSegment("silent");
            }}
            onSmsBlast={() => {
              haptic("tap");
              setSegment("silent");
              setIsSelecting(true);
              setSelectedIds(new Set(
                clients.filter((c) => {
                  const s = statsMap.get(c.id);
                  return s ? isLongSilence(s) : false;
                }).map((c) => c.id),
              ));
              setSmsBlastOpen(true);
            }}
          />
        </div>
      )}

      {/* STORY-036 + STORY-082 polish — delayed-skeleton pattern.
          Empty tenants resolve in <300ms, so we never want to flash
          a skeleton for them. The hook returns true ONLY if loading
          has continued past the threshold. */}
      <DelayedSkeleton show={clientsLoading && clients.length === 0} delayMs={300}>
        <div className="flex-1 overflow-hidden">
          <ClientsListSkeleton />
        </div>
      </DelayedSkeleton>

      {/* STORY-036 — error state on first fetch failure. */}
      {!clientsLoading && clientsError && clients.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full bg-[var(--surface-card)] rounded-[var(--radius-card)] p-5 text-center shadow-[var(--shadow-card)]">
            <div className="text-[15px] font-semibold text-[var(--label)] mb-1">
              Не удалось загрузить клиентов
            </div>
            <div className="text-[13px] text-[var(--label-secondary)] mb-4">
              {clientsError}
            </div>
            <button
              type="button"
              onClick={() => {
                haptic("tap");
                void reloadClients();
              }}
              className="w-full h-11 rounded-[var(--radius-pill)] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] transition"
            >
              Повторить
            </button>
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]"
        style={{
          display:
            (clientsLoading && clients.length === 0) ||
            (clientsError && clients.length === 0)
              ? "none"
              : undefined,
        }}
      >
        {/* STORY-036 — non-fatal error banner above the (cached) list. */}
        {clientsError && clients.length > 0 && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-[var(--system-red-tint,rgba(255,59,48,0.12))] text-[13px] text-[var(--system-red)] flex items-center justify-between">
            <span className="truncate">Список устарел: {clientsError}</span>
            <button
              type="button"
              onClick={() => {
                haptic("tap");
                void reloadClients();
              }}
              className="ml-2 shrink-0 px-2 h-7 rounded-md bg-[var(--surface-card)] text-[var(--system-red)] text-[12px] font-semibold"
            >
              Повторить
            </button>
          </div>
        )}
        <div className="max-w-3xl mx-auto p-3 lg:p-4 space-y-3 stagger-children">
          {/* v809 — hero strip keeps only the «ДР на неделе» nudge. The
              duplicate «Всего N клиентов» counter moved into the filter
              bar (idle state), so the strip hides entirely when no one
              has a birthday this week. */}
          {segmentCounts.birthdayThisWeek > 0 && (
            <div className="flex items-center justify-center gap-1.5 h-8 -mt-1 text-[12px] tabular-nums">
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
            </div>
          )}

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

          {/* ── v809 — summary filter bar (replaces the chip row).
                 Idle shows «Фильтры · Всего N клиентов»; active shows a
                 funnel + count badge + removable value tokens + a
                 «Найдено: N / Сбросить» line. Tapping opens the panel. */}
          <ClientsFilterBar
            totalCount={segmentCounts.all}
            foundCount={filtered.length}
            activeCount={filterResult.activeCount}
            tokens={filterResult.activeTokens}
            onOpen={() => setFilterPanelOpen(true)}
            onRemoveToken={removeToken}
            onReset={resetFilters}
          />

          {/* ── Client cards ─────────────────────────────────────── */}
          {/* clients-99 F2.11 — virtualize when the filtered list
              exceeds VIRTUAL_THRESHOLD. Small tenants stay on the
              .map() fast-path so iOS Safari scroll restoration works. */}
          {(() => {
            const renderRow = (client: Client) => {
              const stats = statsMap.get(client.id);
              const phoneDigits = client.phone.replace(/\D/g, "");
              const debt = (stats?.debt ?? 0) > 0
                ? stats!.debt
                : client.balance < 0
                  ? Math.abs(client.balance)
                  : 0;
              const teamName = stats?.lastTeamId
                ? (teams.find((t) => t.id === stats.lastTeamId)?.name ?? null)
                : null;
              const isPicked = selectedIds.has(client.id);
              const isPinned = Boolean(client.pinned_at);

              const card = (
                <ClientCard
                  client={client}
                  tags={tags}
                  stats={stats}
                  debt={debt}
                  teamName={teamName}
                  cardFields={cardFields}
                  phoneDigits={phoneDigits}
                  selectionMode={isSelecting}
                  picked={isPicked}
                  pinned={isPinned}
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
                      // v813 — unified card: every tap (desktop + mobile)
                      // opens the one canonical page; no more desktop modal.
                      router.push(`/dashboard/clients/${client.id}`);
                    }
                  }}
                  onLongPress={(anchor) => {
                    if (isSelecting) return;
                    haptic("tap");
                    setCtxMenu({ client, anchor });
                  }}
                />
              );

              if (isSelecting) return <div>{card}</div>;

              return (
                <div className="rounded-[14px] overflow-hidden">
                  <SwipeableRow
                    leftActions={[
                      {
                        label: isPinned ? "Открепить" : "Закрепить",
                        icon: <Pin size={18} strokeWidth={2.2} />,
                        color: "bg-[var(--accent)]",
                        onSelect: () => {
                          haptic("light");
                          togglePin(client);
                        },
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
                        onSelect: () => {
                          haptic("light");
                          setReminderFor(client);
                        },
                      },
                      {
                        label: "Удалить",
                        icon: <Trash2 size={18} strokeWidth={2.2} />,
                        color: "bg-[var(--system-red)]",
                        onSelect: () => {
                          haptic("warning");
                          setSingleConfirmDelete(client);
                        },
                      },
                    ]}
                  >
                    {card}
                  </SwipeableRow>
                </div>
              );
            };

            if (filtered.length > VIRTUAL_THRESHOLD) {
              return (
                <VirtualList
                  items={filtered}
                  scrollRef={scrollRef}
                  renderRow={renderRow}
                />
              );
            }
            return (
              <div className="space-y-2">
                {filtered.map((client) => (
                  <div key={client.id}>{renderRow(client)}</div>
                ))}
              </div>
            );
          })()}
          <div className="space-y-2">
            {/* STORY-059 — first-run vs filter-empty are now distinct.
                First-run gets the prominent welcome variant; filter-
                empty stays muted and short. clients.length is the
                source of truth ("ever had any?"); filtered.length is
                "anything matching the current chips/search?". */}
            {filtered.length === 0 && clients.length === 0 && (
              <EmptyState
                variant="prominent"
                icon={<Users size={28} strokeWidth={2} />}
                title="Создайте первого клиента"
                description="Контакт, телефон, объекты — всё на одном экране. Заполнишь — он сразу появится в календаре."
                action={
                  <Button
                    variant="primary"
                    onClick={() => router.push("/dashboard/clients/new")}
                    disabled={clientsAtCap}
                    title={clientsCapTooltip}
                  >
                    + Новый клиент
                  </Button>
                }
              />
            )}
            {filtered.length === 0 && clients.length > 0 && (
              <EmptyState
                variant="muted"
                icon={<Users size={24} strokeWidth={1.8} />}
                title="По фильтру никого нет"
                action={
                  <Button
                    variant="tinted"
                    size="sm"
                    onClick={() => router.push("/dashboard/clients/new")}
                    disabled={clientsAtCap}
                    title={clientsCapTooltip}
                  >
                    + Добавить клиента
                  </Button>
                }
              />
            )}
          </div>
        </div>
      </div>

      {/* v809 — centered «Фильтры» panel (replaces the old sort modal +
          chip row). Sort, status, team, city, tag, period all live here
          and apply live; the footer button just closes. */}
      {filterPanelOpen && (
        <ClientsFilterPanel
          result={filterResult}
          segmentCounts={{
            debt: segmentCounts.debt,
            birthday: segmentCounts.birthday,
            blacklist: segmentCounts.blacklist,
            silent: segmentCounts.silent,
            new: segmentCounts.new,
            loyal: segmentCounts.loyal,
          }}
          sort={sort}
          segment={segment}
          selectedTeams={selectedTeams}
          selectedCities={selectedCities}
          activeTags={activeTags}
          period={period}
          onSortChange={setSort}
          onSegmentChange={setSegment}
          onToggleTeam={toggleTeam}
          onToggleCity={toggleCity}
          onToggleTag={toggleTag}
          onPeriodChange={setPeriod}
          onResetFilters={resetFilters}
          onClose={closeFilterPanel}
        />
      )}

      {/* v811 — gear → «Настройки клиентов» full-screen overlay + the
          nested live «Что показывать на карточке» field toggles. */}
      {clientSettingsOpen && (
        <ClientsSettingsScreen
          cardFields={cardFields}
          sortLabel={SORT_LABELS_RU[sort]}
          canImport={canImport}
          onClose={closeClientSettings}
          onOpenCardFields={() => setCardFieldsOpen(true)}
          onOpenSort={() => {
            setClientSettingsOpen(false);
            setFilterPanelOpen(true);
          }}
          onOpenFilters={() => {
            setClientSettingsOpen(false);
            setFilterPanelOpen(true);
          }}
          onImport={() => {
            setClientSettingsOpen(false);
            setImportOpen(true);
          }}
          onExport={() => {
            const set = filtered.length > 0 ? filtered : clients;
            track("clients.export_csv", { count: set.length });
            exportClientsCsv(set);
            toast.show({
              variant: "success",
              message: `CSV выгружен (${set.length})`,
            });
          }}
          onStub={(label) =>
            toast.show({ variant: "info", message: `${label} — в разработке` })
          }
        />
      )}
      {cardFieldsOpen && (
        <CardFieldsScreen
          prefs={cardFields}
          onToggle={toggleCardField}
          onBack={closeCardFields}
        />
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
            onSelect: () => router.push(`/dashboard/clients/${c.id}`),
          });
          opts.push({
            label: "Выбрать несколько",
            icon: <Check size={18} strokeWidth={2} />,
            onSelect: () => {
              setIsSelecting(true);
              setSelectedIds(new Set([c.id]));
            },
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
            className="h-12 flex items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold text-[var(--system-blue)] active:bg-[var(--fill-quaternary)] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)]"
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
            className="h-12 flex items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold text-[var(--system-red)] active:bg-[var(--fill-quaternary)] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)]"
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
            title={`Удалить ${targets.length} ${countWordRu(targets.length, "клиента", "клиента", "клиентов")}?`}
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

      {/* v813 — desktop preview modal retired: every tap now opens the
          one canonical /[id] card (unified «Карта-диспетчер»). ClientPanel
          stays only for the new-client draft below. */}

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

      {/* STORY-046 — CSV import wizard. Owner + Dispatcher only. */}
      <ImportClientsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />

      {/* STORY-046 — resume banner for half-finished imports. */}
      {resumeBannerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] bg-[var(--surface-card)] rounded-2xl shadow-2xl px-4 py-3 max-w-[420px] w-[calc(100vw-32px)] flex items-center gap-3"
        >
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold text-[var(--label)]">
              Прерванный импорт
            </div>
            <div className="text-[12px] text-[var(--label-tertiary)] truncate">
              {resumeFileName}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              clearResumeState();
              setResumeBannerOpen(false);
            }}
            className="px-3 h-9 rounded-[10px] text-[var(--label-secondary)] text-[13px] font-medium active:bg-[var(--fill-quaternary)] transition"
          >
            Игнорировать
          </button>
        </div>
      )}
    </>
  );
}

// v809 — SegmentChip removed: статусы переехали в секцию СТАТУС панели
// «Фильтры».

// ─── Client list card ──────────────────────────────────────────────

const VISIT_MONTHS = [
  "янв", "фев", "мар", "апр", "мая", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];
/** «YYYY-MM-DD» → «2 мар» for the card's last-visit segment. */
function formatVisitShort(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  if (!m || !d) return key;
  return `${d} ${VISIT_MONTHS[m - 1]}`;
}

function ClientCard({
  client,
  tags,
  stats,
  debt,
  teamName,
  cardFields,
  phoneDigits,
  selectionMode,
  picked,
  pinned,
  onOpen,
  onLongPress,
  onPhoneLongPress,
}: {
  client: Client;
  tags: ClientTag[];
  stats: ClientStats | undefined;
  debt: number;
  teamName: string | null;
  cardFields: CardFieldPrefs;
  phoneDigits: string;
  selectionMode: boolean;
  picked: boolean;
  pinned: boolean;
  onOpen: () => void;
  onLongPress: (anchor: { x: number; y: number }) => void;
  /** Fires when the green phone icon is held ≥500 ms.  Opens the
   *  channel picker (Звонок / WhatsApp / SMS / Telegram). */
  onPhoneLongPress: () => void;
}) {
  const color = getAvatarColor(client.full_name);
  const initials = getInitials(client.full_name || "?");
  // v811 — money row (grey expected · green income · gold debt) + a
  // single meta line; field visibility is driven by `cardFields`.
  const exp = Math.round(stats?.expectedRevenue ?? 0);
  const income = Math.round(stats?.totalSpent ?? 0);

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

  // ── Money figures — grey expected · green income · gold debt ──
  const figs: React.ReactNode[] = [];
  if (cardFields.exp && exp > 0)
    figs.push(
      <span key="exp" className="text-[var(--label-secondary)]">
        €{exp.toLocaleString("ru-RU")}
      </span>,
    );
  if (cardFields.inc && income > 0)
    figs.push(
      <span key="inc" className="text-[var(--system-green)]">
        €{income.toLocaleString("ru-RU")}
      </span>,
    );
  if (cardFields.debt && debt > 0)
    figs.push(
      <span key="debt" style={{ color: "#B78600" }}>
        €{debt.toLocaleString("ru-RU")}
      </span>,
    );

  // ── Meta line — last visit · team · city · tags ──
  const tagChips = client.tag_ids
    .map((tid) => tags.find((t) => t.id === tid))
    .filter((t): t is ClientTag => Boolean(t));
  const metaSegs: React.ReactNode[] = [];
  if (cardFields.last) {
    metaSegs.push(
      stats?.lastVisitDate ? (
        <span key="last" className="inline-flex items-center gap-1">
          <Clock
            size={11}
            strokeWidth={2.2}
            className="text-[var(--label-secondary)]"
          />
          {formatVisitShort(stats.lastVisitDate)}
        </span>
      ) : (
        <span key="last" className="text-[var(--label-tertiary)]">
          нет записей
        </span>
      ),
    );
  }
  if (cardFields.meta) {
    if (teamName) metaSegs.push(<span key="team">{teamName}</span>);
    const city = (client.city ?? "").trim();
    if (city) metaSegs.push(<span key="city">{city}</span>);
    for (const t of tagChips)
      metaSegs.push(<span key={`tag-${t.id}`}>{t.name}</span>);
  }

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
        {/* Name row */}
        <div className="flex items-center gap-1.5 min-w-0">
          {pinned && (
            <span title="Закреплён" className="shrink-0 text-[var(--accent)]">
              <Pin size={12} strokeWidth={2.5} />
            </span>
          )}
          <span className="text-[16px] font-semibold text-[var(--label)] truncate">
            {client.full_name || "Без имени"}
          </span>
        </div>

        {/* Money row */}
        {figs.length > 0 && (
          <div className="flex items-center gap-2.5 flex-wrap text-[11px] font-semibold mt-[3px] tabular-nums">
            {figs}
          </div>
        )}

        {/* Meta row — last visit · team · city · tags */}
        {metaSegs.length > 0 && (
          <div className="text-[11px] text-[var(--label)] mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
            {metaSegs.map((seg, i) => (
              <span key={i} className="inline-flex items-center align-middle">
                {i > 0 && (
                  <span className="mx-[5px] text-[var(--label-tertiary)]">·</span>
                )}
                {seg}
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

// v809 — TagChip removed: теги переехали в секцию ТЕГ панели «Фильтры».
// v811 — tagAlpha removed: the card's tag pills became plain text segments
// in the meta line, so the per-card tint helper is no longer needed.

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
    // window.location.assign is identical to .href= but doesn't trip
    // the react-hooks/immutability lint rule.
    const url = `sms:${phones.join(",")}?body=${encodeURIComponent(text.trim())}`;
    window.location.assign(url);
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
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-3"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] overflow-hidden"
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
              className="flex-1 h-11 rounded-[10px] bg-[var(--system-blue)] text-white text-[14px] font-semibold press-scale disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)]"
            >
              Открыть SMS
            </button>
            <button
              type="button"
              onClick={copyPhones}
              disabled={phones.length === 0}
              className="h-11 px-4 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--label)] text-[14px] press-scale disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)]"
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
