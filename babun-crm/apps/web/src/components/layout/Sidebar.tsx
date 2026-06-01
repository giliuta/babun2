"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  Users as UsersIcon,
  UserCircle2,
  RotateCcw,
  Wallet,
  MessageSquare,
  Settings as SettingsIcon,
  LogOut,
  CircleAlert as AlertTriangleIcon,
  ClipboardList as ClipboardListIcon,
  BarChart3 as BarChart3Icon,
  Search as SearchIcon,
  ChevronRight,
} from "@babun/shared/icons";
import { dueReminders } from "@babun/shared/local/recurring";
import { listRecurringReminders } from "@babun/shared/db/repositories/recurring-reminders";
import { loadTeams, loadMasters } from "@babun/shared/local/masters";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useTenantId } from "@/components/layout/DashboardClientLayout";
import { useRealtimeTenantSync } from "@/hooks/useRealtimeTenantSync";
import { useUnclosedCount } from "@/hooks/useUnclosedCount";
import { loadChats, getTotalUnread } from "@babun/shared/local/chats";
import { DISPLAY_VERSION } from "@babun/shared/common/utils/version";
// STORY-060 §F3.4 + §F3.5 — sync health badge and bug-report channel.
// Lazy-loaded so the heavy modal + popover don't ship in first paint.
import dynamic from "next/dynamic";
const SyncIndicator = dynamic(
  () => import("@/components/calendar/SyncIndicator"),
  { ssr: false },
);
const BugReportButton = dynamic(
  () => import("@/components/system/BugReportButton"),
  { ssr: false },
);

// «Кабинет» — full-screen account + navigation hub (approved mockup
// 3++, header ③). On MOBILE the drawer is full-width so it reads as a
// real page with the bottom tab bar showing through on top (the tab
// bar renders after this aside in the layout, so at equal z-index it
// paints over the drawer's bottom edge — content is bottom-padded to
// clear it). On lg+ it stays the 240px pinned rail.
//
// Body = iOS-grouped cards: a live search filter, «Аналитика» +
// «Управление» sections with coloured tile icons + count / red-badge
// chips, then a soft logout row + version footer. The bottom-tab
// primaries (Календарь / Клиенты / Чаты / Финансы) only render on lg+
// under «Главное» — on mobile they live in the BottomTabBar, so the
// Кабинет omits them exactly like the mockup.

export type DialogType =
  | "calendar"
  | "clients"
  | "chats"
  | "finances"
  | "insights"
  | "recurring"
  | "unclosed"
  | "audit"
  | "settings"
  | "masters"
  | "teams"
  | "services"
  | "sms-templates"
  | null;

interface SidebarProps {
  onLogout: () => void;
  onNavigate?: (dialog: DialogType) => void;
  open: boolean;
  onClose: () => void;
  /** Live tenant.name from the DB — the FIXED company name in the hero. */
  tenantName: string;
  /** Authenticated user's email — the per-master caption in the hero. */
  userEmail: string;
}

const ROUTE_MAP: Record<Exclude<DialogType, null>, string> = {
  calendar: "/dashboard",
  clients: "/dashboard/clients",
  chats: "/dashboard/chats",
  finances: "/dashboard/finances",
  insights: "/dashboard/insights",
  recurring: "/dashboard/recurring",
  unclosed: "/dashboard/unclosed",
  audit: "/dashboard/audit",
  settings: "/dashboard/settings",
  masters: "/dashboard/masters",
  teams: "/dashboard/teams",
  services: "/dashboard/services",
  "sms-templates": "/dashboard/sms-templates",
};

type KRowData = {
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
  /** Solid colour of the iOS-style rounded icon tile. */
  tile: string;
  label: string;
  href: string;
  dialog: Exclude<DialogType, null>;
  /** Red pill (alerts: unread chats, due returns, unclosed). */
  badge?: number;
  /** Grey trailing count (teams / masters). */
  count?: number;
};

export default function Sidebar({
  onLogout,
  open,
  onClose,
  tenantName,
  userEmail,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const tenantId = useTenantId();

  const [recurringDue, setRecurringDue] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);
  const [teamsCount, setTeamsCount] = useState(0);
  const [mastersCount, setMastersCount] = useState(0);
  const [query, setQuery] = useState("");

  // STORY-060 F3.6 — shared hook drives «Не закрыто» badge so Sidebar +
  // BottomTabBar always agree (past-due `scheduled` + any `in_progress`).
  const unclosedCount = useUnclosedCount();

  // STORY-085 — close the drawer when the user navigates. Also clears
  // the search box so reopening the Кабинет always starts fresh.
  useEffect(() => {
    if (open) onClose();
    setQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // STORY-050/048 — recurring-reminder badge + chat unread + reference
  // counts (teams/masters). Lazy fetch on mount + on focus / storage /
  // intra-tab signal; realtime keeps the returns badge live.
  const refreshBadge = useCallback(() => {
    let cancelled = false;
    const supabase = getSupabaseBrowser();
    void listRecurringReminders(supabase, tenantId)
      .then((list) => {
        if (cancelled) return;
        setRecurringDue(dueReminders(list).length);
      })
      .catch(() => {
        if (!cancelled) setRecurringDue(0);
      });
    setUnreadChats(getTotalUnread(loadChats()));
    setTeamsCount(loadTeams().length);
    setMastersCount(loadMasters().length);
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshBadge();
    const onChange = () => refreshBadge();
    window.addEventListener("storage", onChange);
    window.addEventListener("focus", onChange);
    window.addEventListener("babun:recurring-changed", onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("focus", onChange);
      window.removeEventListener("babun:recurring-changed", onChange);
    };
  }, [open, pathname, refreshBadge]);

  useRealtimeTenantSync({
    supabase: getSupabaseBrowser(),
    table: "recurring_reminders",
    tenantId,
    onInsert: refreshBadge,
    onUpdate: refreshBadge,
    onDelete: refreshBadge,
    onResync: refreshBadge,
  });

  // Prefetch every reachable route on mount so the first tap is instant.
  useEffect(() => {
    Object.values(ROUTE_MAP).forEach((path) => router.prefetch(path));
  }, [router]);

  const isActive = (dialog: Exclude<DialogType, null>) =>
    pathname === ROUTE_MAP[dialog];

  // Primaries — desktop rail only (mobile reaches these via BottomTabBar).
  const primaryRows: KRowData[] = [
    { icon: CalendarIcon, tile: "#ff9500", label: "Календарь", href: ROUTE_MAP.calendar, dialog: "calendar" },
    { icon: UsersIcon, tile: "#34c759", label: "Клиенты", href: ROUTE_MAP.clients, dialog: "clients" },
    { icon: MessageSquare, tile: "#0a84ff", label: "Чаты", href: ROUTE_MAP.chats, dialog: "chats", badge: unreadChats || undefined },
    { icon: Wallet, tile: "#30b0c7", label: "Финансы", href: ROUTE_MAP.finances, dialog: "finances" },
  ];
  const analyticsRows: KRowData[] = [
    { icon: BarChart3Icon, tile: "#5856d6", label: "Сводка", href: ROUTE_MAP.insights, dialog: "insights" },
    { icon: RotateCcw, tile: "#ff9500", label: "Возвраты", href: ROUTE_MAP.recurring, dialog: "recurring", badge: recurringDue || undefined },
    { icon: AlertTriangleIcon, tile: "#ff3b30", label: "Не закрыто", href: ROUTE_MAP.unclosed, dialog: "unclosed", badge: unclosedCount || undefined },
    { icon: ClipboardListIcon, tile: "#af52de", label: "Журнал", href: ROUTE_MAP.audit, dialog: "audit" },
  ];
  const managementRows: KRowData[] = [
    { icon: UsersIcon, tile: "#007aff", label: "Команды", href: ROUTE_MAP.teams, dialog: "teams", count: teamsCount || undefined },
    { icon: UserCircle2, tile: "#30b0c7", label: "Мастера", href: ROUTE_MAP.masters, dialog: "masters", count: mastersCount || undefined },
    { icon: MessageSquare, tile: "#34c759", label: "SMS-шаблоны", href: ROUTE_MAP["sms-templates"], dialog: "sms-templates" },
    { icon: SettingsIcon, tile: "#8e8e93", label: "Настройки", href: ROUTE_MAP.settings, dialog: "settings" },
  ];

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 lg:hidden bg-black/30 [backdrop-filter:blur(20px)_saturate(180%)] [-webkit-backdrop-filter:blur(20px)_saturate(180%)]"
          onClick={onClose}
        />
      )}

      <aside
        role="navigation"
        aria-label="Кабинет"
        // Full-width on mobile (reads as a page; bottom tabs paint over
        // it), 240px pinned rail on lg+. translate-x drives the mobile
        // slide; lg keeps it on-screen.
        className={`fixed top-0 left-0 h-full w-full lg:w-[240px] bg-[var(--surface-grouped)] flex flex-col z-40 transition-transform duration-[250ms] ease-out lg:border-r lg:border-[var(--separator)] ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex-1 overflow-y-auto pb-[100px] lg:pb-6">
          {/* hero ③ — deep gradient, company initial, FIXED tenant name +
              per-master email. Both come from props. */}
          <div className="p-3 pt-5">
            <div
              className="relative overflow-hidden rounded-[18px] p-4 flex items-center gap-3.5 shadow-[0_8px_22px_rgba(47,123,240,0.35)]"
              style={{ background: "linear-gradient(140deg,#5B6BFF,#2D7AF0 70%)" }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(180deg,rgba(255,255,255,0.18),transparent 42%)",
                }}
              />
              <div className="relative w-[52px] h-[52px] rounded-[15px] flex items-center justify-center text-white text-[22px] font-bold flex-shrink-0 bg-white/[0.16] border border-white/40">
                {(tenantName || "?").trim().charAt(0).toUpperCase()}
              </div>
              <div className="relative min-w-0 flex-1">
                <div className="text-[18px] font-bold text-white leading-tight truncate">
                  {tenantName}
                </div>
                <div className="text-[12.5px] text-white/80 truncate mt-0.5">
                  {userEmail}
                </div>
              </div>
            </div>
          </div>

          {/* search — filters the section rows live by label */}
          <div className="px-4 pt-1">
            <div className="flex items-center gap-2 h-[38px] px-3 rounded-[11px] bg-[var(--fill-tertiary)]">
              <SearchIcon
                size={17}
                strokeWidth={2}
                className="text-[var(--label-secondary)] shrink-0"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по разделам"
                aria-label="Поиск по разделам"
                className="flex-1 bg-transparent text-[15px] text-[var(--label)] outline-none placeholder:text-[var(--label-secondary)]"
              />
            </div>
          </div>

          {/* «Главное» — desktop rail only */}
          <div className="hidden lg:block">
            <KSection title="Главное" rows={primaryRows} isActive={isActive} query={query} />
          </div>
          <KSection title="Аналитика" rows={analyticsRows} isActive={isActive} query={query} />
          <KSection title="Управление" rows={managementRows} isActive={isActive} query={query} />

          {/* Logout + footer hidden while filtering so search shows only hits */}
          {!query.trim() && (
            <>
              <LogoutRow onLogout={onLogout} />
              <div className="px-5 pt-4 flex flex-col items-center gap-2 text-center">
                <div className="hidden lg:block">
                  <SyncIndicator lastSyncAt={null} />
                </div>
                <div className="text-[12px] text-[var(--label-tertiary)] font-mono tracking-wide">
                  {DISPLAY_VERSION}
                </div>
                <BugReportButton pageLabel="sidebar" />
                <div className="text-[11px] text-[var(--label-tertiary)] leading-tight">
                  <a href="/privacy" className="underline">Конфиденциальность</a>
                  <span className="mx-1.5">·</span>
                  <a href="/terms" className="underline">Условия</a>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

// One iOS-grouped section: a quiet uppercase header + a white rounded
// card of rows. Hidden entirely when the search filter excludes all of
// its rows.
function KSection({
  title,
  rows,
  isActive,
  query,
}: {
  title: string;
  rows: KRowData[];
  isActive: (d: Exclude<DialogType, null>) => boolean;
  query: string;
}) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) => r.label.toLowerCase().includes(q))
    : rows;
  if (filtered.length === 0) return null;
  return (
    <div className="px-4 pt-4">
      <div className="px-3 pb-1.5 text-[13px] font-semibold uppercase tracking-wide text-[var(--label-secondary)]">
        {title}
      </div>
      <div className="bg-[var(--surface-card)] rounded-[14px] overflow-hidden">
        {filtered.map((r, i) => (
          <KRow
            key={r.href}
            row={r}
            active={isActive(r.dialog)}
            last={i === filtered.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function KRow({
  row,
  active,
  last,
}: {
  row: KRowData;
  active: boolean;
  last: boolean;
}) {
  const { icon: Icon, tile, label, href, badge, count } = row;
  const badgeLabel =
    badge !== undefined ? (badge > 99 ? "99+" : String(badge)) : undefined;
  return (
    <Link
      href={href}
      data-testid={`sidebar-nav-${href.split("/").filter(Boolean).pop() ?? "root"}`}
      // STORY-085 — block iOS callout/selection on long-press + kill the
      // 300ms double-tap-zoom delay so the row feels instant.
      style={{
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
        touchAction: "manipulation",
      }}
      className={`flex items-center gap-3 px-3 min-h-[48px] no-underline ${
        active ? "bg-[var(--accent-tint)]" : "active:bg-[var(--fill-quaternary)]"
      } ${last ? "" : "border-b border-[var(--separator)]"}`}
    >
      <span
        className="w-[29px] h-[29px] rounded-[7px] flex items-center justify-center shrink-0"
        style={{ background: tile }}
      >
        <Icon size={17} strokeWidth={2} className="text-white" />
      </span>
      <span
        className={`flex-1 truncate text-[16px] pointer-events-none ${
          active ? "text-[var(--accent)] font-semibold" : "text-[var(--label)]"
        }`}
      >
        {label}
      </span>
      {badgeLabel !== undefined ? (
        <span className="min-w-[21px] h-[21px] px-1.5 bg-[var(--system-red)] rounded-full text-[12px] font-semibold text-[var(--label-on-accent)] flex items-center justify-center tabular-nums">
          {badgeLabel}
        </span>
      ) : count !== undefined ? (
        <span className="text-[16px] text-[var(--label-tertiary)] tabular-nums">
          {count}
        </span>
      ) : null}
      <ChevronRight
        size={17}
        strokeWidth={2}
        className="text-[var(--label-tertiary)] shrink-0"
      />
    </Link>
  );
}

// v688 / v794 — logout keeps its pending feedback (red tile spinner +
// «Выходим…») so the user never double-taps during the 2-3s signOut.
// Now an iOS-style red row in its own card to match the mockup.
function LogoutRow({ onLogout }: { onLogout: () => void }) {
  const [pending, setPending] = useState(false);
  const handleClick = () => {
    if (pending) return;
    setPending(true);
    onLogout();
  };
  return (
    <div className="px-4 pt-5">
      <div className="bg-[var(--surface-card)] rounded-[14px] overflow-hidden">
        <button
          onClick={handleClick}
          disabled={pending}
          data-testid="sidebar-logout"
          className="w-full flex items-center gap-3 px-3 min-h-[48px] active:bg-[var(--fill-quaternary)] disabled:cursor-wait"
        >
          <span className="w-[29px] h-[29px] rounded-[7px] flex items-center justify-center shrink-0 bg-[var(--system-red)]">
            {pending ? (
              <span
                aria-hidden
                className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"
              />
            ) : (
              <LogOut size={17} strokeWidth={2} className="text-white" />
            )}
          </span>
          <span className="flex-1 text-left text-[16px] font-medium text-[var(--system-red)]">
            {pending ? "Выходим…" : "Выход"}
          </span>
        </button>
      </div>
    </div>
  );
}
