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
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { getMonday, addWeeks, addDays, formatDateLongRu } from "@/lib/date-utils";
import { MOCK_APPOINTMENTS, MOCK_SERVICES } from "@/lib/mock-data";
import type { Client } from "@/lib/clients";
import { getTeamSchedule, timeToMinutes, type TeamSchedule } from "@/lib/schedule";
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
import SpecialScheduleModal from "@/components/calendar/SpecialScheduleModal";
import RepeatCopyModal from "@/components/calendar/RepeatCopyModal";
import UndoToast from "@/components/ui/UndoToast";
import { BUILD_VERSION } from "@/lib/version";
import { haptic } from "@/lib/haptics";
import AppointmentSheet from "@/components/appointment/AppointmentSheet";
import ActionMenuModal, {
  type ActionMenuOption,
} from "@/components/calendar/ActionMenuModal";
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
  useCalendarSettings,
} from "./layout";
import { sumExtras } from "@/lib/day-extras";
import { loadChats } from "@/lib/chats";
import SuccessOverlay from "@/components/appointment/SuccessOverlay";
import PaymentSheet from "@/components/finance/PaymentSheet";
import ExpenseSheet from "@/components/finance/ExpenseSheet";
import TodayChip from "@/components/calendar/TodayChip";
import { EXPENSE_CATEGORIES } from "@/lib/finance/expense-categories";


import {
  useCalendarGestures,
  clampHourHeight,
  HOUR_HEIGHT_DEFAULT,
  HOUR_HEIGHT_STEP,
} from "@/hooks/useCalendarGestures";

// How many days to advance per "next" / "prev" depending on view mode.
// "month" uses a dedicated branch that jumps whole months.
const STEP_DAYS: Record<ViewMode, number> = {
  day: 1,
  "3days": 3,
  week: 7,
  month: 0,
};

const SEED_KEY = "babun-seeded";

export default function DashboardPage() {
  const router = useRouter();
  const sidebar = useSidebar();
  const { schedules, setSchedules } = useSchedules();
  const { teams, setTeams } = useTeams();
  const { getCityFor, setCityFor } = useDayCities();
  const { getExtrasFor, setExtrasFor } = useDayExtras();
  const { calendarSettings } = useCalendarSettings();
  const { appointments, upsertAppointment, deleteAppointment } = useAppointments();
  // Refs for the mount-only seed effect — lets the effect read current values
  // without listing them as deps, which would re-trigger on every render.
  const appointmentsRef = useRef(appointments);
  appointmentsRef.current = appointments;
  const upsertRef = useRef(upsertAppointment);
  upsertRef.current = upsertAppointment;
  const { requiredFields } = useFormSettings();
  const { services, categories: serviceCategories } = useServices();
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

  // Restore last-used view mode from localStorage, falling back to
  // "day" on mobile and "week" on desktop for the very first visit.
  const VIEW_MODE_KEY = "babun-view-mode";
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "week";
    const saved = window.localStorage.getItem(VIEW_MODE_KEY) as ViewMode | null;
    if (saved && ["day", "3days", "week", "month"].includes(saved)) return saved;
    return window.innerWidth < 1024 ? "day" : "week";
  });
  // Persist whenever the user switches
  useEffect(() => {
    window.localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);
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

  // Scroll to startHour on mount and when view changes from month to day/week.
  // We wait one frame so the grid is painted before scrolling.
  useLayoutEffect(() => {
    if (viewMode === "month") return;
    const el = outerScrollerRef.current;
    if (!el) return;
    const targetTop = calendarSettings.startHour * hourHeightRef.current;
    requestAnimationFrame(() => {
      el.scrollTop = targetTop;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  const { zoomBy, handleZoomIn, handleZoomOut } = useCalendarGestures({
    outerScrollerRef,
    hourHeightRef,
    writeHourHeight,
  });

  // Seed with mock data on first visit only
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (appointmentsRef.current.length > 0) return;
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
        location_id: null,
        team_id: m.team_id,
        service_ids: guessedServiceId ? [guessedServiceId] : [],
        payment: null,
        services: [],
        global_discount: null,
        total_duration: 0,
        total_amount: m.amount,
        custom_total: true,
        discount_amount: 0,
        expenses: [],
        service_price_overrides: {},
        color_override: null,
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
        reminder_offsets: [1440, 60],
        reminder_template:
          "Здравствуйте, {name}! Напоминаем: {date} в {time} по адресу {address}. Babun CRM",
        status: isEvent ? "scheduled" : "completed",
        created_at: now,
        updated_at: now,
      };
      upsertRef.current(apt);
    }
    window.localStorage.setItem(SEED_KEY, "1");
  }, []);

  // Filter appointments by active team
  const visibleAppointments = useMemo(
    () => appointments.filter((a) => a.team_id === activeTeamId),
    [appointments, activeTeamId]
  );

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
    return createBlankAppointment({
      date: booking.dateKey,
      time_start: booking.timeStart,
      time_end: booking.timeEnd,
      team_id: activeTeamId || null,
      kind: "work",
    });
  }, [booking, activeTeamId]);

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
  // даёт выбор «Клиент/Событие» в сегмент-контроле.
  const handleEmptySlotClick = useCallback((date: string, time: string) => {
    const [h, m] = time.split(":").map(Number);
    const endMin = h * 60 + m + 60;
    const endH = Math.floor(endMin / 60) % 24;
    const endM = endMin % 60;
    const timeEnd = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
    setBooking({ dateKey: date, timeStart: time, timeEnd });
  }, []);

  // BottomTabBar's centre button navigates here with ?new=1. Read the
  // flag directly from window.location.search so we don't pull in
  // useSearchParams(), which forces Next 16 to abort static
  // generation on this client-only page.
  // ?new=1 opens the creation form. ?client_id=X pre-fills the client
  // (used by "Записать на приём" from chats — Dima doesn't have to
  // search for the client again).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      const clientId = params.get("client_id");
      const client = clientId ? clients.find((c) => c.id === clientId) : null;
      const today = new Date();
      const blank = createBlankAppointment({
        date: today.toISOString().slice(0, 10),
        time_start: "10:00",
        time_end: "11:00",
        team_id: activeTeamId || null,
        client_id: clientId || null,
        address: client?.address ?? "",
        kind: "work",
      });
      setInlineSheet({ mode: "new", initial: blank });
      router.replace("/dashboard");
    }
  }, [activeTeamId, router, clients]);

  // Long-press action menu on an existing appointment.
  const [longPressApt, setLongPressApt] = useState<Appointment | null>(null);
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
    ]
  );

  // Slot menu removed — BookingSheet takes over directly (STORY-002).

  // Long-press menu — only actions that Dima actually uses.
  // No disabled stubs, no rarely-used items.
  const longPressOptions: ActionMenuOption[] = longPressApt
    ? [
        // STORY-003: "Отметить оплату" for scheduled appointments
        // opens the PaymentSheet (cash / card / cancel).
        ...(longPressApt.status === "scheduled" && longPressApt.kind === "work"
          ? [{
              label: "💵 Отметить оплату",
              onSelect: () => setPaymentApt(longPressApt),
            }]
          : []),
        // Quick status changes — the most common action
        ...(longPressApt.status !== "completed"
          ? [{
              label: "✅ Выполнена",
              onSelect: () => handleQuickStatus(longPressApt, "completed"),
            }]
          : []),
        ...(longPressApt.status !== "in_progress"
          ? [{
              label: "🔄 В работе",
              onSelect: () => handleQuickStatus(longPressApt, "in_progress"),
            }]
          : []),
        ...(longPressApt.status !== "scheduled" && longPressApt.status !== "cancelled"
          ? [{
              label: "📅 Вернуть в план",
              onSelect: () => handleQuickStatus(longPressApt, "scheduled"),
            }]
          : []),
        // Copy — useful for recurring clients
        {
          label: "📋 Копировать",
          onSelect: () => {
            const copy = duplicateAppointment(longPressApt);
            upsertAppointment(copy);
            setInlineSheet({ mode: "edit", initial: copy });
          },
        },
        // Cancel / restore
        {
          label: longPressApt.status === "cancelled" ? "♻️ Восстановить" : "❌ Отменить",
          onSelect: () => handleCancelToggle(longPressApt),
        },
        // Delete
        {
          label: "🗑 Удалить",
          danger: true,
          onSelect: () => handleDeleteWithUndo(longPressApt),
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
        onTeamLongPress={handleTeamLongPress}
        onViewModeChange={handleViewModeChange}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onSelectDate={handleSelectDate}
        onMenuToggle={sidebar.toggle}
      />

      {/* STORY-003: thin action bar under the header.
          Single TodayChip replaces the 7-column per-day income footer. */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 py-1 flex items-center gap-2">
        <TodayChip
          appointments={visibleAppointments}
          teamId={activeTeamId}
          onOpen={() => router.push("/dashboard/finances")}
        />
        <button
          type="button"
          onClick={() => {
            const today = new Date();
            const y = today.getFullYear();
            const m = String(today.getMonth() + 1).padStart(2, "0");
            const d = String(today.getDate()).padStart(2, "0");
            setExpenseFor({
              dateKey: `${y}-${m}-${d}`,
              dayLabel: "Сегодня",
            });
          }}
          className="flex items-center gap-1 h-7 px-2.5 rounded-full bg-rose-50 text-rose-700 text-[11px] font-semibold active:bg-rose-100"
        >
          <span>+</span> Расход
        </button>
        {Object.keys(EXPENSE_CATEGORIES).length > 0 && null}
      </div>

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
        {BUILD_VERSION}
      </div>

      {/* City picker bottom sheet */}
      <CityPickerModal
        open={cityPickerDateKey !== null}
        onClose={() => setCityPickerDateKey(null)}
        current={cityPickerDateKey ? cityForDate(cityPickerDateKey) : ""}
        defaultCity={teamDefaultCity}
        dateKey={cityPickerDateKey ?? undefined}
        onPick={handleCityPick}
        onReset={handleCityReset}
      />

      {/* STORY-002-FINAL: единый AppointmentSheet для create-режима
          (тап по пустому слоту). Внутри sheet — segment Клиент/Событие. */}
      {booking && activeTeam && bookingAppointment && (
        <AppointmentSheet
          open={booking !== null}
          onClose={() => setBooking(null)}
          mode="create"
          appointment={bookingAppointment}
          clients={clients}
          recentClientIds={recentInChats}
          teams={teams}
          activeTeam={activeTeam}
          catalog={services}
          categories={serviceCategories}
          cityForDate={cityForDate}
          onCityChange={(dk, city) => setCityFor(activeTeamId || "", dk, city)}
          onCancelAppointment={() => setBooking(null)}
          onSave={(apt) => {
            upsertAppointment(apt);
            setBooking(null);
            if (apt.kind === "work" && apt.client_id) {
              const c = clients.find((x) => x.id === apt.client_id);
              if (c) {
                const chatLinkId = loadChats().find((ch) => ch.client_id === c.id)?.id;
                setSavedSuccess({
                  name: c.full_name,
                  phone: c.phone,
                  chatHref: chatLinkId
                    ? `/dashboard/chats?chat_id=${chatLinkId}`
                    : undefined,
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

      {/* Desktop-only FAB — mobile uses the centre action in BottomTabBar */}
      <button
        type="button"
        onClick={() => openNewAppointmentInline(null, null, "work")}
        aria-label="Новая запись"
        className="hidden lg:flex fixed bottom-6 right-6 w-14 h-14 rounded-full bg-violet-600 text-white shadow-lg items-center justify-center active:scale-95 transition z-30 hover:bg-violet-700"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

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
      {/* STORY-002-FINAL: view/done режимы единого sheet открываются
          по тапу на существующую запись (handleAppointmentClick). */}
      {inlineSheet && activeTeam && (
        <AppointmentSheet
          open
          onClose={() => setInlineSheet(null)}
          mode={inlineSheet.initial.status === "completed" ? "done" : "view"}
          appointment={inlineSheet.initial}
          clients={clients}
          recentClientIds={recentInChats}
          teams={teams}
          activeTeam={activeTeam}
          catalog={services}
          categories={serviceCategories}
          cityForDate={cityForDate}
          onCityChange={(dk, city) => setCityFor(activeTeamId || "", dk, city)}
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
        />
      )}
    </>
  );
}
