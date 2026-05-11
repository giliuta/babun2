"use client";

import {
  Suspense,
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  MouseSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { getMonday, addWeeks, addDays, formatDateLongRu } from "@babun/shared/common/utils/date-utils";
import type { Client } from "@babun/shared/local/clients";
import { getTeamSchedule, timeToMinutes, type TeamSchedule } from "@babun/shared/local/schedule";
import {
  type Appointment,
  validateAppointment,
  duplicateAppointment,
  createBlankAppointment,
} from "@babun/shared/local/appointments";
import Header, { type ViewMode } from "@/components/layout/Header";
import PageHeader from "@/components/layout/PageHeader";
import { Menu } from "@babun/shared/icons";
import WeekView from "@/components/calendar/WeekView";
import { useTenantQuota } from "@/lib/quota/useTenantQuota";
import QuotaBanner from "@/components/quota/QuotaBanner";
import { CalendarEmptyState } from "@/components/empty-states/CalendarEmptyState";
import { usePersonalCalendarEnabled } from "@/hooks/usePersonalCalendarEnabled";
import { FirstRunCalendarChoice } from "@/components/empty-states/FirstRunCalendarChoice";
import SwipeableCalendar from "@/components/calendar/SwipeableCalendar";
import TimeColumn from "@/components/calendar/TimeColumn";
import UndoToast from "@/components/ui/UndoToast";
import { BUILD_VERSION } from "@babun/shared/common/utils/version";
import { haptic } from "@/lib/haptics";

// Modal/sheet components: lazy-loaded so the calendar shell paints
// without their JS in the initial parse step. WeekView + Swipeable-
// Calendar + TimeColumn stay eagerly imported because they render
// every mount; MonthView and the seven sheets/modals below render
// only on demand (mode toggle, slot tap, day tap, etc.).
const MonthView = dynamic(() => import("@/components/calendar/MonthView"), {
  ssr: false,
});
const CityPickerModal = dynamic(
  () => import("@/components/calendar/CityPickerModal"),
  { ssr: false },
);
const DayFinanceModal = dynamic(
  () => import("@/components/calendar/DayFinanceModal"),
  { ssr: false },
);
const SpecialScheduleModal = dynamic(
  () => import("@/components/calendar/SpecialScheduleModal"),
  { ssr: false },
);
const RepeatCopyModal = dynamic(
  () => import("@/components/calendar/RepeatCopyModal"),
  { ssr: false },
);
const AppointmentSheet = dynamic(
  () => import("@/components/appointment/AppointmentSheet"),
  { ssr: false },
);
const PersonalEventSheet = dynamic(
  () => import("@/components/calendar/PersonalEventSheet"),
  { ssr: false },
);
import ActionMenuModal, {
  type ActionMenuOption,
} from "@/components/calendar/ActionMenuModal";
import {
  useSidebar,
  useSchedules,
  useTeams,
  useCurrentMaster,
  useMasters,
  useAppointments,
  useFormSettings,
  useServices,
  useClients,
  useDayCities,
  useDayExtras,
  useCalendarSettings,
  useCities,
} from "@/components/layout/DashboardClientLayout";
import { getTeamDisplayName } from "@babun/shared/local/masters";
import { sumExtras } from "@babun/shared/local/day-extras";
import { loadChats } from "@babun/shared/local/chats";
// Post-save and finance/reschedule sheets — also lazy. SuccessOverlay
// is the brief checkmark animation after a save; PaymentSheet and
// ExpenseSheet open from the day-finance modal; RescheduleSheet
// opens via the appointment action menu. None of them paint on the
// initial render path.
const SuccessOverlay = dynamic(
  () => import("@/components/appointment/SuccessOverlay"),
  { ssr: false },
);
const PaymentSheet = dynamic(
  () => import("@/components/finance/PaymentSheet"),
  { ssr: false },
);
const ExpenseSheet = dynamic(
  () => import("@/components/finance/ExpenseSheet"),
  { ssr: false },
);
const RescheduleSheet = dynamic(
  () => import("@/components/calendar/RescheduleSheet"),
  { ssr: false },
);
import { EXPENSE_CATEGORIES } from "@babun/shared/local/finance/expense-categories";
import DaySummaryStrip from "@/components/layout/DaySummaryStrip";
import EndOfDayBanner from "@/components/layout/EndOfDayBanner";
import MorningBriefing from "@/components/layout/MorningBriefing";


import {
  useCalendarGestures,
  clampHourHeight,
  HOUR_HEIGHT_DEFAULT,
  HOUR_HEIGHT_STEP,
} from "@/hooks/useCalendarGestures";
import { getStorage } from "@babun/shared/storage";

// How many days to advance per "next" / "prev" depending on view mode.
// "month" uses a dedicated branch that jumps whole months.
const STEP_DAYS: Record<ViewMode, number> = {
  day: 1,
  "3days": 3,
  week: 7,
  month: 0,
};

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Next 16 requires `useSearchParams()` to live inside a Suspense
// boundary — without it, prerender of `/dashboard` aborts with
// "useSearchParams() should be wrapped in a suspense boundary"
// (Sprint 019 introduced the hook in DashboardPageInner; that broke
// prod build for sprints 021-023, fixed here).
//
// The fallback is `null` because the body of the dashboard hydrates
// inside the layout's existing `<main>` and we don't want a flash of
// chrome before client takeover.
export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPageInner />
    </Suspense>
  );
}

function DashboardPageInner() {
  // STORY-052 G6 — quota state for the calendar's appointments_month banner.
  const { snapshot: quotaSnap } = useTenantQuota();
  const router = useRouter();
  // STORY-085 — first-run gate. When the tenant has no teams configured
  // AND personal_calendar_enabled is false, the calendar grid is
  // meaningless. We render <FirstRunCalendarChoice> instead, asking
  // the owner how they'll use the calendar (personal vs team).
  const personalCal = usePersonalCalendarEnabled();
  // Tracks `?new=1&kind=…` transitions so the create-sheet handler
  // re-runs when the FAB navigates here while we're already on
  // /dashboard. Using the search-params string as a stable dependency
  // keeps the effect predictable.
  const searchParams = useSearchParams();
  const searchString = searchParams?.toString() ?? "";
  const sidebar = useSidebar();
  const { schedules, setSchedules } = useSchedules();
  const { teams, setTeams } = useTeams();
  const { getCityFor, setCityFor } = useDayCities();
  const { getExtrasFor, setExtrasFor } = useDayExtras();
  const { calendarSettings } = useCalendarSettings();
  const { cities } = useCities();
  const { appointments, upsertAppointment, deleteAppointment } = useAppointments();
  const { requiredFields } = useFormSettings();
  const { services, categories: serviceCategories } = useServices();
  const { clients } = useClients();
  const { masters } = useMasters();
  const { currentMasterId } = useCurrentMaster();

  // Sprint 033 Phase I37 — sentinel tab id for the current master's
  // personal calendar. Lives alongside real team ids on `teamTabs`.
  const PERSONAL_TAB_ID = "__personal__";
  const currentMaster = useMemo(
    () => masters.find((m) => m.id === currentMasterId) ?? null,
    [masters, currentMasterId],
  );

  // Header tabs need a stable shape: { id, name }. Sprint 025 (STORY-009):
  // show "Юра + Даня · Пафос" rather than the terse codename "Y&D" — the
  // dispatcher recognises faces, the tabs are rarely read by anyone else.
  //
  // v462 — personal tab is ALWAYS present, even when masters list is
  // empty (fresh PWA install / new device / before any team setup).
  // Previously the tab disappeared without a currentMaster, which left
  // the user staring at an empty calendar with no way to create
  // personal events — a critical first-run regression. Name falls
  // back to «Мой календарь» when no master display name is known.
  const teamTabs = useMemo(() => {
    const brigadeTabs = teams
      .filter((t) => t.active)
      .map((t) => ({ id: t.id, name: getTeamDisplayName(t, masters) }));
    const personalName =
      currentMaster?.personal_calendar_name?.trim() || "Мой календарь";
    return [
      { id: PERSONAL_TAB_ID, name: personalName },
      ...brigadeTabs,
    ];
  }, [teams, masters, currentMaster]);
  // SSR-safe: start on a deterministic epoch Monday, then move to today
  // in useEffect after mount. Previous `getMonday(new Date())` in the
  // initializer caused a hydration mismatch (Vercel's build clock vs
  // the client's clock diverged across Cyprus midnight on a cached HTML).
  const SSR_SAFE_MONDAY = useMemo(() => new Date(2026, 0, 5), []); // fixed seed
  const [currentMonday, setCurrentMonday] = useState<Date>(SSR_SAFE_MONDAY);
  const [activeTeamId, setActiveTeamId] = useState<string>("");
  useEffect(() => {
    setCurrentMonday(getMonday(new Date()));
  }, []);

  // When teams load (or change), make sure the active team is still
  // valid. Sprint 033 Phase I25 — also honour `?team=<id>` from the
  // URL the first time we see a matching tab, so /dashboard/teams's
  // "Открыть календарь" deep-link lands on the right brigade.
  const pendingTeamParamRef = useRef<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const teamParam = sp.get("team");
    if (teamParam) {
      pendingTeamParamRef.current = teamParam;
    }
  }, []);
  useEffect(() => {
    if (teamTabs.length === 0) {
      setActiveTeamId("");
      return;
    }
    const pending = pendingTeamParamRef.current;
    if (pending && teamTabs.some((t) => t.id === pending)) {
      setActiveTeamId(pending);
      pendingTeamParamRef.current = null;
      // Strip the param from the URL so the user can refresh without
      // getting stuck on this brigade.
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("team");
        window.history.replaceState({}, "", url.toString());
      }
      return;
    }
    if (!teamTabs.some((t) => t.id === activeTeamId)) {
      setActiveTeamId(teamTabs[0].id);
    }
  }, [teamTabs, activeTeamId]);

  // Restore last-used view mode from localStorage after mount so server
  // and client render the same tree. Server always ships "week"; the
  // phone may then upgrade to "day" based on its own width + saved pref.
  const VIEW_MODE_KEY = "babun-view-mode";
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  useEffect(() => {
    const saved = getStorage().getRaw(VIEW_MODE_KEY) as ViewMode | null;
    if (saved && ["day", "3days", "week", "month"].includes(saved)) {
      setViewMode(saved);
      return;
    }
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setViewMode("day");
    }
  }, []);
  // Persist whenever the user switches
  useEffect(() => {
    getStorage().setRaw(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);
  // hourHeight is not React state — it lives in a ref and is written as
  // a CSS variable on the outer scroller via writeHourHeight(). This keeps
  // pinch-zoom off the React render path entirely.
  const hourHeightRef = useRef(HOUR_HEIGHT_DEFAULT);

  const stepDays = STEP_DAYS[viewMode];

  // Sprint 033 — brigade calendar window. Must be computed BEFORE any
  // effect that reads it (scroll-to-time sits near the top of the
  // component). teams array is already captured above.
  //
  // v444 — personal-tab fix. Was: this memo only consulted the
  // brigade's `calendar_window_start/end`, so for the personal tab
  // (where `at` is undefined) it always returned 0..24 — which made
  // "Видимое время" in the personal-calendar settings page look
  // completely dead: the user changed the value, saved, but the grid
  // kept rendering the full day. Now the personal tab uses
  // calendarSettings.startHour/endHour, brigade tabs keep their
  // per-team override.
  const windowBounds = useMemo(() => {
    if (activeTeamId === PERSONAL_TAB_ID) {
      const wsRaw = calendarSettings.startHour;
      const weRaw = calendarSettings.endHour;
      const ws = Math.max(0, Math.min(23, wsRaw));
      const we = Math.max(ws + 1, Math.min(24, weRaw));
      return { windowStart: ws, windowEnd: we };
    }
    const parseHour = (s: string | undefined | null): number | null => {
      if (!s || !/^\d{1,2}:\d{2}$/.test(s)) return null;
      const [h, m] = s.split(":").map(Number);
      const val = h + m / 60;
      return val >= 0 && val <= 24 ? val : null;
    };
    const at = teams.find((t) => t.id === activeTeamId);
    const ws = parseHour(at?.calendar_window_start) ?? 0;
    const weRaw = parseHour(at?.calendar_window_end) ?? 24;
    const we = Math.max(ws + 1, Math.min(24, weRaw));
    return { windowStart: ws, windowEnd: we };
  }, [teams, activeTeamId, calendarSettings.startHour, calendarSettings.endHour]);
  const { windowStart, windowEnd } = windowBounds;

  // v477 — personal tab pulls its work hours from CalendarSettings
  // (Видимое время / Рабочее время on /settings/calendar). Brigades
  // keep their per-team TeamSchedule. Without this override the
  // personal tab fell back to DEFAULT_SCHEDULE (08:00–22:00), so
  // changing «Рабочее время» in settings did nothing visible — the
  // off-hours wash kept lighting up the OLD 22:00 boundary on top of
  // the new one from CalendarSettings, creating a double-shaded
  // bottom strip.
  const activeSchedule = useMemo(() => {
    if (activeTeamId === PERSONAL_TAB_ID) {
      const ws = Math.max(
        0,
        Math.min(23, calendarSettings.workStartHour ?? calendarSettings.startHour),
      );
      const we = Math.max(
        ws + 1,
        Math.min(24, calendarSettings.workEndHour ?? calendarSettings.endHour),
      );
      const fmt = (h: number) =>
        `${String(Math.min(23, h)).padStart(2, "0")}:${h >= 24 ? "59" : "00"}`;
      return { start: fmt(ws), end: fmt(we), breaks: [] };
    }
    return getTeamSchedule(activeTeamId, schedules);
  }, [
    activeTeamId,
    schedules,
    calendarSettings.workStartHour,
    calendarSettings.workEndHour,
    calendarSettings.startHour,
    calendarSettings.endHour,
  ]);

  // Single shared vertical scroller for time column + day columns
  const outerScrollerRef = useRef<HTMLDivElement>(null);

  // Write --hh on the scroller and update the ref. Does NOT touch React
  // state — intended for the hot path during pinch-zoom.
  const writeHourHeight = useCallback((h: number) => {
    hourHeightRef.current = h;
    const el = outerScrollerRef.current;
    if (el) el.style.setProperty("--hh", `${h}px`);
  }, []);

  // Initialize the CSS variable before paint so the first render already
  // has the correct layout without going through state. Also re-runs
  // whenever the outer scroller is remounted (e.g. after switching from
  // month view back to week) so the freshly-mounted DOM picks up --hh
  // before the user sees a blank "0 px" grid.
  useLayoutEffect(() => {
    writeHourHeight(hourHeightRef.current);
  }, [writeHourHeight, viewMode]);

  // v326 — Kill iOS rubber-band overscroll on the calendar.
  //
  // Two layered defenses, both required because iOS standalone PWA
  // ignores `overscroll-behavior: none` on inner scrollers
  // (WebKit bug 218809, open since 2020):
  //
  //   1. Scroll-one-pixel-from-edge.  When scrollTop falls to 0 or
  //      reaches the bottom, nudge it inward by 1 px.  This keeps
  //      the scroller off the absolute edge, so iOS never enters
  //      rubber-band mode in the first place.  Used in production
  //      by Telegram WebApp, Twitter PWA, and several Apple Maps
  //      embeds.  The 1 px shift is visually undetectable.
  //
  //   2. Document-level capture-phase touchmove preventDefault.
  //      Belt-and-braces for the rare frame where scrollTop is 0
  //      but the user has already started a downward pull.  We
  //      cancel the gesture before SwipeableCalendar's own touch
  //      handlers (capture: true) and only when the touch starts
  //      inside our scroller.  Pinch-zoom (>1 finger) is skipped.
  useEffect(() => {
    const el = outerScrollerRef.current;
    if (!el) return;

    // Layer 1 — scrollTop nudge.
    const nudge = () => {
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 2) return;
      if (el.scrollTop <= 0) el.scrollTop = 1;
      else if (el.scrollTop >= max) el.scrollTop = max - 1;
    };
    // Initial nudge — without it the first frame still sits at 0.
    queueMicrotask(nudge);
    el.addEventListener("scroll", nudge, { passive: true });

    // Layer 2 — touchmove preventDefault on edge.
    let lastY = 0;
    const within = (target: EventTarget | null) =>
      target instanceof Node && el.contains(target);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || !within(e.target)) return;
      lastY = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 1 || !within(e.target)) return;
      const y = e.touches[0].clientY;
      const dy = y - lastY;
      lastY = y;
      const top = el.scrollTop;
      const max = el.scrollHeight - el.clientHeight;
      if ((top <= 1 && dy > 0) || (top >= max - 1 && dy < 0)) {
        e.preventDefault();
      }
    };
    document.addEventListener("touchstart", onStart, {
      passive: true,
      capture: true,
    });
    document.addEventListener("touchmove", onMove, {
      passive: false,
      capture: true,
    });
    return () => {
      el.removeEventListener("scroll", nudge);
      document.removeEventListener("touchstart", onStart, true);
      document.removeEventListener("touchmove", onMove, true);
    };
  }, [viewMode]);

  // Scroll to startHour on mount and when view changes from month to day/week.
  // When the current day is actually visible in the range, anchor on the
  // now-line at ~30 % of viewport so the dispatcher sees "2 h ago plus
  // what's coming" instead of stale morning hours.
  //
  // Sprint 033 — brigade-as-hub: if the active brigade has its own
  // `default_scroll_time` set (edit on /dashboard/teams/:id → section
  // "Календарь бригады"), it wins over both the settings startHour and
  // the now-line anchor. This way switching to a nightshift brigade
  // opens its calendar at the right time immediately.
  // Pull default_scroll_time off the currently-active team into a
  // primitive string so the scroll effect below fires when THIS field
  // changes — not only when the brigade id or window bounds change.
  // Previously editing /teams/[id]/calendar → "Открывать на" didn't
  // trigger a re-scroll because the effect deps didn't include it.
  const activeBrigadeScroll = useMemo(() => {
    const t = teams.find((x) => x.id === activeTeamId);
    return t?.default_scroll_time ?? "";
  }, [teams, activeTeamId]);

  // Phase I36 — snap + default-duration for empty-cell taps. Reads
  // brigade.default_slot_minutes (15/30/60); falls back to 30 as a
  // sensible middle ground when the brigade has never set one.
  const activeSlotMinutes = useMemo<number>(() => {
    const t = teams.find((x) => x.id === activeTeamId);
    const raw = t?.default_slot_minutes;
    if (raw === 15 || raw === 30 || raw === 60) return raw;
    return 30;
  }, [teams, activeTeamId]);

  useLayoutEffect(() => {
    if (viewMode === "month") return;
    const el = outerScrollerRef.current;
    if (!el) return;
    const now = new Date();
    const stepDays = STEP_DAYS[viewMode];
    const rangeEnd = new Date(currentMonday);
    rangeEnd.setDate(rangeEnd.getDate() + stepDays);
    const todayVisible = now >= currentMonday && now < rangeEnd;
    const hh = hourHeightRef.current;
    // Absolute-hour → grid-offset helper. With a brigade window the
    // grid starts at windowStart hours, so visual top = (hour - windowStart) * hh.
    const toTop = (hourValue: number) =>
      Math.max(0, (hourValue - windowStart) * hh);
    // v443 — auto-scroll target. The user's "Открывается время"
    // setting wins. Fall back to the work-start, then the visible
    // start, so an existing tenant who never opened the new settings
    // still lands on a sane row instead of 00:00.
    const scrollTarget =
      calendarSettings.scrollOpenHour ??
      calendarSettings.workStartHour ??
      calendarSettings.startHour;
    let targetTop = toTop(Math.max(scrollTarget, windowStart));

    // Brigade-level "Открывать на" override. When set, it wins over the
    // now-line anchor and the global startHour.
    if (activeBrigadeScroll && /^\d{1,2}:\d{2}$/.test(activeBrigadeScroll)) {
      const [bh, bm] = activeBrigadeScroll.split(":").map(Number);
      const brigadeHours = bh + bm / 60;
      const viewportOffset = el.clientHeight * 0.15;
      targetTop = Math.max(0, toTop(brigadeHours) - viewportOffset);
    } else if (todayVisible) {
      const hoursNow = now.getHours() + now.getMinutes() / 60;
      const workStart =
        calendarSettings.workStartHour ?? calendarSettings.startHour;
      const workEnd =
        calendarSettings.workEndHour ?? calendarSettings.endHour;
      const inWorkHours = hoursNow >= workStart - 0.5 && hoursNow <= workEnd;
      if (inWorkHours && hoursNow >= windowStart && hoursNow <= windowEnd) {
        const nowTop = toTop(hoursNow);
        const viewportOffset = el.clientHeight * 0.3;
        targetTop = Math.max(toTop(scrollTarget), nowTop - viewportOffset);
      }
    }

    // Belt-and-suspenders scroll commit. iOS Safari can swallow a
    // single scrollTop write during layout shifts triggered by
    // DayColumn re-mounting on brigade swap. We write it:
    //   1. synchronously (current paint frame)
    //   2. one rAF later (after React finishes child effects)
    //   3. two rAFs later (covers the case where --hh or window
    //      bounds were still mid-application)
    // Each write clamps against the live scrollHeight so a newly-
    // narrowed brigade grid doesn't land us past the end.
    const assertScroll = () => {
      const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
      el.scrollTop = Math.min(targetTop, maxTop);
    };
    assertScroll();
    requestAnimationFrame(() => {
      assertScroll();
      requestAnimationFrame(assertScroll);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    viewMode,
    activeTeamId,
    windowStart,
    windowEnd,
    activeBrigadeScroll,
    // v444 — re-scroll when the personal-cal settings change so the
    // user sees their new "Открывается время" land immediately after
    // pressing Save instead of needing a tab switch to nudge the grid.
    calendarSettings.scrollOpenHour,
    calendarSettings.workStartHour,
    calendarSettings.workEndHour,
  ]);

  const { zoomBy, handleZoomIn, handleZoomOut } = useCalendarGestures({
    outerScrollerRef,
    hourHeightRef,
    writeHourHeight,
    windowDurationHours: windowEnd - windowStart,
  });

  // STORY-043 G1 — MOCK_APPOINTMENTS seed-on-mount removed. Pre-cloud
  // it filled an empty calendar with demo data; post-STORY-042 it
  // wrote those demo rows straight to Supabase, polluting fresh
  // tenants and duplicating across devices on first visit. Fresh
  // tenants now land on a genuinely empty calendar.

  // Filter appointments by active tab. Personal tab shows only this
  // master's private events (master_id === current, team_id falsy).
  // Brigade tabs show that brigade's appointments, and deliberately
  // exclude personal ones so no-one else sees them.
  const isPersonalTab = activeTeamId === PERSONAL_TAB_ID;
  const visibleAppointments = useMemo(() => {
    if (isPersonalTab) {
      // v462 — without a currentMaster (fresh PWA, no masters yet)
      // fall back to "all personal events not bound to a brigade".
      // RLS from v459 already restricts SELECT to created_by = auth.uid()
      // server-side, so this won't leak other users' events; locally
      // there's nothing else to leak (single-user state). Without this
      // fallback the personal grid stays empty even after the user
      // creates their first event, because master_id ends up null too.
      if (!currentMasterId) {
        return appointments.filter(
          (a) => (a.kind === "event" || a.kind === "personal") && !a.team_id,
        );
      }
      return appointments.filter(
        (a) => a.master_id === currentMasterId && !a.team_id,
      );
    }
    return appointments.filter(
      (a) => a.team_id === activeTeamId && !a.master_id,
    );
  }, [appointments, activeTeamId, isPersonalTab, currentMasterId]);

  // Build clientsById map. STORY-007: Draft clients removed —
  // layout.tsx keeps `clients` fresh via the babun:clients-changed
  // event so we read it directly.
  const clientsById = useMemo<Record<string, Client>>(() => {
    const map: Record<string, Client> = {};
    for (const c of clients) map[c.id] = c;
    return map;
  }, [clients]);

  // Team colour resolver for appointment blocks — used to paint the
  // left accent stripe so "this one's Y&D, this one's D&K" is visible
  // without reading the team label.
  const teamColorFor = useCallback(
    (apt: Appointment) => {
      if (!apt.team_id) return null;
      const t = teams.find((t) => t.id === apt.team_id);
      return t?.color ?? null;
    },
    [teams]
  );

  // Validation closure
  const validateApt = useCallback(
    (apt: Appointment) => {
      const client = apt.client_id ? clientsById[apt.client_id] : null;
      const hasPhone = client ? Boolean(client.phone) : false;
      return validateAppointment(apt, requiredFields, hasPhone);
    },
    [clientsById, requiredFields]
  );

  const advance = useCallback(
    (direction: -1 | 1) => {
      setCurrentMonday((prev) => {
        if (viewMode === "month") {
          // Jump to the Monday of the first week of the prev/next month.
          const next = new Date(prev);
          next.setDate(1);
          next.setMonth(next.getMonth() + direction);
          return getMonday(next);
        }
        if (viewMode === "week") return addWeeks(prev, direction);
        return addDays(prev, direction * stepDays);
      });
    },
    [viewMode, stepDays]
  );

  const handlePrevWeek = useCallback(() => advance(-1), [advance]);
  const handleNextWeek = useCallback(() => advance(1), [advance]);

  const handleToday = useCallback(() => {
    setCurrentMonday(getMonday(new Date()));
  }, []);

  const handleTeamChange = useCallback((teamId: string) => {
    setActiveTeamId(teamId);
  }, []);

  // Long-press on a team tab swaps its position with the next team
  // in the list (wraps around). Lets the dispatcher re-order the
  // brigade tabs from the header.
  const handleTeamLongPress = useCallback(
    (teamId: string) => {
      const idx = teams.findIndex((t) => t.id === teamId);
      if (idx === -1 || teams.length < 2) return;
      const nextIdx = (idx + 1) % teams.length;
      const next = [...teams];
      [next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];
      setTeams(next);
    },
    [teams, setTeams]
  );

  // Inline sheet state — keeping the calendar mounted means opening and
  // closing an appointment is instant (no route transition, no unmount).
  const [inlineSheet, setInlineSheet] = useState<
    | { mode: "new" | "edit"; initial: Appointment }
    | null
  >(null);

  // Day finance modal state
  const [financeDateKey, setFinanceDateKey] = useState<string | null>(null);

  // Special-schedule modal — override working hours for a single date
  const [specialScheduleDate, setSpecialScheduleDate] = useState<string | null>(
    null
  );

  // Repeat-copy modal — duplicate an appointment N times at a cadence
  const [repeatSource, setRepeatSource] = useState<Appointment | null>(null);

  // Undo toast state — generic, reused for delete / cancel / status
  // change. On undo we run the stored restore callback.
  const [undoToast, setUndoToast] = useState<{
    message: string;
    restore: () => void;
  } | null>(null);

  const handleQuickStatus = useCallback(
    (apt: Appointment, next: Appointment["status"]) => {
      haptic(next === "completed" ? "success" : "tap");
      const prev = apt.status;
      upsertAppointment({
        ...apt,
        status: next,
        updated_at: new Date().toISOString(),
      });
      const labels: Record<Appointment["status"], string> = {
        scheduled: "Запланирована",
        in_progress: "В работе",
        completed: "Выполнена",
        cancelled: "Отменена",
      };
      setUndoToast({
        message: `Статус → ${labels[next]}`,
        restore: () =>
          upsertAppointment({
            ...apt,
            status: prev,
            updated_at: new Date().toISOString(),
          }),
      });
    },
    [upsertAppointment]
  );

  const handleCancelToggle = useCallback(
    (apt: Appointment) => {
      haptic("warning");
      const prev = apt.status;
      const next = prev === "cancelled" ? "scheduled" : "cancelled";
      upsertAppointment({
        ...apt,
        status: next,
        updated_at: new Date().toISOString(),
      });
      setUndoToast({
        message: next === "cancelled" ? "Запись отменена" : "Запись восстановлена",
        restore: () =>
          upsertAppointment({
            ...apt,
            status: prev,
            updated_at: new Date().toISOString(),
          }),
      });
    },
    [upsertAppointment]
  );

  const handleDeleteWithUndo = useCallback(
    (apt: Appointment) => {
      haptic("error");
      deleteAppointment(apt.id);
      setUndoToast({
        message: "Запись удалена",
        restore: () => upsertAppointment(apt),
      });
    },
    [deleteAppointment, upsertAppointment]
  );

  const handleSpecialScheduleSave = useCallback(
    (next: TeamSchedule) => {
      if (!activeTeamId) return;
      setSchedules({ ...schedules, [activeTeamId]: next });
    },
    [activeTeamId, schedules, setSchedules]
  );

  const handleFooterTap = useCallback((dateKey: string) => {
    setFinanceDateKey(dateKey);
  }, []);

  // Tap on day header → jump to that date in single-day view. If we're
  // already in "day" view, toggle back to week. When entering day view we
  // store the clicked date as the visible range start; when leaving we
  // re-align to the Monday of that week so the week grid looks correct.
  const handleDayHeaderTap = useCallback(
    (dateKey: string) => {
      const [y, m, d] = dateKey.split("-").map(Number);
      const target = new Date(y, m - 1, d);
      setViewMode((prev) => {
        if (prev === "day") {
          setCurrentMonday(getMonday(target));
          return "week";
        }
        setCurrentMonday(target);
        return "day";
      });
    },
    [setCurrentMonday, setViewMode]
  );

  const extrasForDate = useCallback(
    (dateKey: string) => {
      const list = getExtrasFor(activeTeamId || null, dateKey);
      return sumExtras(list);
    },
    [getExtrasFor, activeTeamId]
  );

  const handleAppointmentClick = useCallback(
    (appointment: Appointment) => {
      setInlineSheet({ mode: "edit", initial: appointment });
    },
    []
  );

  // STORY-002: tap on empty slot opens BookingSheet directly. Old
  // slotMenu/ActionMenuModal flow removed — 2-step dialog was just
  // extra friction. BookingSheet itself has Client/Event segment.
  const [booking, setBooking] = useState<{
    dateKey: string;
    timeStart: string;
    timeEnd: string;
  } | null>(null);

  // Success overlay after a booking is saved — 2 sec with Call/Chat
  // quick actions, then auto-dismiss.
  const [savedSuccess, setSavedSuccess] = useState<{
    name: string;
    phone?: string;
    chatHref?: string;
    smsText?: string;
  } | null>(null);

  // STORY-003: payment + expense sheet state.
  const [paymentApt, setPaymentApt] = useState<Appointment | null>(null);
  const [expenseFor, setExpenseFor] = useState<{
    dateKey: string;
    dayLabel: string;
  } | null>(null);

  // Recent-in-chats: client IDs that have a chat with activity in the
  // last 48h. Surfaced at the top of the ClientPicker for faster access.
  const recentInChats = useMemo(() => {
    const chats = loadChats();
    const cutoff = Date.now() - 48 * 3600 * 1000;
    const byId = new Map<string, number>();
    for (const c of chats) {
      if (!c.client_id) continue;
      const ts = Date.parse(c.last_message_at || c.created_at);
      if (!Number.isFinite(ts) || ts < cutoff) continue;
      const prev = byId.get(c.client_id) ?? 0;
      if (ts > prev) byId.set(c.client_id, ts);
    }
    return Array.from(byId.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);
  }, []);

  // Stable appointment seed for the create-mode sheet. Must not be
  // recreated on every render, otherwise AppointmentSheet's reset effect
  // keyed on `appointment` re-fires (new id on each tick) and wipes the
  // client/location state the user just picked.
  const bookingAppointment = useMemo(() => {
    if (!booking) return null;
    // Personal tab → event for the current master, no team.
    // Brigade tab → work appointment, no master.
    const personal = activeTeamId === PERSONAL_TAB_ID;
    const base = createBlankAppointment({
      date: booking.dateKey,
      time_start: booking.timeStart,
      time_end: booking.timeEnd,
      team_id: personal ? null : activeTeamId || null,
      kind: personal ? "event" : "work",
    });
    return personal
      ? { ...base, master_id: currentMasterId ?? null }
      : base;
  }, [booking, activeTeamId, currentMasterId]);

  const openNewAppointmentInline = useCallback(
    (date: string | null, time: string | null, kind: "work" | "event") => {
      const today = new Date();
      const blank = createBlankAppointment({
        date: date || today.toISOString().slice(0, 10),
        time_start: time || "10:00",
        time_end: time
          ? (() => {
              const [h, m] = time.split(":").map(Number);
              const total = h * 60 + m + 60;
              const hh = Math.floor(total / 60) % 24;
              const mm = total % 60;
              return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
            })()
          : "11:00",
        team_id: activeTeamId || null,
        kind,
      });
      setInlineSheet({ mode: "new", initial: blank });
    },
    [activeTeamId]
  );

  // Tap on empty slot → BookingSheet (STORY-002). Компонент сам
  // даёт выбор «Клиент/Событие» в сегмент-контроле. Phase I36 —
  // длительность новой записи = слот-настройка активной бригады
  // (15/30/60), так же как и шаг снэпа. Дальше пересчитается по
  // выбранным услугам.
  const handleEmptySlotClick = useCallback(
    (date: string, time: string) => {
      const [h, m] = time.split(":").map(Number);
      const endMin = h * 60 + m + activeSlotMinutes;
      const endH = Math.floor(endMin / 60) % 24;
      const endM = endMin % 60;
      const timeEnd = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
      setBooking({ dateKey: date, timeStart: time, timeEnd });
    },
    [activeSlotMinutes],
  );

  // BottomTabBar / FAB navigates here with ?new=1 while we're already
  // on /dashboard. Previous implementation read `window.location.search`
  // with only `[activeTeamId, router, clients]` as deps — the query
  // never re-ran the effect (Sprint 019 B1). Now we track the search
  // string as a real dependency so a query flip from "" → "new=1&kind=X"
  // always dispatches once.
  //
  // ?new=1        → opens the creation form
  // ?kind=work    → appointment sheet
  // ?kind=event   → event-mode sheet
  // ?kind=expense → ExpenseSheet
  // ?client_id=X  → pre-fills the client (used by "Записать" from chats)
  // ?date=YYYY-MM-DD → pre-fills the date (used by recurring reminders)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(searchString);
    if (params.get("new") !== "1") return;
    const kindParam = params.get("kind");
    const clientId = params.get("client_id");
    const client = clientId ? clients.find((c) => c.id === clientId) : null;
    const dateParam = params.get("date");
    const dateKey = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : new Date().toISOString().slice(0, 10);

    if (kindParam === "expense") {
      setExpenseFor({ dateKey, dayLabel: "Сегодня" });
    } else {
      const blank = createBlankAppointment({
        date: dateKey,
        time_start: "10:00",
        time_end: "11:00",
        team_id: activeTeamId || null,
        client_id: clientId || null,
        address: client?.address ?? "",
        kind: kindParam === "event" ? "event" : "work",
      });
      setInlineSheet({ mode: "new", initial: blank });
    }
    router.replace("/dashboard");
  }, [searchString, activeTeamId, router, clients]);

  // Long-press action menu on an existing appointment.
  const [longPressApt, setLongPressApt] = useState<Appointment | null>(null);
  const [rescheduleApt, setRescheduleApt] = useState<Appointment | null>(null);
  const handleAppointmentLongPress = useCallback((apt: Appointment) => {
    haptic("select");
    setLongPressApt(apt);
  }, []);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);


  const handleSelectDate = useCallback((monday: Date) => {
    setCurrentMonday(monday);
  }, []);

  // STORY-056 — desktop keyboard shortcuts. Active across the calendar
  // shell whenever no input/textarea/contenteditable is focused. The
  // ignore guard mirrors GitHub / Linear conventions so typing in the
  // global search or a comment box doesn't accidentally page-flip the
  // calendar. Disabled on touch-only devices to avoid surprise
  // shortcuts on tablets with attached keyboards (we still respect
  // Cmd+K, which is wired up in BottomTabBar).
  useEffect(() => {
    const isEditable = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return; // leave Cmd/Ctrl/Alt to other handlers
      if (isEditable(e.target)) return;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          handlePrevWeek();
          return;
        case "ArrowRight":
          e.preventDefault();
          handleNextWeek();
          return;
        case "t":
        case "T":
          e.preventDefault();
          handleToday();
          return;
        case "1":
          e.preventDefault();
          setViewMode("day");
          return;
        case "2":
          e.preventDefault();
          setViewMode("3days");
          return;
        case "3":
          e.preventDefault();
          setViewMode("week");
          return;
        case "4":
          e.preventDefault();
          setViewMode("month");
          return;
        case "n":
        case "N":
          e.preventDefault();
          openNewAppointmentInline(null, null, "work");
          return;
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    handlePrevWeek,
    handleNextWeek,
    handleToday,
    setViewMode,
    openNewAppointmentInline,
  ]);

  // ─── dnd-kit sensors: mouse for desktop only ───────────────────────────
  // Touch drag is intentionally disabled — on iPhone holding an
  // appointment must open the context menu, not start a drag. Users can
  // still reorder records via the menu's "Перенести запись". Mouse drag
  // stays enabled for desktop dispatchers.
  const dndSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over, delta } = event;
      if (!over) return;
      const aptId = active.data.current?.appointmentId as string | undefined;
      const dateKey = over.data.current?.dateKey as string | undefined;
      if (!aptId || !dateKey) return;
      const apt = appointments.find((a) => a.id === aptId);
      if (!apt) return;

      // Convert Y delta (pixels) into minute delta, snap to 15 min
      const minuteDelta = Math.round(delta.y / (hourHeightRef.current / 60) / 15) * 15;
      const [sh, sm] = apt.time_start.split(":").map(Number);
      const [eh, em] = apt.time_end.split(":").map(Number);
      const duration = eh * 60 + em - (sh * 60 + sm);

      let newStart = sh * 60 + sm + minuteDelta;
      newStart = Math.max(0, Math.min(24 * 60 - duration, newStart));
      const newEnd = newStart + duration;

      const fmt = (t: number) =>
        `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;

      // No change? bail out
      if (dateKey === apt.date && newStart === sh * 60 + sm) return;

      upsertAppointment({
        ...apt,
        date: dateKey,
        time_start: fmt(newStart),
        time_end: fmt(newEnd),
        updated_at: new Date().toISOString(),
      });
    },
    [appointments, upsertAppointment]
  );

  // City picker state for the tapped day
  const [cityPickerDateKey, setCityPickerDateKey] = useState<string | null>(null);
  const activeTeam = teams.find((t) => t.id === activeTeamId);
  const teamDefaultCity = activeTeam?.default_city ?? "";
  // Phase I38 — brigade has any labels configured?
  // Empty list AND empty default → DayColumn hides the per-day chip
  // entirely (nothing to pick, no confusion for SaaS tenants that
  // don't use region tags at all).
  const brigadeHasLabels = Boolean(
    activeTeam?.default_city?.trim() ||
      (activeTeam?.cities?.length ?? 0) > 0,
  );
  // Phase I39 — effective «behaviour» for the active calendar.
  // Brigade value wins over the global «Мой календарь» one. Personal
  // tab (no activeTeam) falls back to global.
  const effectiveHideCancelled =
    activeTeam?.hide_cancelled ?? calendarSettings.hideCancelled ?? false;
  const effectiveBufferMinutes =
    activeTeam?.buffer_minutes ?? calendarSettings.bufferMinutes ?? 0;

  // v462 diagnostic — surface tab/data state so we can see at a glance
  // whether masters/teams are populated. Fires only when the relevant
  // counts change (mount + data loads), not on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    console.log("[diag v462]", {
      mastersCount: masters.length,
      teamsCount: teams.length,
      teamTabsCount: teamTabs.length,
      activeTeamId,
      isPersonalTab,
      currentMasterId,
      visibleAppointmentsCount: visibleAppointments.length,
    });
  }, [masters.length, teams.length, teamTabs.length, activeTeamId]);

  const cityForDate = useCallback(
    (dateKey: string) => getCityFor(activeTeamId || null, dateKey, teamDefaultCity),
    [getCityFor, activeTeamId, teamDefaultCity]
  );

  const handleCityTap = useCallback((dateKey: string) => {
    setCityPickerDateKey(dateKey);
  }, []);

  const handleCityPick = useCallback(
    (city: string) => {
      if (!activeTeamId || !cityPickerDateKey) return;
      setCityFor(activeTeamId, cityPickerDateKey, city);
    },
    [activeTeamId, cityPickerDateKey, setCityFor]
  );

  const handleCityReset = useCallback(() => {
    if (!activeTeamId || !cityPickerDateKey) return;
    setCityFor(activeTeamId, cityPickerDateKey, "");
  }, [activeTeamId, cityPickerDateKey, setCityFor]);

  // Render a calendar page (without TimeGrid — that lives in the shared TimeColumn).
  const renderPage = useCallback(
    (offset: -1 | 0 | 1) => {
      const monday =
        viewMode === "week"
          ? addWeeks(currentMonday, offset)
          : addDays(currentMonday, offset * stepDays);
      return (
        <WeekView
          mondayDate={monday}
          appointments={visibleAppointments}
          clientsById={clientsById}
          services={services}
          validateApt={validateApt}
          viewMode={viewMode}
          schedule={activeSchedule}
          cityForDate={cityForDate}
          onCityTap={handleCityTap}
          onAppointmentClick={handleAppointmentClick}
          onAppointmentLongPress={handleAppointmentLongPress}
          onEmptySlotClick={handleEmptySlotClick}
          onFooterTap={handleFooterTap}
          onDayHeaderTap={handleDayHeaderTap}
          extrasForDate={extrasForDate}
          teamColorFor={teamColorFor}
          cityLookup={cities}
          windowStart={windowStart}
          windowEnd={windowEnd}
          workStart={
            calendarSettings.workStartHour ?? calendarSettings.startHour
          }
          workEnd={
            calendarSettings.workEndHour ?? calendarSettings.endHour
          }
          snapMinutes={activeSlotMinutes}
          hasLabels={brigadeHasLabels}
          hideCancelled={effectiveHideCancelled}
          bufferMinutes={effectiveBufferMinutes}
          dragEnabled
        />
      );
    },
    [
      currentMonday,
      viewMode,
      stepDays,
      visibleAppointments,
      clientsById,
      services,
      validateApt,
      activeSchedule,
      cityForDate,
      handleCityTap,
      handleAppointmentClick,
      handleAppointmentLongPress,
      handleEmptySlotClick,
      handleFooterTap,
      handleDayHeaderTap,
      extrasForDate,
      teamColorFor,
      cities,
      windowStart,
      windowEnd,
      activeSlotMinutes,
      brigadeHasLabels,
      effectiveHideCancelled,
      effectiveBufferMinutes,
    ]
  );

  // Slot menu removed — BookingSheet takes over directly (STORY-002).

  // Long-press menu — only actions that Dima actually uses.
  // No disabled stubs, no rarely-used items.
  // Sprint 028: strip cartoon emojis from menu labels — cleaner iOS
  // look. The menu surface already groups these by status so the
  // leading glyph wasn't carrying semantic weight.
  const longPressOptions: ActionMenuOption[] = longPressApt
    ? [
        ...(longPressApt.status === "scheduled" && longPressApt.kind === "work"
          ? [{
              label: "Отметить оплату",
              onSelect: () => setPaymentApt(longPressApt),
            }]
          : []),
        ...(longPressApt.status !== "completed"
          ? [{
              label: "Выполнена",
              onSelect: () => handleQuickStatus(longPressApt, "completed"),
            }]
          : []),
        ...(longPressApt.status !== "in_progress"
          ? [{
              label: "В работе",
              onSelect: () => handleQuickStatus(longPressApt, "in_progress"),
            }]
          : []),
        ...(longPressApt.status !== "scheduled" && longPressApt.status !== "cancelled"
          ? [{
              label: "Вернуть в план",
              onSelect: () => handleQuickStatus(longPressApt, "scheduled"),
            }]
          : []),
        ...(longPressApt.status !== "cancelled"
          ? [{
              label: "Перенести",
              onSelect: () => setRescheduleApt(longPressApt),
            }]
          : []),
        {
          label: "Копировать",
          onSelect: () => {
            const copy = duplicateAppointment(longPressApt);
            upsertAppointment(copy);
            setInlineSheet({ mode: "edit", initial: copy });
          },
        },
        {
          label: longPressApt.status === "cancelled" ? "Восстановить" : "Отменить",
          onSelect: () => handleCancelToggle(longPressApt),
        },
        {
          label: "Удалить",
          danger: true,
          onSelect: () => handleDeleteWithUndo(longPressApt),
        },
      ]
    : [];

  // STORY-085 — first-run gate. Brand-new tenants (no teams yet AND
  // personal calendar not enabled) see a full-screen choice instead of
  // an empty grid. Wait for personalCal.loaded so we don't flash the
  // gate-screen on already-configured tenants while the column is
  // being read.
  if (personalCal.loaded && !personalCal.enabled && teams.length === 0) {
    return (
      <>
        <PageHeader
          title="Календарь"
          showBack={false}
          leftContent={
            <button
              type="button"
              onClick={sidebar.toggle}
              aria-label="Меню"
              className="lg:hidden w-11 h-11 flex items-center justify-center rounded-full text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)] transition"
            >
              <Menu size={22} strokeWidth={2} />
            </button>
          }
        />
        <FirstRunCalendarChoice onEnabledRefresh={personalCal.refresh} />
      </>
    );
  }

  return (
    <>
      <Header
        currentDate={currentMonday}
        activeTeamId={activeTeamId}
        teams={teamTabs}
        viewMode={viewMode}
        allAppointments={appointments}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onToday={handleToday}
        onTeamChange={handleTeamChange}
        onTeamLongPress={handleTeamLongPress}
        onViewModeChange={handleViewModeChange}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onSelectDate={handleSelectDate}
        onMenuToggle={sidebar.toggle}
      />

      {quotaSnap && (
        <QuotaBanner
          plan={quotaSnap.plan}
          quotas={quotaSnap.quotas}
          usage={quotaSnap.usage}
          scope="appointments_month"
        />
      )}

      {/* Sprint 026-hotfix: убрали TodayGlance (фиолетовая плашка
          «Сегодня · 1 запись») и NowPill («Через N мин → клиент»).
          MorningBriefing всё ещё показывает утренний бриф 06:00–10:00;
          на самом календаре этих плашек больше нет — ~56 px отыграли. */}

      {/* Sprint 027-hotfix: сняли полосу под шапкой (TodayChip + «+ Расход»)
          по запросу CEO — не нужна. TodayChip жил под STORY-003, теперь
          общая сводка остаётся только в DaySummaryStrip на Day-режиме. */}

      {/* Day view only: one-line summary (records, earnings, unpaid) */}
      {viewMode === "day" && (
        <DaySummaryStrip
          appointments={visibleAppointments}
          teamId={activeTeamId}
          dateKey={toYmd(currentMonday)}
          onUnpaidTap={() => router.push("/dashboard/finances")}
        />
      )}

      {/* Single shared vertical scroller: TimeColumn (fixed left) + swipeable days */}
      <DndContext sensors={dndSensors} onDragEnd={handleDragEnd}>
        {viewMode === "month" ? (
          <MonthView
            currentDate={currentMonday}
            appointments={visibleAppointments}
            onDayClick={(date) => {
              setCurrentMonday(getMonday(date));
              setViewMode("day");
            }}
          />
        ) : (
          <div
            ref={outerScrollerRef}
            // v475 — bg back to surface-card (white). v474 already
            // clamps pinch-zoom-out so the grid fills the viewport,
            // so the gray «empty area below 23:59» from v472 is no
            // longer needed — and it read as a bug to the user.
            // White matches the personal calendar's column body, so
            // any residual sub-pixel gap blends invisibly.
            className="flex-1 flex bg-[var(--surface-card)] min-h-0 relative"
            style={{
              overflowY: "auto",
              overflowX: "clip",
              touchAction: "pan-y",
              overscrollBehavior: "none",
              // iOS momentum scrolling + GPU composition for butter-smooth
              // 120 Hz scrolling. transform forces a dedicated layer so the
              // compositor can scroll without touching the main thread.
              WebkitOverflowScrolling: "touch",
              transform: "translateZ(0)",
              willChange: "scroll-position",
              contain: "paint",
            }}
          >
            <TimeColumn startHour={windowStart} endHour={windowEnd} />
            <SwipeableCalendar
              renderPage={renderPage}
              onSwipeLeft={handleNextWeek}
              onSwipeRight={handlePrevWeek}
            />
            {/* Sprint 033 Phase I17 — removed absolute-positioned 2-px
                "stable vertical rule" that was drifting visibly during
                pinch-zoom. The separator now lives as border-right on
                TimeColumn itself (see TimeColumn.tsx), so it's
                physically part of the time column and can't shift. */}
          </div>
        )}
      </DndContext>

      {/* STORY-059 — first-run empty state. Floats over the empty grid
          when the tenant has no appointments. Tapping "Добавить первую
          запись" opens the new-appointment sheet at the next round
          hour today; tapping any grid cell still works as the
          alternate path. */}
      <CalendarEmptyState
        appointmentsCount={appointments.length}
        onCreateClick={() => {
          // Snap to a sensible work-hour default. If we just rolled
          // (now.hours + 1) % 24 we'd get "00:00" any time after
          // 23:00, which lands the user on a past slot. Instead:
          //   * before 09:00 → 10:00 today
          //   * 09:00–17:00 → next whole hour today
          //   * 18:00 onward → 10:00 next working day
          const now = new Date();
          const h = now.getHours();
          const start = new Date(now);
          if (h < 9) {
            start.setHours(10, 0, 0, 0);
          } else if (h < 18) {
            start.setHours(h + 1, 0, 0, 0);
          } else {
            start.setDate(start.getDate() + 1);
            start.setHours(10, 0, 0, 0);
          }
          const dateKey = toYmd(start);
          const time = `${String(start.getHours()).padStart(2, "0")}:00`;
          handleEmptySlotClick(dateKey, time);
        }}
      />

      {/* Build tag — visible proof that latest code is running. Dev
          only; in prod the chip would be noise on top of the calendar. */}
      {process.env.NODE_ENV !== "production" && (
        <div
          className="fixed left-2 z-30 pointer-events-none text-[12px] font-mono bg-black/70 text-[var(--label-on-accent)] px-1.5 py-0.5 rounded"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 0.25rem)" }}
        >
          {BUILD_VERSION}
        </div>
      )}

      {/* City picker bottom sheet */}
      <CityPickerModal
        open={cityPickerDateKey !== null}
        onClose={() => setCityPickerDateKey(null)}
        current={cityPickerDateKey ? cityForDate(cityPickerDateKey) : ""}
        defaultCity={teamDefaultCity}
        dateKey={cityPickerDateKey ?? undefined}
        cities={cities}
        brigadeCities={activeTeam?.cities}
        onPick={handleCityPick}
        onReset={handleCityReset}
      />

      {/* Personal calendar create — dedicated PersonalEventSheet (no
          Клиент/Событие segment, iOS-Reminders style). Brigade flow
          keeps the unified AppointmentSheet below. */}
      {booking && bookingAppointment && isPersonalTab && (
        <PersonalEventSheet
          open
          onClose={() => setBooking(null)}
          mode="create"
          appointment={bookingAppointment}
          onSave={(apt) => {
            upsertAppointment(apt);
            setBooking(null);
          }}
        />
      )}

      {/* STORY-002-FINAL: единый AppointmentSheet для create-режима
          (тап по пустому слоту). Внутри sheet — segment Клиент/Событие.
          Brigade-only after the personal-tab fork above.
          v460: dropped `activeTeam` guard — sheet must still open when
          the active brigade was deleted/inactive (race or ghost id),
          otherwise the empty-slot tap silently no-ops. AppointmentSheet
          is null-safe (Team | null prop). */}
      {booking && bookingAppointment && !isPersonalTab && (
        <AppointmentSheet
          open={booking !== null}
          onClose={() => setBooking(null)}
          mode="create"
          appointment={bookingAppointment}
          clients={clients}
          recentClientIds={recentInChats}
          teams={teams}
          activeTeam={activeTeam ?? null}
          personalMode={false}
          masters={masters}
          catalog={services}
          categories={serviceCategories}
          cityForDate={cityForDate}
          onCancelAppointment={() => setBooking(null)}
          onSave={(apt) => {
            upsertAppointment(apt);
            setBooking(null);
            if (apt.kind === "work" && apt.client_id) {
              const c = clients.find((x) => x.id === apt.client_id);
              if (c) {
                const chatLinkId = loadChats().find((ch) => ch.client_id === c.id)?.id;
                const dateLabel = (() => {
                  const [y, m, d] = apt.date.split("-").map(Number);
                  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
                  return Number.isFinite(dt.getTime())
                    ? dt.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
                    : apt.date;
                })();
                const greet = c.full_name ? `${c.full_name}, ` : "";
                const smsText = `${greet}ваша запись назначена на ${dateLabel} в ${apt.time_start}. Babun CRM`;
                setSavedSuccess({
                  name: c.full_name,
                  phone: c.phone,
                  chatHref: chatLinkId
                    ? `/dashboard/chats?chat_id=${chatLinkId}`
                    : `/dashboard/chats?client_id=${c.id}`,
                  smsText,
                });
              }
            }
          }}
        />
      )}

      {savedSuccess && (
        <SuccessOverlay
          clientName={savedSuccess.name}
          phone={savedSuccess.phone}
          chatHref={savedSuccess.chatHref}
          smsText={savedSuccess.smsText}
          onDone={() => setSavedSuccess(null)}
        />
      )}

      {/* STORY-003 — PaymentSheet. Долгий тап по scheduled-записи →
          «Отметить оплату» → этот sheet. Создаёт Payment и меняет
          status на completed. */}
      <PaymentSheet
        open={paymentApt !== null}
        onClose={() => setPaymentApt(null)}
        appointment={paymentApt}
        clientName={
          paymentApt?.client_id
            ? clients.find((c) => c.id === paymentApt.client_id)?.full_name ?? paymentApt.comment ?? ""
            : paymentApt?.comment ?? ""
        }
        onPay={(method) => {
          if (!paymentApt) return;
          const payment = {
            id: `pay-${Date.now()}`,
            method,
            amount: paymentApt.total_amount,
            paid_at: new Date().toISOString(),
          };
          upsertAppointment({
            ...paymentApt,
            status: "completed",
            payments: [...paymentApt.payments, payment],
            updated_at: new Date().toISOString(),
          });
          setPaymentApt(null);
          setLongPressApt(null);
        }}
        onCancel={() => {
          if (!paymentApt) return;
          upsertAppointment({
            ...paymentApt,
            status: "cancelled",
            updated_at: new Date().toISOString(),
          });
          setPaymentApt(null);
          setLongPressApt(null);
        }}
      />

      {/* STORY-003 — ExpenseSheet. Интегрируется с существующим
          day-extras механизмом. Добавляет category на DayExtra. */}
      <ExpenseSheet
        open={expenseFor !== null}
        onClose={() => setExpenseFor(null)}
        dayLabel={expenseFor?.dayLabel}
        teamLabel={activeTeam?.name}
        onSave={({ category, amount, name }) => {
          if (!expenseFor || !activeTeamId) return;
          const current = getExtrasFor(activeTeamId, expenseFor.dateKey);
          const entry = {
            id: `ex-${Date.now()}`,
            name,
            amount,
            kind: "expense" as const,
            category,
          };
          setExtrasFor(activeTeamId, expenseFor.dateKey, [...current, entry]);
          setExpenseFor(null);
        }}
      />

      {/* Appointment long-press action menu */}
      <ActionMenuModal
        open={longPressApt !== null}
        onClose={() => setLongPressApt(null)}
        title="Выберите действие"
        options={longPressOptions}
      />

      {/* Special-schedule override modal */}
      <SpecialScheduleModal
        open={specialScheduleDate !== null}
        dateKey={specialScheduleDate}
        schedule={activeSchedule}
        onClose={() => setSpecialScheduleDate(null)}
        onSave={handleSpecialScheduleSave}
      />

      {/* Repeat-copy modal */}
      <RepeatCopyModal
        open={repeatSource !== null}
        source={repeatSource}
        onClose={() => setRepeatSource(null)}
        onConfirm={(copies) => {
          copies.forEach((c) => upsertAppointment(c));
          setUndoToast({
            message: `Создано ${copies.length} копи${copies.length === 1 ? "я" : copies.length < 5 ? "и" : "й"}`,
            restore: () => copies.forEach((c) => deleteAppointment(c.id)),
          });
        }}
      />

      <UndoToast
        open={undoToast !== null}
        message={undoToast?.message ?? ""}
        onUndo={() => undoToast?.restore()}
        onClose={() => setUndoToast(null)}
      />

      {/* v322 — FAB removed per user request.  New appointments are
          created via tap-on-grid or long-press on the calendar. */}

      {/* Day finance modal */}
      {financeDateKey && (
        <DayFinanceModal
          open
          onClose={() => setFinanceDateKey(null)}
          dateKey={financeDateKey}
          dateLabel={formatDateLongRu(financeDateKey)}
          appointments={visibleAppointments.filter(
            (a) => a.date === financeDateKey
          )}
          services={services}
          extras={getExtrasFor(activeTeamId || null, financeDateKey)}
          onSave={(next) => {
            if (activeTeamId) setExtrasFor(activeTeamId, financeDateKey, next);
          }}
        />
      )}

      {/* Inline new/edit sheet — renders on top of the calendar, no route
          change. Keeps the calendar fully mounted so opening an
          appointment is instant. */}
      {/* Personal event edit — dedicated sheet. Master_id-tagged events
          live on the personal tab and use PersonalEventSheet for edit
          and delete. */}
      {inlineSheet && inlineSheet.initial.master_id && inlineSheet.initial.kind === "event" && (
        <PersonalEventSheet
          open
          onClose={() => setInlineSheet(null)}
          mode="edit"
          appointment={inlineSheet.initial}
          onSave={(apt) => {
            upsertAppointment(apt);
            setInlineSheet(null);
          }}
          onDelete={(apt) => {
            deleteAppointment(apt.id);
            setInlineSheet(null);
          }}
        />
      )}

      {/* STORY-002-FINAL: view/done режимы единого sheet открываются
          по тапу на существующую запись (handleAppointmentClick).
          Brigade flow only — personal fork handled above. */}
      {inlineSheet && activeTeam && !(inlineSheet.initial.master_id && inlineSheet.initial.kind === "event") && (
        <AppointmentSheet
          open
          onClose={() => setInlineSheet(null)}
          mode={inlineSheet.initial.status === "completed" ? "done" : "view"}
          appointment={inlineSheet.initial}
          clients={clients}
          recentClientIds={recentInChats}
          teams={teams}
          activeTeam={activeTeam ?? null}
          personalMode={Boolean(inlineSheet.initial.master_id)}
          masters={masters}
          catalog={services}
          categories={serviceCategories}
          cityForDate={cityForDate}
          onSave={(apt) => {
            upsertAppointment(apt);
            setInlineSheet(null);
          }}
          onCancelAppointment={(apt) => {
            upsertAppointment({
              ...apt,
              status: "cancelled",
              updated_at: new Date().toISOString(),
            });
            setInlineSheet(null);
          }}
          onReschedule={(apt) => {
            // Close the view sheet first so RescheduleSheet stacks cleanly;
            // parent re-renders and ReschedulingSheet's `open` flips true.
            setInlineSheet(null);
            setRescheduleApt(apt);
          }}
          onCompleteQuick={(apt) => {
            setInlineSheet(null);
            setPaymentApt(apt);
          }}
        />
      )}

      <EndOfDayBanner
        appointments={appointments}
        teamId={activeTeamId}
        onOpenUnpaid={() => router.push("/dashboard/close-day")}
      />

      <RescheduleSheet
        open={rescheduleApt !== null}
        appointment={rescheduleApt}
        onClose={() => setRescheduleApt(null)}
        onConfirm={(next) => {
          if (!rescheduleApt) return;
          upsertAppointment({
            ...rescheduleApt,
            date: next.date,
            time_start: next.time_start,
            time_end: next.time_end,
            updated_at: new Date().toISOString(),
          });
        }}
      />

      <MorningBriefing
        appointments={appointments}
        services={services}
        teams={teams}
        dayExtrasOf={getExtrasFor}
      />
    </>
  );
}
