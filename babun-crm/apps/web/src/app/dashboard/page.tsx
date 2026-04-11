"use client";

import {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { getMonday, addWeeks, addDays } from "@/lib/date-utils";
import { MOCK_APPOINTMENTS, MOCK_SERVICES } from "@/lib/mock-data";
import type { Client } from "@/lib/clients";
import { getTeamSchedule, timeToMinutes } from "@/lib/schedule";
import {
  type Appointment,
  validateAppointment,
  duplicateAppointment,
  createBlankAppointment,
} from "@/lib/appointments";
import Header, { type ViewMode } from "@/components/layout/Header";
import WeekView from "@/components/calendar/WeekView";
import SwipeableCalendar from "@/components/calendar/SwipeableCalendar";
import TimeColumn from "@/components/calendar/TimeColumn";
import MonthView from "@/components/calendar/MonthView";
import CityPickerModal from "@/components/calendar/CityPickerModal";
import DayFinanceModal from "@/components/calendar/DayFinanceModal";
import NewAppointmentSheet from "@/components/appointments/sheet/NewAppointmentSheet";
import ActionMenuModal, {
  type ActionMenuOption,
} from "@/components/calendar/ActionMenuModal";
import {
  loadDraftClients,
  type DraftClient,
} from "@/lib/draft-clients";
import {
  useSidebar,
  useSchedules,
  useTeams,
  useAppointments,
  useFormSettings,
  useServices,
  useClients,
  useDayCities,
  useDayExtras,
} from "./layout";
import { sumExtras } from "@/lib/day-extras";

// Formats "2026-04-12" as "12 апреля 2026 г."
function formatDateLongRu(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  if (isNaN(d.getTime())) return dateKey;
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} г.`;
}

const HOUR_HEIGHT_MIN = 24;
const HOUR_HEIGHT_MAX = 480;
const HOUR_HEIGHT_DEFAULT = 60;
const HOUR_HEIGHT_STEP = 20;

// Bump this when you want visible confirmation that a new build is live.
const BUILD_TAG = "v44-day-finance";

// How many days to advance per "next" / "prev" depending on view mode.
// "month" uses a dedicated branch that jumps whole months.
const STEP_DAYS: Record<ViewMode, number> = {
  day: 1,
  "3days": 3,
  week: 7,
  month: 0,
};

function clampHourHeight(h: number): number {
  return Math.max(HOUR_HEIGHT_MIN, Math.min(HOUR_HEIGHT_MAX, h));
}

const SEED_KEY = "babun-seeded";

export default function DashboardPage() {
  const router = useRouter();
  const sidebar = useSidebar();
  const { schedules } = useSchedules();
  const { teams } = useTeams();
  const { getCityFor, setCityFor } = useDayCities();
  const { getExtrasFor, setExtrasFor } = useDayExtras();
  const { appointments, upsertAppointment, deleteAppointment } = useAppointments();
  const { requiredFields } = useFormSettings();
  const { services } = useServices();
  const { clients } = useClients();

  // Header tabs need a stable shape: { id, name }
  const teamTabs = useMemo(
    () => teams.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name })),
    [teams]
  );
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  const [activeTeamId, setActiveTeamId] = useState<string>("");

  // When teams load (or change), make sure the active team is still valid
  useEffect(() => {
    if (teamTabs.length === 0) {
      setActiveTeamId("");
      return;
    }
    if (!teamTabs.some((t) => t.id === activeTeamId)) {
      setActiveTeamId(teamTabs[0].id);
    }
  }, [teamTabs, activeTeamId]);

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  // hourHeight is not React state — it lives in a ref and is written as
  // a CSS variable on the outer scroller via writeHourHeight(). This keeps
  // pinch-zoom off the React render path entirely.
  const hourHeightRef = useRef(HOUR_HEIGHT_DEFAULT);

  const stepDays = STEP_DAYS[viewMode];
  const activeSchedule = useMemo(
    () => getTeamSchedule(activeTeamId, schedules),
    [activeTeamId, schedules]
  );

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

  // Seed with mock data on first visit only
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (appointments.length > 0) return;
    if (window.localStorage.getItem(SEED_KEY)) return;

    const now = new Date().toISOString();
    for (const m of MOCK_APPOINTMENTS) {
      const isEvent = !m.client_name && m.amount === 0;
      const guessedServiceId = MOCK_SERVICES.find(
        (s) => s.name.toLowerCase() === m.service_name.toLowerCase()
      )?.id;
      const apt: Appointment = {
        id: m.id,
        date: m.date,
        time_start: m.time_start,
        time_end: m.time_end,
        client_id: null,
        team_id: m.team_id,
        service_ids: guessedServiceId ? [guessedServiceId] : [],
        total_amount: m.amount,
        custom_total: true,
        discount_amount: 0,
        expenses: [],
        service_price_overrides: {},
        prepaid_amount: m.amount, // seed as fully paid so we don't mark as debt
        payments: [],
        comment: m.client_name ? `${m.client_name} — ${m.comment}` : m.comment,
        address: "",
        address_lat: null,
        address_lng: null,
        source: null,
        is_online_booking: false,
        kind: isEvent ? "event" : "work",
        photos: [],
        reminder_enabled: false,
        status: isEvent ? "scheduled" : "completed",
        created_at: now,
        updated_at: now,
      };
      upsertAppointment(apt);
    }
    window.localStorage.setItem(SEED_KEY, "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to the team's work-start hour when schedule/team changes.
  // NOTE: hourHeight is intentionally NOT a dependency — zoom handlers manage
  // their own scroll preservation, so reacting here would fight them.
  useEffect(() => {
    const el = outerScrollerRef.current;
    if (!el) return;
    const startMin = timeToMinutes(activeSchedule.start);
    const target = Math.max(0, startMin * (hourHeightRef.current / 60));
    el.scrollTo({ top: target, behavior: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTeamId, activeSchedule.start]);

  // Filter appointments by active team
  const visibleAppointments = useMemo(
    () => appointments.filter((a) => a.team_id === activeTeamId),
    [appointments, activeTeamId]
  );

  // Build clientsById map
  const [draftClients, setDraftClients] = useState<DraftClient[]>([]);
  useEffect(() => {
    setDraftClients(loadDraftClients());
  }, [appointments]);

  const clientsById = useMemo<Record<string, Client | DraftClient>>(() => {
    const map: Record<string, Client | DraftClient> = {};
    for (const c of clients) map[c.id] = c;
    for (const d of draftClients) map[d.id] = d;
    return map;
  }, [clients, draftClients]);

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

  // Inline sheet state — keeping the calendar mounted means opening and
  // closing an appointment is instant (no route transition, no unmount).
  const [inlineSheet, setInlineSheet] = useState<
    | { mode: "new" | "edit"; initial: Appointment }
    | null
  >(null);

  // Day finance modal state
  const [financeDateKey, setFinanceDateKey] = useState<string | null>(null);

  const handleFooterTap = useCallback((dateKey: string) => {
    setFinanceDateKey(dateKey);
  }, []);

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

  // Slot action menu — opens when user taps an empty spot on the calendar.
  const [slotMenu, setSlotMenu] = useState<{ date: string; time: string } | null>(
    null
  );
  const handleEmptySlotClick = useCallback((date: string, time: string) => {
    setSlotMenu({ date, time });
  }, []);

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

  // Long-press action menu on an existing appointment.
  const [longPressApt, setLongPressApt] = useState<Appointment | null>(null);
  const handleAppointmentLongPress = useCallback((apt: Appointment) => {
    setLongPressApt(apt);
  }, []);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  // Zoom around the vertical center of the viewport so the same time stays
  // visible. Writes directly to the DOM — no React re-render during motion.
  const zoomBy = useCallback(
    (nextH: number) => {
      const el = outerScrollerRef.current;
      const clamped = clampHourHeight(nextH);
      const prev = hourHeightRef.current;
      if (clamped === prev) return;
      let nextScroll: number | null = null;
      if (el) {
        const focusY = el.clientHeight / 2;
        const anchor = (el.scrollTop + focusY) / prev;
        nextScroll = anchor * clamped - focusY;
      }
      writeHourHeight(clamped);
      if (el && nextScroll !== null) {
        requestAnimationFrame(() => {
          if (outerScrollerRef.current) {
            outerScrollerRef.current.scrollTop = nextScroll!;
          }
        });
      }
    },
    [writeHourHeight]
  );

  const handleZoomIn = useCallback(() => {
    zoomBy(hourHeightRef.current + HOUR_HEIGHT_STEP);
  }, [zoomBy]);

  const handleZoomOut = useCallback(() => {
    zoomBy(hourHeightRef.current - HOUR_HEIGHT_STEP);
  }, [zoomBy]);

  // ─── Pinch-to-zoom (touch) + Ctrl+wheel (desktop) ───────────────────────
  // Uses THREE input sources for maximum browser coverage:
  //  1. touchstart/touchmove (Android Chrome)
  //  2. gesturestart/gesturechange (iOS Safari — non-standard but required)
  //  3. wheel with ctrl/meta key (desktop trackpad pinch + ctrl+scroll)
  //
  // Listeners are attached to the calendar scroller so they work on ANY
  // point inside the calendar (time column, day columns, appointment blocks).
  useEffect(() => {
    const el = outerScrollerRef.current;
    if (!el) return;

    let pinchStartDist = 0;
    let pinchStartH = hourHeightRef.current;
    let pinchMidY = 0;
    let pinchStartScroll = 0;
    let pinchActive = false;

    const distance = (a: Touch, b: Touch) =>
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    const applyZoom = (next: number, focusY: number, anchor: number) => {
      if (Math.abs(next - hourHeightRef.current) < 0.5) return;
      writeHourHeight(next);
      const scroller = outerScrollerRef.current;
      if (scroller) scroller.scrollTop = anchor * next - focusY;
    };

    // ── Standard multi-touch (Android / Chrome) ──────────────────────
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        pinchActive = true;
        pinchStartDist = distance(t0, t1);
        pinchStartH = hourHeightRef.current;
        const rect = el.getBoundingClientRect();
        pinchMidY = (t0.clientY + t1.clientY) / 2 - rect.top;
        pinchStartScroll = el.scrollTop;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pinchActive || e.touches.length < 2) return;
      if (e.cancelable) e.preventDefault();
      const d = distance(e.touches[0], e.touches[1]);
      if (pinchStartDist <= 0) return;
      const ratio = d / pinchStartDist;
      const next = clampHourHeight(pinchStartH * ratio);
      const anchor = (pinchStartScroll + pinchMidY) / pinchStartH;
      applyZoom(next, pinchMidY, anchor);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchActive = false;
    };

    // ── iOS Safari gesture events (non-standard but only way for pinch) ──
    let gestureStartH = hourHeightRef.current;
    let gestureStartScroll = 0;
    let gestureMidY = 0;

    const onGestureStart = (e: Event) => {
      const ge = e as Event & { scale?: number; clientY?: number };
      e.preventDefault();
      gestureStartH = hourHeightRef.current;
      gestureStartScroll = el.scrollTop;
      const rect = el.getBoundingClientRect();
      // iOS puts touch center roughly at event.clientY, fall back to viewport center
      gestureMidY = (ge.clientY ?? rect.top + rect.height / 2) - rect.top;
    };

    const onGestureChange = (e: Event) => {
      const ge = e as Event & { scale?: number };
      e.preventDefault();
      const scale = ge.scale ?? 1;
      const next = clampHourHeight(gestureStartH * scale);
      const anchor = (gestureStartScroll + gestureMidY) / gestureStartH;
      applyZoom(next, gestureMidY, anchor);
    };

    const onGestureEnd = (e: Event) => {
      e.preventDefault();
    };

    // ── Desktop wheel (ctrl/meta modifier for trackpad pinch or ctrl+scroll) ─
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = -e.deltaY;
      const factor = Math.exp(delta * 0.005);
      const next = clampHourHeight(hourHeightRef.current * factor);
      const rect = el.getBoundingClientRect();
      const focusY = e.clientY - rect.top;
      const anchor = (el.scrollTop + focusY) / hourHeightRef.current;
      applyZoom(next, focusY, anchor);
    };

    // iOS Safari handles pinch via gesturestart/gesturechange, so we
    // can keep touchmove passive there and let the browser scroll at
    // 120 Hz. Android Chrome (and desktop Chrome with touch) needs
    // non-passive touchmove to intercept the pinch — but that costs a
    // non-compositor-driven scroll. Since Babun2 is iPhone-first, we
    // register touchmove passive when iOS is detected.
    const isIOS =
      typeof navigator !== "undefined" &&
      /iPad|iPhone|iPod/.test(navigator.userAgent);

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, {
      passive: isIOS ? true : false,
    });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    el.addEventListener("gesturestart", onGestureStart as EventListener);
    el.addEventListener("gesturechange", onGestureChange as EventListener);
    el.addEventListener("gestureend", onGestureEnd as EventListener);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("gesturestart", onGestureStart as EventListener);
      el.removeEventListener("gesturechange", onGestureChange as EventListener);
      el.removeEventListener("gestureend", onGestureEnd as EventListener);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  const handleSelectDate = useCallback((monday: Date) => {
    setCurrentMonday(monday);
  }, []);

  // ─── dnd-kit sensors: mouse for desktop, touch with delay for mobile ───
  // TouchSensor delay is set longer than the appointment block's 550 ms
  // long-press timer so the context menu wins over drag activation.
  const dndSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 700, tolerance: 8 },
    })
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
          extrasForDate={extrasForDate}
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
      extrasForDate,
    ]
  );

  // ─── Slot & long-press menu option builders ───────────────────────────
  const slotMenuOptions: ActionMenuOption[] = slotMenu
    ? [
        {
          label: "Записать клиента",
          subtitle: "с выбором свободного времени",
          onSelect: () => openNewAppointmentInline(null, null, "work"),
        },
        {
          label: `Записать клиента на ${slotMenu.time}`,
          subtitle: formatDateLongRu(slotMenu.date),
          onSelect: () =>
            openNewAppointmentInline(slotMenu.date, slotMenu.time, "work"),
        },
        {
          label: "Создать личное событие",
          subtitle: "с выбором свободного времени",
          onSelect: () => openNewAppointmentInline(null, null, "event"),
        },
        {
          label: `Создать личное событие на ${slotMenu.time}`,
          subtitle: formatDateLongRu(slotMenu.date),
          onSelect: () =>
            openNewAppointmentInline(slotMenu.date, slotMenu.time, "event"),
        },
      ]
    : [];

  const longPressOptions: ActionMenuOption[] = longPressApt
    ? [
        {
          label: "Свободное перемещение",
          subtitle: "Перетащить запись пальцем",
          disabled: true,
          onSelect: () => {},
        },
        {
          label: "Копировать запись",
          onSelect: () => {
            const copy = duplicateAppointment(longPressApt);
            upsertAppointment(copy);
            router.push(`/dashboard/appointment/${copy.id}`);
          },
        },
        {
          label: "Копировать многократно",
          subtitle: "Скоро",
          disabled: true,
          onSelect: () => {},
        },
        {
          label: "Перенести запись",
          subtitle: "Скоро",
          disabled: true,
          onSelect: () => {},
        },
        {
          label:
            longPressApt.status === "cancelled"
              ? "Восстановить запись"
              : "Запись отменена",
          onSelect: () => {
            upsertAppointment({
              ...longPressApt,
              status:
                longPressApt.status === "cancelled" ? "scheduled" : "cancelled",
              updated_at: new Date().toISOString(),
            });
          },
        },
        {
          label: "Удалить",
          danger: true,
          onSelect: () => {
            if (typeof window !== "undefined" && !window.confirm("Удалить запись?"))
              return;
            deleteAppointment(longPressApt.id);
          },
        },
      ]
    : [];

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
        onViewModeChange={handleViewModeChange}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onSelectDate={handleSelectDate}
        onMenuToggle={sidebar.toggle}
      />

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
            className="flex-1 flex bg-white min-h-0 relative"
            style={{
              overflowY: "auto",
              overflowX: "clip",
              touchAction: "pan-y",
              overscrollBehavior: "contain",
              // iOS momentum scrolling + GPU composition for butter-smooth
              // 120 Hz scrolling. transform forces a dedicated layer so the
              // compositor can scroll without touching the main thread.
              WebkitOverflowScrolling: "touch",
              transform: "translateZ(0)",
              willChange: "scroll-position",
              contain: "paint",
            }}
          >
            <TimeColumn />
            <SwipeableCalendar
              renderPage={renderPage}
              onSwipeLeft={handleNextWeek}
              onSwipeRight={handlePrevWeek}
            />
          </div>
        )}
      </DndContext>

      {/* Build tag — visible proof that latest code is running */}
      <div
        className="fixed left-2 z-30 pointer-events-none text-[10px] font-mono bg-black/70 text-white px-1.5 py-0.5 rounded"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 0.25rem)" }}
      >
        {BUILD_TAG}
      </div>

      {/* City picker modal */}
      <CityPickerModal
        open={cityPickerDateKey !== null}
        onClose={() => setCityPickerDateKey(null)}
        current={cityPickerDateKey ? cityForDate(cityPickerDateKey) : ""}
        defaultCity={teamDefaultCity}
        onPick={handleCityPick}
        onReset={handleCityReset}
      />

      {/* Empty-slot action menu */}
      <ActionMenuModal
        open={slotMenu !== null}
        onClose={() => setSlotMenu(null)}
        title="Выберите действие"
        options={slotMenuOptions}
      />

      {/* Appointment long-press action menu */}
      <ActionMenuModal
        open={longPressApt !== null}
        onClose={() => setLongPressApt(null)}
        title="Выберите действие"
        options={longPressOptions}
      />

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
      {inlineSheet && (
        <div className="fixed inset-0 z-40 bg-gray-50 flex flex-col">
          <NewAppointmentSheet
            initial={inlineSheet.initial}
            mode={inlineSheet.mode}
            onClose={() => setInlineSheet(null)}
          />
        </div>
      )}
    </>
  );
}
