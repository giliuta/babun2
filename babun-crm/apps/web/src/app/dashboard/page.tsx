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
import {
  getMonday,
  addWeeks,
  addDays,
} from "@babun/shared/common/utils/date-utils";
import type { Client } from "@babun/shared/local/clients";
import { getTeamSchedule, type TeamSchedule } from "@babun/shared/local/schedule";
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
import { PERSONAL_CALENDAR_ENABLED } from "@/lib/feature-flags";
import { FirstRunCalendarChoice } from "@/components/empty-states/FirstRunCalendarChoice";
import SwipeableCalendar from "@/components/calendar/SwipeableCalendar";
import TimeColumn from "@/components/calendar/TimeColumn";
import DayFinanceFooter from "@/components/calendar/DayFinanceFooter";
import {
  computeDayFinance,
  type DayFinanceTotals,
} from "@babun/shared/local/finance/day-summary";
// CalendarLegend убран из рендера (см. место использования ниже).
// Импорт сохранён закомментированным как маркер «это компонент есть,
// просто не маршрутизируется в текущем UI».
// import CalendarLegend from "@/components/calendar/CalendarLegend";
import AgendaView from "@/components/calendar/AgendaView";
import UndoToast from "@/components/ui/UndoToast";
import { useToast } from "@/components/ui/Toast";
import {
  findOverlap,
  describeOverlap,
} from "@babun/shared/common/utils/appointment-overlap";
import { expandRepeat } from "@babun/shared/common/utils/expand-repeat";
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
  () => import("@/components/finance/DayFinanceModal"),
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
const SlotConfirmPopup = dynamic(
  () => import("@/components/appointment/SlotConfirmPopup"),
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
  useTenantId,
} from "@/components/layout/DashboardClientLayout";
import { getTeamDisplayName } from "@babun/shared/local/masters";
import { sumExtras } from "@babun/shared/local/day-extras";
import { loadChats } from "@babun/shared/local/chats";
// Finance/reschedule sheets — lazy. PaymentSheet and ExpenseSheet open
// from the day-finance modal; RescheduleSheet opens via the appointment
// action menu. None of them paint on the initial render path.
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
// STORY-060 — lazy-load the new calendar surfaces. None of them sit on
// the initial paint path; they hydrate after the calendar grid is on
// screen. Keeps the dashboard first-byte under 200 KB.
// CalendarFab убран из рендера. Импорт закомментирован как маркер
// «компонент есть, временно не маршрутизируется».
// const CalendarFab = dynamic(
//   () => import("@/components/calendar/CalendarFab"),
//   { ssr: false },
// );
const CalendarOnboardingCard = dynamic(
  () =>
    import("@/components/empty-states/CalendarOnboardingCard").then((m) => ({
      default: m.CalendarOnboardingCard,
    })),
  { ssr: false },
);
import DaySummaryStrip from "@/components/layout/DaySummaryStrip";
import EndOfDayBanner from "@/components/layout/EndOfDayBanner";
import MorningBriefing from "@/components/layout/MorningBriefing";


import {
  useCalendarGestures,
  HOUR_HEIGHT_DEFAULT,
} from "@/hooks/useCalendarGestures";
import { getStorage } from "@babun/shared/storage";

// How many days to advance per "next" / "prev" depending on view mode.
// "month" uses a dedicated branch that jumps whole months.
const STEP_DAYS: Record<ViewMode, number> = {
  day: 1,
  "3days": 3,
  week: 7,
  month: 0,
  agenda: 0,
};

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// STORY-060 §F2.7 — DnD i18n. @dnd-kit/core ships English screen-reader
// announcements; for a RU-only CRM that surfaces as "To pick up a
// draggable item, press the space bar" mid-flow. We pass RU strings
// via `accessibility` so VoiceOver / TalkBack read the right language.
// Strings are deliberately short — the dispatcher hears them every
// time they reschedule.
const DND_A11Y_RU = {
  announcements: {
    onDragStart({ active }: { active: { id: string | number } }) {
      return `Запись ${active.id} взята.`;
    },
    onDragOver({
      active,
      over,
    }: {
      active: { id: string | number };
      over: { id: string | number } | null;
    }) {
      if (over) {
        return `Запись ${active.id} над слотом ${over.id}.`;
      }
      return `Запись ${active.id} больше не над слотом.`;
    },
    onDragEnd({
      active,
      over,
    }: {
      active: { id: string | number };
      over: { id: string | number } | null;
    }) {
      if (over) {
        return `Запись ${active.id} перенесена в слот ${over.id}.`;
      }
      return `Запись ${active.id} осталась на месте.`;
    },
    onDragCancel({ active }: { active: { id: string | number } }) {
      return `Перенос записи ${active.id} отменён.`;
    },
  },
  screenReaderInstructions: {
    draggable:
      "Чтобы взять запись, нажмите пробел. Стрелками двигайте по сетке. Пробел — отпустить. Escape — отменить.",
  },
};

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
  const toast = useToast();
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
  const { teams, setTeams, teamsLoaded } = useTeams();
  // v796 — gate the whole calendar render on client mount; see the
  // «hold» early-return below. Kills the SSR / SW-cached empty-grid flash
  // that appeared before the «Создать календарь» screen.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const { getCityFor, setCityFor } = useDayCities();
  const { getExtrasFor, setExtrasFor } = useDayExtras();
  const tenantId = useTenantId();
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
    // v511 — sort by sort_order so chip strip respects the user's
    // drag-reorder. Falls back to created_at for legacy records that
    // were saved before Sprint 033 Phase I25 introduced sort_order.
    const brigadeTabs = teams
      .filter((t) => t.active)
      .slice()
      .sort((a, b) => {
        const aOrd = a.sort_order ?? Number.POSITIVE_INFINITY;
        const bOrd = b.sort_order ?? Number.POSITIVE_INFINITY;
        if (aOrd !== bOrd) return aOrd - bOrd;
        return (a.created_at ?? "").localeCompare(b.created_at ?? "");
      })
      .map((t) => ({
        id: t.id,
        name: getTeamDisplayName(t, masters),
        color: t.color,
      }));
    // STORY audit (tester 4.2): personal tab всегда prepend'ился вне
    // зависимости от personalCal.enabled — toggle в Settings/Account/
    // PersonalCalendar после onboarding эффективно ничего не делал.
    // Теперь skip personal tab если operator явно его выключил
    // (enabled=false).
    //
    // v668 — was «!personalCal.loaded || personalCal.enabled», which
    // showed «Мой календарь» chip during the async hook load. For
    // tenants who disabled personal calendar (the common case), the
    // chip flashed in for ~200–500 ms on every mount → user reported
    // «опять появился мой календарь». The cached lazy initializer in
    // usePersonalCalendarEnabled now returns the LAST KNOWN value
    // instantly, so we can drop the «keep showing during loading»
    // optimistic branch — the cache is the source of truth on first
    // paint, the DB refresh corrects it on the next render if it
    // diverged.
    // v792 — «Мой календарь» parked behind a feature flag. Even when the
    // tenant's stored personal_calendar_enabled is true, the tab stays
    // hidden until the flag is flipped back on.
    const personalEnabled = PERSONAL_CALENDAR_ENABLED && personalCal.enabled;
    if (!personalEnabled) return brigadeTabs;
    const personalName =
      currentMaster?.personal_calendar_name?.trim() || "Мой календарь";
    return [
      {
        id: PERSONAL_TAB_ID,
        name: personalName,
        color: currentMaster?.personal_calendar_color ?? null,
      },
      ...brigadeTabs,
    ];
  }, [teams, masters, currentMaster, personalCal.enabled, personalCal.loaded]);
  // SSR-safe: start on a deterministic epoch Monday, then move to today
  // in useEffect after mount. Previous `getMonday(new Date())` in the
  // initializer caused a hydration mismatch (Vercel's build clock vs
  // the client's clock diverged across Cyprus midnight on a cached HTML).
  const SSR_SAFE_MONDAY = useMemo(() => new Date(2026, 0, 5), []); // fixed seed
  const [currentMonday, setCurrentMonday] = useState<Date>(SSR_SAFE_MONDAY);
  const [activeTeamId, setActiveTeamId] = useState<string>("");
  // STORY audit: убрал combinedView («Показать все»). Дублировал
  // функцию таб-стрипа без реальной пользы для диспетчера: chip strip
  // уже даёт переключение между командами и личным, а отдельная
  // полоса под шапкой ела ~40 px вертикали на phone. Удалил state,
  // фильтр, UI-полосу и onTeamChange-reset. Если когда-нибудь
  // понадобится «обзор всех команд сразу» — это будет отдельный
  // view-mode рядом с День/Неделя/Месяц, не toggle поверх chip strip.
  useEffect(() => {
    // Client-only Monday seed — Date() differs between SSR / CSR so
    // we sync on mount. External-state-sync; React-Compiler's
    // cascade flag is a false positive here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    // Reconcile activeTeamId with the available teamTabs every time
    // teams change. setActiveTeamId is a guarded conditional setter
    // so it doesn't loop. React-Compiler flags the call as a
    // cascading render, but the conditions ensure it only fires when
    // the current selection is invalid.
    /* eslint-disable react-hooks/set-state-in-effect */
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
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [teamTabs, activeTeamId]);

  // Restore last-used view mode from localStorage after mount so server
  // and client render the same tree. Server always ships "week"; the
  // phone may then upgrade to "day" based on its own width + saved pref.
  //
  // Brief 2 #2 («Мой календарь»): `?view=day&date=2026-05-15` URL deep
  // links win over the localStorage default. The params are stripped
  // after consumption (same pattern as `?team=` above) so a refresh
  // doesn't keep snapping back to a stale date.
  //
  // STORY-060 §F1.4 — extended view-state persistence. We persist not
  // only the view mode but also the date anchor and the active team
  // chip, so a page reload lands the dispatcher exactly where they
  // were. URL deep-links and the explicit `?team=` param still win.
  // The scroll position is NOT persisted: it's derived from
  // calendarSettings.scrollOpenHour, which the user controls in
  // Settings → Calendar.
  const VIEW_MODE_KEY = "babun-view-mode";
  const VIEW_STATE_KEY = "babun-calendar-view-state";
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const viewStateHydratedRef = useRef(false);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // STORY-060 §F1.4 — hydration of {viewMode, currentMonday,
    // activeTeamId} from URL params + localStorage. Several setters
    // batch into one re-render per mount. Canonical external-state-
    // sync pattern; React-Compiler's cascade flag is a false positive.
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const viewParam = sp.get("view") as ViewMode | null;
      const dateParam = sp.get("date");
      let applied = false;
      if (viewParam && ["day", "3days", "week", "month"].includes(viewParam)) {
        setViewMode(viewParam);
        applied = true;
      }
      if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        const [y, m, d] = dateParam.split("-").map(Number);
        const parsed = new Date(y, m - 1, d);
        if (!Number.isNaN(parsed.getTime())) {
          // For day mode the anchor IS the day; for week/3days/month
          // we still want the Monday so the visible window is stable.
          const isDay = (viewParam ?? "") === "day";
          setCurrentMonday(isDay ? parsed : getMonday(parsed));
          applied = true;
        }
      }
      if (applied) {
        const url = new URL(window.location.href);
        url.searchParams.delete("view");
        url.searchParams.delete("date");
        window.history.replaceState({}, "", url.toString());
        viewStateHydratedRef.current = true;
        return;
      }
    }
    // STORY-060 §F1.4 — restore the saved {mode, date, activeTeamId}
    // blob. Falls back to the legacy single-key view-mode store so
    // existing users don't lose their mode preference on upgrade.
    let stateApplied = false;
    try {
      const blobRaw = getStorage().getRaw(VIEW_STATE_KEY);
      if (blobRaw) {
        const blob = JSON.parse(blobRaw) as {
          mode?: ViewMode;
          date?: string;
          activeTeamId?: string;
        };
        if (
          blob.mode &&
          ["day", "3days", "week", "month"].includes(blob.mode)
        ) {
          setViewMode(blob.mode);
          stateApplied = true;
        }
        if (blob.date && /^\d{4}-\d{2}-\d{2}$/.test(blob.date)) {
          const [y, m, d] = blob.date.split("-").map(Number);
          const parsed = new Date(y, m - 1, d);
          if (!Number.isNaN(parsed.getTime())) {
            const isDay = blob.mode === "day";
            setCurrentMonday(isDay ? parsed : getMonday(parsed));
            stateApplied = true;
          }
        }
        if (blob.activeTeamId) {
          // Funnel through pendingTeamParamRef so the teams-effect
          // validates the id against the live teamTabs list (same
          // path `?team=` uses).
          pendingTeamParamRef.current = blob.activeTeamId;
        }
      }
    } catch {
      // Malformed JSON — wipe the key so we don't keep tripping.
      try {
        getStorage().setRaw(VIEW_STATE_KEY, "");
      } catch {
        // ignore
      }
    }
    if (!stateApplied) {
      const saved = getStorage().getRaw(VIEW_MODE_KEY) as ViewMode | null;
      if (saved && ["day", "3days", "week", "month"].includes(saved)) {
        setViewMode(saved);
        viewStateHydratedRef.current = true;
        return;
      }
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setViewMode("day");
      }
    }
    viewStateHydratedRef.current = true;
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  // Persist legacy single-key view mode (rollback path).
  useEffect(() => {
    getStorage().setRaw(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);
  // STORY-060 §F1.4 — write the combined view-state blob whenever any
  // of its pieces change. Gated on `viewStateHydratedRef` so the
  // initial render (with the SSR-safe epoch Monday + default "" team)
  // doesn't clobber the saved blob before the restore effect lands.
  useEffect(() => {
    if (!viewStateHydratedRef.current) return;
    try {
      const y = currentMonday.getFullYear();
      const m = String(currentMonday.getMonth() + 1).padStart(2, "0");
      const d = String(currentMonday.getDate()).padStart(2, "0");
      const blob = JSON.stringify({
        mode: viewMode,
        date: `${y}-${m}-${d}`,
        activeTeamId,
      });
      getStorage().setRaw(VIEW_STATE_KEY, blob);
    } catch {
      // Storage quota / private mode — non-fatal.
    }
  }, [viewMode, currentMonday, activeTeamId]);
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
  // Remembers the last user-facing context we auto-scrolled for, so a
  // background data reload (Supabase on slow mobile) that changes the
  // derived window bounds does NOT yank the grid back to the open-hour.
  // See the scroll useLayoutEffect below.
  const lastScrollKeyRef = useRef<string>("");

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
  // "Календарь команды"), it wins over both the settings startHour and
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

  // Snap + default-duration for empty-cell taps.
  // Brigade tabs are fixed at 60 min (no per-brigade picker — the
  // dispatcher asked for one simple base step). The personal tab still
  // respects the «Шаг сетки» setting (15/30/60), defaulting to 30.
  const activeSlotMinutes = useMemo<number>(() => {
    const onBrigade = teams.some((x) => x.id === activeTeamId);
    if (onBrigade) return 60;
    const g = calendarSettings.gridStep;
    if (g === 15 || g === 30 || g === 60) return g;
    return 30;
  }, [teams, activeTeamId, calendarSettings.gridStep]);

  // Per-brigade timezone for the "now" line. Undefined = Cyprus default.
  const activeBrigadeTimezone = useMemo<string | undefined>(
    () => teams.find((x) => x.id === activeTeamId)?.timezone,
    [teams, activeTeamId],
  );

  // Per-brigade «подсветка дня цветом метки». Default true (current look);
  // false when the brigade explicitly turned it off in «Метки».
  const activeTintByLabel = useMemo<boolean>(() => {
    const t = teams.find((x) => x.id === activeTeamId);
    return t?.tint_days_by_label ?? true;
  }, [teams, activeTeamId]);

  // Where the label picker's gear navigates: the active brigade's «Метки»
  // page, or the personal labels page on «Мой календарь».
  const labelSettingsHref = useMemo<string>(
    () =>
      teams.some((x) => x.id === activeTeamId)
        ? `/dashboard/teams/${activeTeamId}/cities`
        : "/dashboard/settings/calendar/labels",
    [teams, activeTeamId],
  );

  useLayoutEffect(() => {
    if (viewMode === "month") return;
    const el = outerScrollerRef.current;
    if (!el) return;
    // Only auto-scroll when the *user-facing* context changed — view
    // mode, active brigade, or one of the explicit scroll-time settings.
    // windowStart/windowEnd are read below for the math but deliberately
    // NOT part of this key: a background `teams`/schedule reload (Supabase
    // on slow 5G, ~10-15 s after a tab switch) can flip those derived
    // values and would otherwise re-run this effect and throw the user
    // back to the open-hour even though they'd scrolled elsewhere. The
    // key gate keeps the grid where the user left it on a pure refresh,
    // while still scrolling on a real tab/view switch or a settings save.
    const scrollKey = [
      viewMode,
      activeTeamId,
      activeBrigadeScroll,
      calendarSettings.scrollOpenHour ?? "",
      calendarSettings.workStartHour ?? "",
      calendarSettings.workEndHour ?? "",
    ].join("|");
    if (lastScrollKeyRef.current === scrollKey) return;
    lastScrollKeyRef.current = scrollKey;
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
    // v486 — «Открывается время» wins unconditionally. The old
    // now-line anchor override (Math.max(scrollTarget, nowTop - vp))
    // could scroll the grid past the user's setting when today's
    // current time was later in the day — so после переключения
    // между страницами календарь открывался на ~14:00 вместо
    // выбранных 09:00. User explicitly asked the setting to be
    // respected, so drop the override entirely. The brigade-level
    // `default_scroll_time` is still honoured below since it's a
    // per-team explicit choice, not a smart default.
    let targetTop = toTop(Math.max(scrollTarget, windowStart));

    // Brigade-level "Открывать на" override. When set, it wins over
    // the personal scrollOpenHour.
    if (activeBrigadeScroll && /^\d{1,2}:\d{2}$/.test(activeBrigadeScroll)) {
      const [bh, bm] = activeBrigadeScroll.split(":").map(Number);
      const brigadeHours = bh + bm / 60;
      const viewportOffset = el.clientHeight * 0.15;
      targetTop = Math.max(0, toTop(brigadeHours) - viewportOffset);
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

  const { handleZoomIn, handleZoomOut } = useCalendarGestures({
    outerScrollerRef,
    hourHeightRef,
    writeHourHeight,
    windowDurationHours: windowEnd - windowStart,
    // Scroller (and thus the zoom listeners) only exists in week/day —
    // month + agenda unmount it. Pass this so the listeners re-attach to
    // the new node when returning to week/day.
    gridActive: viewMode === "week" || viewMode === "day",
  });

  // STORY-043 G1 — MOCK_APPOINTMENTS seed-on-mount removed. Pre-cloud
  // it filled an empty calendar with demo data; post-STORY-042 it
  // wrote those demo rows straight to Supabase, polluting fresh
  // tenants and duplicating across devices on first visit. Fresh
  // tenants now land on a genuinely empty calendar.

  // Filter appointments by active tab. Personal tab shows only this
  // master's private events (no team_id). Brigade tabs show every
  // appointment bound to that brigade, regardless of whether a
  // specific master inside the brigade is also assigned.
  const isPersonalTab = activeTeamId === PERSONAL_TAB_ID;
  // STORY-091 (Brief 2 #18) — expand recurring personal events into
  // their virtual occurrences inside the currently rendered window.
  // The seed appointment lives in `appointments` (Supabase / localStorage);
  // virtual occurrences are computed at render time and carry a
  // `virtualParentId` so any tap routes back to the seed.
  const expandedAppointments = useMemo(() => {
    // Window: 30 days back ... 60 days forward from currentMonday so
    // every view (day/week/3days/month/agenda) sees its slice. Tight
    // enough to keep memory bounded; wider than any single view.
    const winStart = new Date(currentMonday);
    winStart.setDate(winStart.getDate() - 30);
    const winEnd = new Date(currentMonday);
    winEnd.setDate(winEnd.getDate() + 60);
    const fromKey = `${winStart.getFullYear()}-${String(winStart.getMonth() + 1).padStart(2, "0")}-${String(winStart.getDate()).padStart(2, "0")}`;
    const toKey = `${winEnd.getFullYear()}-${String(winEnd.getMonth() + 1).padStart(2, "0")}-${String(winEnd.getDate()).padStart(2, "0")}`;
    const out: Appointment[] = [];
    for (const a of appointments) {
      const rule = a.event_repeat;
      if (!rule || rule.kind === "none") {
        out.push(a);
        continue;
      }
      const expanded = expandRepeat(a, fromKey, toKey);
      for (const occ of expanded) out.push(occ);
    }
    return out;
  }, [appointments, currentMonday]);

  const visibleAppointments = useMemo(() => {
    const source = expandedAppointments;
    if (isPersonalTab) {
      // v499 — ULTRA permissive personal-tab filter. Two prior fixes
      // (v462, v497) still left a tail of «invisible events» where
      // the master_id pointed to a master that's no longer the
      // currentMasterId (user re-bootstrapped, master row deleted,
      // master list refetched with a different default). User report:
      // «опять записи удалились». Source of truth lives in Supabase
      // and localStorage — never in this filter. The personal tab
      // now shows EVERY appointment that isn't bound to a brigade.
      //
      // Why this is safe:
      //   • Supabase RLS (created_by = auth.uid()) prevents another
      //     user's events from ever entering the local state.
      //   • Multi-master scoping inside a tenant is done via brigade
      //     tabs (team_id filter); the personal tab is intentionally
      //     the «mine, by exclusion» view.
      //   • An appointment with team_id set is brigade-bound and
      //     belongs on its brigade tab, not here.
      return source.filter((a) => !a.team_id);
    }
    return source.filter((a) => a.team_id === activeTeamId);
  }, [expandedAppointments, activeTeamId, isPersonalTab]);

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

  // STORY audit: после save новой записи диспетчер часто оставался на
  // экране, где запись только что сохранил, не понимая что она в
  // календаре. Решение: переключаем view на неделю записи (или прямо
  // день в day-mode), чтобы свежая запись всегда была в visible зоне.
  // Безопасно вызывать на already-current week — setCurrentMonday
  // компонент дедуплицирует через ref check inside SwipeableCalendar.
  const navigateToAppointmentDate = useCallback(
    (dateKey: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
      const d = new Date(`${dateKey}T00:00:00`);
      if (Number.isNaN(d.getTime())) return;
      if (viewMode === "day") {
        setCurrentMonday(d);
      } else {
        setCurrentMonday(getMonday(d));
      }
    },
    [viewMode],
  );

  const handleTeamChange = useCallback((teamId: string) => {
    setActiveTeamId(teamId);
  }, []);

  // v511 — drag-reorder via the Header's chip strip (replaces the old
  // hacky long-press-swap-with-next). Receives the new id order of the
  // sortable brigade tabs (personal tab is pinned and excluded). We
  // persist by stamping sort_order on each moved team in steps of 10
  // — same shape as /dashboard/teams's reorder so both surfaces agree
  // on the canonical ordering. Untouched teams (inactive / not in the
  // strip) keep their existing sort_order.
  const handleTeamsReorder = useCallback(
    (newOrderIds: string[]) => {
      const indexById = new Map(newOrderIds.map((id, i) => [id, i]));
      const next = teams.map((t) => {
        const i = indexById.get(t.id);
        if (i === undefined) return t;
        const nextOrder = (i + 1) * 10;
        return t.sort_order === nextOrder ? t : { ...t, sort_order: nextOrder };
      });
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
    /** Chosen in TimeConfirmPopup: «Клиент» → "work", «Событие» → "event". */
    kind: "work" | "event";
  } | null>(null);

  // Pre-confirm popup: slot tap sets this, the popup confirms/edits the
  // time, then onConfirm transfers it into `booking` to open the sheet.
  const [pendingTimeConfirm, setPendingTimeConfirm] = useState<{
    dateKey: string;
    timeStart: string;
    timeEnd: string;
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
    // Personal-tab → event (no team). Otherwise honour the kind picked
    // in TimeConfirmPopup («Клиент» / «Событие»).
    const recordKind: "work" | "event" = personal ? "event" : booking.kind;
    const base = createBlankAppointment({
      date: booking.dateKey,
      time_start: booking.timeStart,
      time_end: booking.timeEnd,
      team_id: personal ? null : activeTeamId || null,
      kind: recordKind,
      // Brief #7 («Мой календарь»): a personal event without a
      // reminder is dead weight — the whole point of putting it in
      // the calendar is to be nudged. Seed push ON with a 15-minute
      // lead so the user just confirms instead of having to discover
      // the toggle on every new event. Editable in PersonalEventSheet.
      ...(personal
        ? { event_push_enabled: true, event_push_offsets: [15] }
        : {}),
    });
    return personal
      ? { ...base, master_id: currentMasterId ?? null }
      : base;
  }, [booking, activeTeamId, currentMasterId]);

  const openNewAppointmentInline = useCallback(
    (date: string | null, time: string | null, kind: "work" | "event") => {
      const today = new Date();
      // STORY audit: «Запись клиента» on the personal tab silently
      // no-op'd — the AppointmentSheet render guard (~L2167) skips when
      // activeTeam is null, so FAB → onCreateWork on the personal calendar
      // set inlineSheet without ever showing it. Auto-switch to the first
      // available brigade for kind="work" so the FAB always produces a
      // visible result. Events remain personal — they belong on the
      // personal calendar by design (kind="event").
      let teamIdForRecord = activeTeamId;
      if (kind === "work" && activeTeamId === PERSONAL_TAB_ID) {
        const firstBrigade = teams[0];
        if (firstBrigade) {
          teamIdForRecord = firstBrigade.id;
          handleTeamChange(firstBrigade.id);
          // STORY audit (reviewer fix): был silent switch — диспетчер
          // видел что таб поменялся и не понимал почему. Toast делает
          // переход explicit.
          toast.show({
            variant: "info",
            message: `Переключились на бригаду «${firstBrigade.name}» — клиентов записываем сюда`,
          });
        }
      }
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
        team_id: teamIdForRecord || null,
        kind,
      });
      setInlineSheet({ mode: "new", initial: blank });
    },
    [activeTeamId, teams, handleTeamChange, toast]
  );

  // Tap on empty slot → BookingSheet (STORY-002). Компонент сам
  // даёт выбор «Клиент/Событие» в сегмент-контроле. Phase I36 —
  // длительность новой записи = слот-настройка активной команды
  // (15/30/60), так же как и шаг снэпа. Дальше пересчитается по
  // выбранным услугам.
  const handleEmptySlotClick = useCallback(
    (date: string, time: string) => {
      const [h, m] = time.split(":").map(Number);
      const endMin = h * 60 + m + activeSlotMinutes;
      const endH = Math.floor(endMin / 60) % 24;
      const endM = endMin % 60;
      const timeEnd = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
      // Open the pre-confirm popup first; the AppointmentSheet opens
      // only after the dispatcher taps «Дальше →» (or edits the time).
      setPendingTimeConfirm({ dateKey: date, timeStart: time, timeEnd });
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
      // Beta #46 (CRM Core brief) — «Повторить заказ в один клик».
      // VisitsBlock passes `services=svc1,svc2` so the new draft
      // lands pre-filled with the same service ids. Each id is
      // validated against the catalog at render time inside the
      // AppointmentSheet; we just hand them through here.
      const servicesParam = params.get("services");
      const seededServiceIds = servicesParam
        ? servicesParam.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      const blank = createBlankAppointment({
        date: dateKey,
        time_start: "10:00",
        time_end: "11:00",
        team_id: activeTeamId || null,
        client_id: clientId || null,
        address: client?.address ?? "",
        kind: kindParam === "event" ? "event" : "work",
        service_ids: seededServiceIds,
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
    // Brief 2 #3 («Мой календарь»): when the user switches from
    // week/3days into day view, land on TODAY if today is inside the
    // currently visible window — not the Monday of the week. The
    // dispatcher viewing week 11-17 May who taps «День» on Saturday
    // expects to land on Saturday, not back at Monday 11. If today is
    // outside the current window the anchor is preserved (they're
    // looking at a different week deliberately).
    if (mode === "day") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const winStart = new Date(currentMonday);
      winStart.setHours(0, 0, 0, 0);
      const winEnd = addDays(winStart, stepDays - 1);
      if (today >= winStart && today <= winEnd) {
        setCurrentMonday(today);
      }
    } else if (mode === "week" || mode === "3days" || mode === "month") {
      // Going BACK to a multi-day window: snap to that window's Monday
      // so the user sees a clean week boundary, not «week starting
      // Saturday». Only when currentMonday isn't already a Monday.
      const dow = currentMonday.getDay(); // 0=Sun..6=Sat
      if (dow !== 1) {
        setCurrentMonday(getMonday(currentMonday));
      }
    }
    setViewMode(mode);
  }, [currentMonday, stepDays]);


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
        // STORY-060 §F3.7 — vim-style aliases: J = previous, K = next.
        case "j":
        case "J":
          e.preventDefault();
          handlePrevWeek();
          return;
        case "ArrowRight":
        case "k":
        case "K":
          e.preventDefault();
          handleNextWeek();
          return;
        case "t":
        case "T":
          e.preventDefault();
          handleToday();
          return;
        case "1":
        // STORY-060 §F3.7 — letter aliases mirror Google Calendar +
        // Linear: D/W/M (day / week / month). 3-day stays on "2" —
        // no clean letter that names it.
        case "d":
        case "D":
          e.preventDefault();
          setViewMode("day");
          return;
        case "2":
          e.preventDefault();
          setViewMode("3days");
          return;
        case "3":
        case "w":
        case "W":
          e.preventDefault();
          setViewMode("week");
          return;
        case "4":
        case "m":
        case "M":
          e.preventDefault();
          setViewMode("month");
          return;
        case "n":
        case "N":
          e.preventDefault();
          openNewAppointmentInline(null, null, "work");
          return;
        case "Escape":
          // Brief 1 #26: Esc closes the long-press action menu when
          // open. Other modals (AppointmentSheet, PersonalEventSheet,
          // CityPickerModal) own their own Esc handlers that gate on
          // their own dirty / open state.
          if (longPressApt) {
            e.preventDefault();
            setLongPressApt(null);
            return;
          }
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
    longPressApt,
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

      const nextStart = fmt(newStart);
      const nextEnd = fmt(newEnd);

      // Brief 1 #20 — conflict detection on drag-drop. Same rules as
      // AppointmentSheet's pre-save check, extracted to a shared
      // helper so both surfaces stay in sync. We warn but don't
      // block — two overlapping visits happen by accident in HVAC
      // dispatch all the time and the user is the source of truth.
      const overlap = findOverlap(
        {
          id: apt.id,
          date: dateKey,
          time_start: nextStart,
          time_end: nextEnd,
          team_id: apt.team_id,
          kind: apt.kind,
        },
        appointments,
      );
      if (overlap) {
        const detail = describeOverlap(overlap, (cid: string | null | undefined) =>
          cid ? clients.find((c) => c.id === cid)?.full_name ?? null : null,
        );
        toast.show({
          variant: "info",
          message: `Пересечение: ${detail}`,
        });
      }

      upsertAppointment({
        ...apt,
        date: dateKey,
        time_start: nextStart,
        time_end: nextEnd,
        updated_at: new Date().toISOString(),
      });
    },
    [appointments, clients, toast, upsertAppointment]
  );

  // City picker state for the tapped day
  const [cityPickerDateKey, setCityPickerDateKey] = useState<string | null>(null);
  const activeTeam = teams.find((t) => t.id === activeTeamId);
  // v492 — personal tab now has its own labels list + default,
  // managed at /dashboard/settings/calendar/labels (CalendarSettings
  // .personalLabels / .personalDefaultLabel). Brigade tabs keep
  // team.cities / team.default_city.
  const personalLabels = calendarSettings.personalLabels ?? [];
  const personalDefaultLabel = calendarSettings.personalDefaultLabel ?? "";
  const teamDefaultCity = isPersonalTab
    ? personalDefaultLabel
    : activeTeam?.default_city ?? "";
  const activeLabelNames = isPersonalTab
    ? personalLabels
    : activeTeam?.cities;
  // Phase I38 — brigade has any labels configured?
  // Empty list AND empty default → DayColumn hides the per-day chip
  // entirely (nothing to pick, no confusion for SaaS tenants that
  // don't use region tags at all).
  const brigadeHasLabels = isPersonalTab
    ? Boolean(personalDefaultLabel.trim() || personalLabels.length > 0)
    : Boolean(
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

  // Per-day finance footer. Dates mirror exactly what the grid renders
  // for the current offset-0 page (1 / 3 / 7 days from currentMonday).
  const footerDates = useMemo(() => {
    const count = viewMode === "week" ? 7 : viewMode === "3days" ? 3 : 1;
    return Array.from({ length: count }, (_, i) => addDays(currentMonday, i));
  }, [viewMode, currentMonday]);
  const dayFinanceSummary = useCallback(
    (dateKey: string): DayFinanceTotals => {
      const apptsForDay = visibleAppointments.filter((a) => a.date === dateKey);
      const extras = getExtrasFor(activeTeamId || null, dateKey);
      return computeDayFinance(apptsForDay, services, extras);
    },
    [visibleAppointments, services, getExtrasFor, activeTeamId],
  );

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
    // v693 — sentinel `__NONE__` tells getCityFor «explicitly cleared,
    // skip the brigade default». A bare "" would delete the override
    // entirely, letting the default city repaint on the next render.
    setCityFor(activeTeamId, cityPickerDateKey, "__NONE__");
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
          timeZone={activeBrigadeTimezone}
          tintByLabel={activeTintByLabel}
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

  // v796 — hold a neutral screen until the client has mounted. The SSR /
  // SW-cached HTML can't read localStorage, so it always sees zero teams;
  // painting the grid from that state is what flashed the empty calendar
  // before «Создать календарь» popped in. The hold reuses the same
  // PageHeader as the create screen, so on a teamless tenant the
  // transition just fades the card in — no grid, no jump.
  // v797 — also hold while the local store shows no teams but the cloud
  // backup hasn't settled (fresh device / cleared cache): the real
  // calendars may still be restoring, so we must NOT flash the create
  // screen prematurely (the user would make a junk team that the restore
  // then clobbers → the «бах»). `teamsLoaded` gates the real decision.
  if (!hydrated || (teamTabs.length === 0 && !teamsLoaded)) {
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
        <div className="flex-1 bg-[var(--surface-grouped)]" />
      </>
    );
  }

  // No-calendar gate. Reached only after the cloud backup has settled
  // (teamsLoaded) AND there are still no team tabs — so this is genuinely a
  // tenant with no calendar, not a mid-restore flash. «Мой календарь» is
  // parked (PERSONAL_CALENDAR_ENABLED), so the only real calendar is a team.
  if (teamTabs.length === 0) {
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
        <FirstRunCalendarChoice />
      </>
    );
  }

  return (
    <>
      <Header
        currentDate={currentMonday}
        activeTeamId={activeTeamId}
        teams={teamTabs}
        pinnedTeamId={PERSONAL_TAB_ID}
        viewMode={viewMode}
        allAppointments={appointments}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onToday={handleToday}
        onTeamChange={handleTeamChange}
        onTeamsReorder={handleTeamsReorder}
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
      <DndContext
        sensors={dndSensors}
        onDragEnd={handleDragEnd}
        accessibility={DND_A11Y_RU}
      >
        {viewMode === "agenda" ? (
          <AgendaView
            currentDate={currentMonday}
            appointments={visibleAppointments}
            clientsById={Object.fromEntries(
              clients.map((c) => [c.id, c]),
            )}
            services={services}
            hideCancelled={effectiveHideCancelled}
            onAppointmentClick={handleAppointmentClick}
            onCreateNew={() => openNewAppointmentInline(null, null, "work")}
          />
        ) : viewMode === "month" ? (
          <MonthView
            currentDate={currentMonday}
            appointments={visibleAppointments}
            summaryFor={dayFinanceSummary}
            onDayClick={(date) => {
              // Brief 2 #2 («Мой календарь»): clicking 15 May should
              // open day view on 15 May, not the Monday of that week.
              // In day mode `currentMonday` is misleadingly named — it's
              // the leftmost rendered date, with stepDays=1 → that single
              // day. So we set it to the clicked date directly. The
              // URL deep-link below makes it shareable.
              setCurrentMonday(date);
              setViewMode("day");
              if (typeof window !== "undefined") {
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, "0");
                const d = String(date.getDate()).padStart(2, "0");
                const url = new URL(window.location.href);
                url.searchParams.set("view", "day");
                url.searchParams.set("date", `${y}-${m}-${d}`);
                window.history.replaceState({}, "", url.toString());
              }
            }}
          />
        ) : (
          // Non-scrolling wrapper. The scroller below owns the vertical
          // scroll + pinch-zoom; the divider/corner overlays live here,
          // OUTSIDE the scroll content, so they can't drift on scroll or
          // lift on zoom (the previous in-column divider + sticky corner
          // moved together when applyZoom wrote scrollTop while --hh
          // changed inside the composited scroller).
          <div className="flex-1 flex flex-col min-h-0 relative">
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
            </div>

            {/* Fixed top-left corner mask — covers the time-column header
                cell so labels scrolling/zooming under it never show. */}
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 left-0 z-[5] w-12 lg:w-16 h-[64px] lg:h-[70px] bg-[var(--surface-card)]"
            />
            {/* Static time/grid divider — fixed in this non-scrolling
                wrapper, below the header, so it can't drift or lift. It
                runs down through the finance footer's gutter edge, which
                doubles as the label/numbers separator there. */}
            <div
              aria-hidden
              className="pointer-events-none absolute z-[5] left-12 lg:left-16 top-[64px] lg:top-[70px] bottom-0 w-[1.5px]"
              style={{ backgroundColor: "rgba(60, 60, 67, 0.26)" }}
            />
            {/* Pinned per-day finance footer — static strip below the
                grid, never scrolls. Mirrors the visible day columns. */}
            <DayFinanceFooter
              dates={footerDates}
              summaryFor={dayFinanceSummary}
              onDayTap={handleFooterTap}
            />
          </div>
        )}
      </DndContext>

      {/* STORY-060 F1.1 — onboarding card for the truly fresh tenant.
          Shows when there are 0 clients AND 0 services AND 0 appointments;
          steps through "client → service → appointment". For tenants that
          already have clients/services but no appointments yet, fall back
          to the existing small CalendarEmptyState hint below. */}
      {clients.length === 0 && services.length === 0 && appointments.length === 0 && (
        <CalendarOnboardingCard
          hasClients={clients.length > 0}
          hasServices={services.length > 0}
          hasAppointments={appointments.length > 0}
          onCreateAppointment={() => openNewAppointmentInline(null, null, "work")}
        />
      )}

      {/* STORY-059 — first-run empty state. Floats over the empty grid
          when the tenant has no appointments. Tapping "Добавить первую
          запись" opens the new-appointment sheet at the next round
          hour today; tapping any grid cell still works as the
          alternate path. */}
      <CalendarEmptyState
        appointmentsCount={appointments.length}
        mode={isPersonalTab ? "event" : "appointment"}
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

      {/* STORY audit: CalendarLegend ⓘ-кнопка убрана по запросу
          пользователя — на мобильном экране была лишним шумом рядом
          с FAB. Цвета записей операторы и так осваивают за пару дней,
          а тенант с десятком клиентов не нуждается в постоянном
          ключе на экране. Файл CalendarLegend.tsx сохранён — если
          понадобится вернуть, достаточно одного <CalendarLegend />. */}

      {/* City picker bottom sheet */}
      <CityPickerModal
        open={cityPickerDateKey !== null}
        onClose={() => setCityPickerDateKey(null)}
        current={cityPickerDateKey ? cityForDate(cityPickerDateKey) : ""}
        defaultCity={teamDefaultCity}
        dateKey={cityPickerDateKey ?? undefined}
        cities={cities}
        brigadeCities={activeLabelNames}
        onPick={handleCityPick}
        onReset={handleCityReset}
        settingsHref={labelSettingsHref}
      />

      {/* STORY audit (design-keeper unification): объединили два create-
          dispatch (PersonalEventSheet + AppointmentSheet) в один.
          AppointmentSheet знает personalMode и в этом режиме:
            · сегмент-toggle блокирует «Клиент» (см. AppointmentHeader fix)
            · context EventForm → "personal" (свои preset-chips)
            · client/services блоки игнорируются
          PersonalEventSheet остаётся как deprecated wrapper для
          обратной совместимости imports, но dispatch на нём больше
          не висит. */}
      {/* Slot-tap pre-confirm: one-wheel SlotConfirmPopup with
          stacked Событие / Клиент buttons. FAB path
          (openNewAppointmentInline) and existing-record taps do NOT go
          through this popup. */}
      <SlotConfirmPopup
        open={pendingTimeConfirm !== null}
        onClose={() => setPendingTimeConfirm(null)}
        dateKey={pendingTimeConfirm?.dateKey ?? ""}
        timeStart={pendingTimeConfirm?.timeStart ?? ""}
        timeEnd={pendingTimeConfirm?.timeEnd ?? ""}
        allDayRange={{ start: "00:00", end: "23:59" }}
        onConfirm={(kind, next) => {
          setBooking({
            dateKey: next.dateKey,
            timeStart: next.timeStart,
            timeEnd: next.timeEnd,
            kind,
          });
          setPendingTimeConfirm(null);
        }}
      />

      {booking && bookingAppointment && (
        <AppointmentSheet
          open={booking !== null}
          onClose={() => setBooking(null)}
          mode="create"
          appointment={bookingAppointment}
          clients={clients}
          recentClientIds={recentInChats}
          teams={teams}
          activeTeam={activeTeam ?? null}
          personalMode={isPersonalTab}
          masters={masters}
          catalog={services}
          categories={serviceCategories}
          cityForDate={cityForDate}
          visitsForClient={(cid) =>
            appointments.reduce(
              (n, a) =>
                a.client_id === cid && a.status === "completed" ? n + 1 : n,
              0,
            )
          }
          onCancelAppointment={() => setBooking(null)}
          onSave={(apt) => {
            upsertAppointment(apt);
            setBooking(null);
          }}
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

      {/* STORY audit: FAB убран по запросу пользователя. Создание
          записи — только через тап по пустому слоту в календаре.
          Компонент CalendarFab.tsx сохранён в репо как dead-code
          marker — если понадобится вернуть, достаточно одного блока
          <CalendarFab .../>. */}

      {/* Day finance detail popup — opens from the per-day footer tap.
          Shows totals + payment-method breakdown + completed services,
          and keeps the manual income/expense entry. */}
      {financeDateKey && (
        <DayFinanceModal
          open
          onClose={() => setFinanceDateKey(null)}
          dateKey={financeDateKey}
          cityLabel={cityForDate(financeDateKey) || undefined}
          appointments={visibleAppointments.filter(
            (a) => a.date === financeDateKey
          )}
          services={services}
          clientNameFor={(apt) => {
            const name = apt.client_id
              ? clients.find((c) => c.id === apt.client_id)?.full_name
              : null;
            return name || apt.comment?.trim() || "Без имени";
          }}
          extras={getExtrasFor(activeTeamId || null, financeDateKey)}
          tenantId={tenantId}
          onSave={(next) => {
            if (activeTeamId) setExtrasFor(activeTeamId, financeDateKey, next);
          }}
          onOpenAppointment={(apt) => {
            setFinanceDateKey(null);
            handleAppointmentClick(apt);
          }}
        />
      )}

      {/* Inline new/edit sheet — renders on top of the calendar, no route
          change. Keeps the calendar fully mounted so opening an
          appointment is instant.
          STORY audit (design-keeper unification): объединили personal-
          event edit и brigade-record edit в один AppointmentSheet с
          personalMode. PersonalEventSheet больше не маршрутизируется
          здесь — он остался как deprecated wrapper. activeTeam-guard
          снят: personalMode-sheet вообще не использует activeTeam,
          для brigade-sheet null-safe AppointmentSheet тоже работает. */}
      {inlineSheet && (
        <AppointmentSheet
          open
          onClose={() => setInlineSheet(null)}
          // Single inline screen: new records → create, every existing
          // record (scheduled / completed / cancelled, work or event) →
          // edit. Status is shown as a header label, not a separate
          // read-only layout.
          mode={inlineSheet.mode === "new" ? "create" : "edit"}
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
          visitsForClient={(cid) =>
            appointments.reduce(
              (n, a) =>
                a.client_id === cid && a.status === "completed" ? n + 1 : n,
              0,
            )
          }
          onSave={(apt) => {
            upsertAppointment(apt);
            // STORY audit (reviewer fix): jump calendar только если дата
            // записи реально сменилась. Раньше любой edit (например цена)
            // тоже триггерил navigate → re-center календарь и сбивал то,
            // что оператор только что читал. Сейчас сравниваем с
            // оригинальной датой inlineSheet.initial.
            const dateChanged = inlineSheet.initial.date !== apt.date;
            setInlineSheet(null);
            if (dateChanged) navigateToAppointmentDate(apt.date);
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
          // STORY audit (unification): personal events нужен hard-delete
          // (раньше через PersonalEventSheet onDelete). Work-записи
          // используют cancelled-status, не deleteAppointment. Прокидываем
          // обе функции — EventForm сам решит когда показать «Удалить».
          onDelete={(apt) => {
            deleteAppointment(apt.id);
            setInlineSheet(null);
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
