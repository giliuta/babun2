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
} from "@babun/shared/icons";
import { dueReminders } from "@babun/shared/local/recurring";
import { listRecurringReminders } from "@babun/shared/db/repositories/recurring-reminders";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useTenantId } from "@/components/layout/DashboardClientLayout";
import { useRealtimeTenantSync } from "@/hooks/useRealtimeTenantSync";
import { loadChats, getTotalUnread } from "@babun/shared/local/chats";
import { BUILD_VERSION } from "@babun/shared/common/utils/version";
// STORY-064 — ICON_TONE_BG dropped in the visual modernization
// (NavRow no longer uses colored tile backgrounds). Type kept for
// the optional `tone` prop on the API to avoid breaking call sites.
import type { IconTone } from "@babun/shared/common/utils/design-tokens";

// Telegram-style drawer (Sprint 031). Accent-blue brand header with
// avatar + company, grouped-list body below with coloured tile icons
// per row. Admin surfaces sit behind a "Показать всё" toggle so the
// primary set doesn't balloon.

export type DialogType =
  | "calendar"
  | "clients"
  | "chats"
  | "finances"
  | "recurring"
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
  /** Live tenant.name from the DB. Renders in the brand row instead of
   *  the legacy "Babun CRM" hardcode. */
  tenantName: string;
  /** Authenticated user's email — caption under the tenant name. */
  userEmail: string;
}

const ROUTE_MAP: Record<Exclude<DialogType, null>, string> = {
  calendar: "/dashboard",
  clients: "/dashboard/clients",
  chats: "/dashboard/chats",
  finances: "/dashboard/finances",
  recurring: "/dashboard/recurring",
  settings: "/dashboard/settings",
  masters: "/dashboard/masters",
  teams: "/dashboard/teams",
  services: "/dashboard/services",
  "sms-templates": "/dashboard/sms-templates",
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

  // STORY-085 — close the drawer when the user navigates to a new
  // route. Tapping a Next.js <Link> changes the pathname; this effect
  // observes that change and runs onClose. Replaces the previous
  // registerModalBack-based close path that was racing with router
  // navigation and undoing it (history.back() ate the new entry).
  // Hardware Back: with the drawer open, browser's native back will
  // navigate away (which is also what Sidebar should do — go back to
  // wherever the user was before opening the drawer), so we no longer
  // need the modal-back sentinel for it either.
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // STORY-050 — recurring reminders live in Supabase. Lazy fetch
  // on mount + on `babun:recurring-changed` (intra-tab signal) +
  // on focus / storage events.
  // STORY-048 — realtime subscription on the same channel keeps the
  // badge live across tabs and devices without F5.
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
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  useEffect(() => {
    // Initial fetch + subscribe to external badge-state signals.
    // refreshBadge ultimately calls setRecurringDue/setUnreadChats;
    // the lint rule sees the synchronous call as a cascading render
    // even though it actually queues an async fetch. Suppress.
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

  // STORY-085 — sidebar nav uses <Link> components directly. No more
  // imperative router.push/replace + close-then-history-back dance —
  // those collided with registerModalBack's history.back, which kept
  // undoing the navigation we'd just pushed. <Link> handles the right
  // navigation primitives internally; pathname-watching effect above
  // closes the drawer when it lands.

  // Prefetch every reachable route on mount so first sidebar tap is
  // instant. <Link> already prefetches on hover/visibility, this is
  // belt-and-suspenders for routes the user hasn't seen yet.
  useEffect(() => {
    Object.values(ROUTE_MAP).forEach((path) => router.prefetch(path));
  }, [router]);

  const isActive = (dialog: Exclude<DialogType, null>) =>
    pathname === ROUTE_MAP[dialog];

  return (
    <>
      {open && (
        <div
          // STORY-058 — frosted-glass backdrop. backdrop-filter blurs
          // and saturates the dashboard underneath; black/30 gives a
          // clear scrim signal on top of the blur so the dim still
          // reads on light wallpapers. lg:hidden — desktop pins the
          // drawer. STORY-060 follow-up: fade-in transition on this
          // backdrop's opacity (200ms) for polish; today it pops in
          // with the panel slide.
          className="fixed inset-0 z-30 lg:hidden bg-black/30 [backdrop-filter:blur(20px)_saturate(180%)] [-webkit-backdrop-filter:blur(20px)_saturate(180%)]"
          onClick={onClose}
        />
      )}

      <aside
        // STORY-060 — explicit landmark + label so screen readers
        // announce "Главная навигация" and the drawer shows up in the
        // rotor. We don't add aria-hidden when the drawer is closed
        // because on lg+ it's always visible (the closed state on
        // mobile is layout-only, controlled by the translate-x class
        // — the breakpoint isn't React-aware here, so a JS-driven
        // aria-hidden would lie about the desktop state).
        role="navigation"
        aria-label="Главная навигация"
        // STORY-056 — sidebar width was 280 px while <main> offset
        // was lg:ml-[240px] — the last 40 px of the sidebar overlapped
        // page content on desktop.  On mobile the drawer keeps its
        // generous 280 px (fits Apple HIG list rows comfortably).  On
        // lg+ we shrink to 240 px so the offsets line up.  Border on
        // the right replaces the previous offscreen-only shadow.
        className={`fixed top-0 left-0 h-full w-[280px] lg:w-[240px] bg-[var(--surface-grouped)] flex flex-col z-40 transition-transform duration-[250ms] ease-out shadow-[10px_0_30px_-20px_rgba(0,0,0,0.2)] lg:shadow-none lg:border-r lg:border-[var(--separator)] ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* STORY-064 — quieter brand header. The full-bleed accent
            wash read as loud + dated against the iOS-grouped tile
            grid below it; switched to surface-card with the brand
            mark using the unified gradient. Tenant name in primary
            label, email in secondary — same hierarchy as the iOS
            Settings header. */}
        <div className="flex-shrink-0 bg-[var(--surface-card)] px-4 pt-6 pb-5 border-b border-[var(--separator)]">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-[14px] flex items-center justify-center text-white text-[20px] font-bold tracking-tight shadow-[0_2px_6px_rgba(62,136,247,0.18)]"
              style={{ background: "var(--brand-mark-grad)" }}
            >
              B
            </div>
            <div className="min-w-0">
              <div className="text-[16px] font-semibold text-[var(--label)] leading-tight truncate">
                {tenantName}
              </div>
              <div className="text-[12px] text-[var(--label-secondary)] truncate">
                {userEmail}
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <Group>
            <NavRow
              icon={CalendarIcon}
              tone="orange"
              label="Календарь"
              href={ROUTE_MAP.calendar}
              active={isActive("calendar")}
            />
            <NavRow
              icon={UsersIcon}
              tone="cyan"
              label="Клиенты"
              href={ROUTE_MAP.clients}
              active={isActive("clients")}
            />
            <NavRow
              icon={MessageSquare}
              tone="green"
              label="Чаты"
              href={ROUTE_MAP.chats}
              badge={unreadChats > 0 ? unreadChats : undefined}
              active={isActive("chats")}
            />
            <NavRow
              icon={Wallet}
              tone="yellow"
              label="Финансы"
              href={ROUTE_MAP.finances}
              active={isActive("finances")}
            />
            <NavRow
              icon={RotateCcw}
              tone="red"
              label="Напоминания"
              href={ROUTE_MAP.recurring}
              badge={recurringDue > 0 ? recurringDue : undefined}
              active={isActive("recurring")}
            />
            <NavRow
              icon={SettingsIcon}
              tone="gray"
              label="Настройки"
              href={ROUTE_MAP.settings}
              active={isActive("settings")}
            />
          </Group>

          {/* v479 — admin section is always visible. The collapse
              toggle was hiding Команды / Мастера / SMS-шаблоны behind
              an extra tap; user wants the full sidebar laid out top
              to bottom in a single ordered list. */}
          <Group>
            <NavRow
              icon={UsersIcon}
              tone="blue"
              label="Команды"
              href={ROUTE_MAP.teams}
              active={isActive("teams")}
            />
            <NavRow
              icon={UserCircle2}
              tone="indigo"
              label="Мастера"
              href={ROUTE_MAP.masters}
              active={isActive("masters")}
            />
            {/* Sprint 033 Phase I29 — "Услуги" sidebar link removed
                per user feedback. Services are now per-brigade only
                (edited inside /teams/[id]/services). */}
            <NavRow
              icon={MessageSquare}
              tone="mint"
              label="SMS-шаблоны"
              href={ROUTE_MAP["sms-templates"]}
              active={isActive("sms-templates")}
            />
          </Group>
        </nav>

        <div className="flex-shrink-0 px-4 py-4 border-t border-[var(--separator)] bg-[var(--surface-card)]">
          <button
            onClick={onLogout}
            data-testid="sidebar-logout"
            // STORY-058 — 44px tap target. Negative left padding pulls
            // the icon back to the column edge so the visible label
            // stays aligned with the build-version row below it.
            className="flex items-center gap-2 min-h-[44px] -ml-1 px-1 text-[14px] text-[var(--system-red)] active:opacity-70 transition"
          >
            <LogOut size={16} strokeWidth={2} />
            Выход
          </button>
          <div className="text-[12px] text-[var(--label-tertiary)] mt-3 flex items-center gap-1 tabular-nums">
            <span>Синхр.</span>
            <SyncTime />
          </div>
          <div className="text-[12px] text-[var(--label-tertiary)] mt-1 font-mono tracking-wide">
            {BUILD_VERSION}
          </div>
          <div className="text-[11px] text-[var(--label-tertiary)] mt-3 leading-tight">
            <a href="/privacy" className="underline">Конфиденциальность</a>
            <span className="mx-1.5">·</span>
            <a href="/terms" className="underline">Условия</a>
          </div>
        </div>
      </aside>
    </>
  );
}

function SyncTime() {
  const [label, setLabel] = useState<string>("…");
  useEffect(() => {
    const tick = () =>
      setLabel(
        new Date().toLocaleString("ru-RU", {
          timeZone: "Asia/Nicosia",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    tick();
    const t = window.setInterval(tick, 60_000);
    return () => window.clearInterval(t);
  }, []);
  return <span suppressHydrationWarning>{label}</span>;
}

// STORY-064 — Group used to be a card-shaped wrapper with row
// dividers. Rows are now self-contained rounded pills, so Group is
// just a vertical stack with breathing room between sections.
function Group({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col">{children}</div>;
}

// STORY-064 — NavRow visual modernization. Was a 7×7 colored tile
// per row (orange Calendar, cyan Clients, green Chats, ...) which
// felt loud and dated against the rest of the iOS-grouped UI. Now:
//   * Monochrome stroke icon — accent on active, secondary label
//     elsewhere. Single source of brand colour, less visual noise.
//   * Bumped icon size 16 → 20 px for legibility (still fits the
//     44 px row floor).
//   * Active row gets an accent-tint pill behind the WHOLE row
//     plus accent-coloured text. Reads instantly as "selected"
//     without needing the colored tile.
//   * `tone` prop kept on the API to avoid breaking call sites,
//     but no longer drives the visual.
function NavRow({
  icon: Icon,
  href,
  label,
  badge,
  active,
}: {
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
  tone?: IconTone;
  href: string;
  label: string;
  badge?: number;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      data-testid={`sidebar-nav-${href.split("/").filter(Boolean).pop() ?? "root"}`}
      // STORY-085 — block iOS callout/selection menu on long-press +
      // kill 300ms double-tap-zoom delay so the row feels instant.
      style={{
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
        touchAction: "manipulation",
      }}
      className={`w-full flex items-center gap-3 px-3 mx-1 my-0.5 rounded-[10px] text-left min-h-[44px] transition-colors no-underline ${
        active
          ? "bg-[var(--accent-tint)]"
          : "active:bg-[var(--fill-quaternary)]"
      }`}
    >
      <Icon
        size={20}
        strokeWidth={2}
        className={
          active
            ? "text-[var(--accent)] shrink-0"
            : "text-[var(--label-secondary)] shrink-0"
        }
      />
      <span
        className={`flex-1 truncate text-[15px] pointer-events-none ${
          active
            ? "text-[var(--accent)] font-semibold"
            : "text-[var(--label)] font-medium"
        }`}
      >
        {label}
      </span>
      {badge !== undefined && (
        <span className="min-w-[22px] h-[22px] px-1.5 bg-[var(--system-red)] rounded-full text-[12px] font-semibold text-[var(--label-on-accent)] flex items-center justify-center tabular-nums">
          {badge}
        </span>
      )}
    </Link>
  );
}
