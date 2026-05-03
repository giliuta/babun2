"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { registerModalBack } from "@/lib/history-stack";
import {
  Calendar as CalendarIcon,
  Users as UsersIcon,
  UserCircle2,
  RotateCcw,
  Wallet,
  MessageSquare,
  Settings as SettingsIcon,
  LogOut,
  ChevronDown,
} from "@babun/shared/icons";
import { dueReminders } from "@babun/shared/local/recurring";
import { listRecurringReminders } from "@babun/shared/db/repositories/recurring-reminders";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useTenantId } from "@/components/layout/DashboardClientLayout";
import { useRealtimeTenantSync } from "@/hooks/useRealtimeTenantSync";
import { loadChats, getTotalUnread } from "@babun/shared/local/chats";
import { BUILD_VERSION } from "@babun/shared/common/utils/version";
import { ICON_TONE_BG, type IconTone } from "@babun/shared/common/utils/design-tokens";
import { getStorage } from "@babun/shared/storage";

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

const EXPAND_KEY = "babun-sidebar-expanded";

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
  const [expanded, setExpanded] = useState(false);
  const popCloseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Hydrate expanded flag from storage — same pattern as
    // OfflineIndicator / usePwaInstallState. Lint is satisfied by an
    // explicit suppression rather than restructuring the read.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpanded(getStorage().getRaw(EXPAND_KEY) === "1");
  }, []);

  // STORY-058 — hardware-back / iOS edge-swipe closes the drawer
  // instead of falling through to URL navigation. Match the modal
  // pattern used by AppointmentSheet and the install prompts.
  useEffect(() => {
    if (!open) {
      popCloseRef.current?.();
      popCloseRef.current = null;
      return;
    }
    if (popCloseRef.current) return;
    popCloseRef.current = registerModalBack("sidebar", onClose);
  }, [open, onClose]);

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

  const handleNav = (dialog: DialogType) => {
    if (dialog) {
      router.push(ROUTE_MAP[dialog]);
    }
    onClose();
  };

  const isActive = (dialog: Exclude<DialogType, null>) =>
    pathname === ROUTE_MAP[dialog];

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    getStorage().setRaw(EXPAND_KEY, next ? "1" : "0");
  };

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
        className={`fixed top-0 left-0 h-full w-[280px] bg-[var(--surface-grouped)] flex flex-col z-40 transition-transform duration-[250ms] ease-out shadow-[10px_0_30px_-20px_rgba(0,0,0,0.2)] lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Telegram-style brand header — blue wash with white avatar
            ring around the B mark. Stays the identity element of the
            drawer but follows the new accent. */}
        <div className="flex-shrink-0 bg-[var(--accent)] px-4 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[var(--surface-card)] rounded-full flex items-center justify-center text-[var(--accent)] text-[20px] font-bold">
              B
            </div>
            <div className="min-w-0">
              <div className="text-[16px] font-semibold text-[var(--label-on-accent)] leading-tight truncate">
                {tenantName}
              </div>
              <div className="text-[12px] text-white/80 truncate">
                {userEmail}
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          <Group>
            <NavRow
              icon={CalendarIcon}
              tone="orange"
              label="Календарь"
              active={isActive("calendar")}
              onClick={() => handleNav("calendar")}
            />
            <NavRow
              icon={UsersIcon}
              tone="cyan"
              label="Клиенты"
              active={isActive("clients")}
              onClick={() => handleNav("clients")}
            />
            <NavRow
              icon={MessageSquare}
              tone="green"
              label="Чаты"
              badge={unreadChats > 0 ? unreadChats : undefined}
              active={isActive("chats")}
              onClick={() => handleNav("chats")}
            />
            <NavRow
              icon={Wallet}
              tone="yellow"
              label="Финансы"
              active={isActive("finances")}
              onClick={() => handleNav("finances")}
            />
            <NavRow
              icon={RotateCcw}
              tone="red"
              label="Напоминания"
              badge={recurringDue > 0 ? recurringDue : undefined}
              active={isActive("recurring")}
              onClick={() => handleNav("recurring")}
            />
            <NavRow
              icon={SettingsIcon}
              tone="gray"
              label="Настройки"
              active={isActive("settings")}
              onClick={() => handleNav("settings")}
            />
          </Group>

          <button
            type="button"
            onClick={toggleExpanded}
            // STORY-058 — 44px tap target per Apple HIG. min-h hits
            // the floor; vertical content stays centred with flex.
            className="w-full flex items-center gap-2 px-4 min-h-[44px] text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] active:text-[var(--label)] transition"
          >
            <ChevronDown
              size={14}
              className={`transition-transform ${expanded ? "" : "-rotate-90"}`}
            />
            <span className="flex-1 text-left">
              {expanded ? "Скрыть админ-раздел" : "Показать админ-раздел"}
            </span>
          </button>

          {expanded && (
            <Group>
              <NavRow
                icon={UsersIcon}
                tone="blue"
                label="Бригады"
                active={isActive("teams")}
                onClick={() => handleNav("teams")}
              />
              <NavRow
                icon={UserCircle2}
                tone="indigo"
                label="Мастера"
                active={isActive("masters")}
                onClick={() => handleNav("masters")}
              />
              {/* Sprint 033 Phase I29 — "Услуги" sidebar link removed
                  per user feedback. Services are now per-brigade only
                  (edited inside /teams/[id]/services). The global
                  /dashboard/services page file stays on disk for
                  now (in case we bring it back as an admin view)
                  but it's unlinked from navigation. */}
              <NavRow
                icon={MessageSquare}
                tone="mint"
                label="SMS-шаблоны"
                active={isActive("sms-templates")}
                onClick={() => handleNav("sms-templates")}
              />
            </Group>
          )}
        </nav>

        <div className="flex-shrink-0 px-4 py-4 border-t border-[var(--separator)] bg-[var(--surface-card)]">
          <button
            onClick={onLogout}
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

function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface-card)] rounded-[14px] overflow-hidden shadow-[var(--shadow-card)] divide-y divide-[var(--separator)]">
      {children}
    </div>
  );
}

function NavRow({
  icon: Icon,
  tone,
  label,
  badge,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  tone: IconTone;
  label: string;
  badge?: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left min-h-[44px] transition-colors ${
        active ? "bg-[var(--accent-tint)]" : "active:bg-[var(--fill-quaternary)]"
      }`}
    >
      <span
        className={`w-7 h-7 rounded-[7px] flex items-center justify-center text-[var(--label-on-accent)] shrink-0 ${ICON_TONE_BG[tone]}`}
      >
        <Icon size={16} strokeWidth={2} />
      </span>
      <span
        className={`flex-1 truncate text-[15px] ${
          active ? "text-[var(--accent)] font-semibold" : "text-[var(--label)]"
        }`}
      >
        {label}
      </span>
      {badge !== undefined && (
        <span className="min-w-[22px] h-[22px] px-1.5 bg-[var(--system-red)] rounded-full text-[12px] font-semibold text-[var(--label-on-accent)] flex items-center justify-center tabular-nums">
          {badge}
        </span>
      )}
    </button>
  );
}
