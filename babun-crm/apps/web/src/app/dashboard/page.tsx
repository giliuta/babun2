"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { getMonday, addWeeks, addDays } from "@/lib/date-utils";
import { MOCK_APPOINTMENTS, MOCK_CLIENTS, type MockClient } from "@/lib/mock-data";
import { getTeamSchedule, timeToMinutes } from "@/lib/schedule";
import {
  type Appointment,
  validateAppointment,
} from "@/lib/appointments";
import Header, { type ViewMode } from "@/components/layout/Header";
import WeekView from "@/components/calendar/WeekView";
import SwipeableCalendar from "@/components/calendar/SwipeableCalendar";
import TimeColumn from "@/components/calendar/TimeColumn";
import {
  loadDraftClients,
  type DraftClient,
} from "@/components/appointments/AppointmentForm";
import {
  useSidebar,
  useSchedules,
  useTeams,
  useAppointments,
  useFormSettings,
} from "./layout";

const ZOOM_LEVELS = [40, 60, 90, 120];

// How many days to advance per "next" / "prev" depending on view mode.
const STEP_DAYS: Record<ViewMode, number> = {
  day: 1,
  "3days": 3,
  week: 7,
};

const SEED_KEY = "babun-seeded";

export default function DashboardPage() {
  const router = useRouter();
  const sidebar = useSidebar();
  const { schedules } = useSchedules();
  const { teams } = useTeams();
  const { appointments, upsertAppointment } = useAppointments();
  const { requiredFields } = useFormSettings();

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
  const [zoomIndex, setZoomIndex] = useState(1); // Default: 60px (index 1)

  const hourHeight = ZOOM_LEVELS[zoomIndex];
  const stepDays = STEP_DAYS[viewMode];
  const activeSchedule = useMemo(
    () => getTeamSchedule(activeTeamId, schedules),
    [activeTeamId, schedules]
  );

  // Single shared vertical scroller for time column + day columns
  const outerScrollerRef = useRef<HTMLDivElement>(null);

  // Seed with mock data on first visit only
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (appointments.length > 0) return;
    if (window.localStorage.getItem(SEED_KEY)) return;

    const now = new Date().toISOString();
    for (const m of MOCK_APPOINTMENTS) {
      const apt: Appointment = {
        id: m.id,
        date: m.date,
        time_start: m.time_start,
        time_end: m.time_end,
        client_id: null,
        team_id: m.team_id,
        service_ids: [],
        total_amount: m.amount,
        custom_total: true,
        prepaid_amount: 0,
        payments: [],
        comment: m.client_name ? `${m.client_name} — ${m.comment}` : m.comment,
        address: "",
        address_lat: null,
        address_lng: null,
        source: null,
        reminder_enabled: false,
        status: "scheduled",
        created_at: now,
        updated_at: now,
      };
      upsertAppointment(apt);
    }
    window.localStorage.setItem(SEED_KEY, "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to the team's work-start hour when schedule/team/zoom changes
  useEffect(() => {
    const el = outerScrollerRef.current;
    if (!el) return;
    const startMin = timeToMinutes(activeSchedule.start);
    const target = Math.max(0, startMin * (hourHeight / 60));
    el.scrollTo({ top: target, behavior: "auto" });
  }, [activeTeamId, activeSchedule.start, hourHeight]);

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

  const clientsById = useMemo<Record<string, MockClient | DraftClient>>(() => {
    const map: Record<string, MockClient | DraftClient> = {};
    for (const c of MOCK_CLIENTS) map[c.id] = c;
    for (const d of draftClients) map[d.id] = d;
    return map;
  }, [draftClients]);

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

  const handleAppointmentClick = useCallback(
    (appointment: Appointment) => {
      router.push(`/dashboard/appointment/${appointment.id}`);
    },
    [router]
  );

  const handleEmptySlotClick = useCallback(
    (date: string, time: string) => {
      const params = new URLSearchParams({ date, time });
      if (activeTeamId) params.set("team_id", activeTeamId);
      router.push(`/dashboard/appointment/new?${params.toString()}`);
    },
    [router, activeTeamId]
  );

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomIndex((prev) => Math.min(prev + 1, ZOOM_LEVELS.length - 1));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleSelectDate = useCallback((monday: Date) => {
    setCurrentMonday(monday);
  }, []);

  const handleNewAppointment = useCallback(() => {
    const params = new URLSearchParams();
    if (activeTeamId) params.set("team_id", activeTeamId);
    const qs = params.toString();
    router.push(`/dashboard/appointment/new${qs ? `?${qs}` : ""}`);
  }, [router, activeTeamId]);

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
          validateApt={validateApt}
          viewMode={viewMode}
          hourHeight={hourHeight}
          schedule={activeSchedule}
          onAppointmentClick={handleAppointmentClick}
          onEmptySlotClick={handleEmptySlotClick}
        />
      );
    },
    [
      currentMonday,
      viewMode,
      stepDays,
      visibleAppointments,
      clientsById,
      validateApt,
      hourHeight,
      activeSchedule,
      handleAppointmentClick,
      handleEmptySlotClick,
    ]
  );

  return (
    <>
      <Header
        currentDate={currentMonday}
        activeTeamId={activeTeamId}
        teams={teamTabs}
        viewMode={viewMode}
        hourHeight={hourHeight}
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
      <div
        ref={outerScrollerRef}
        className="flex-1 flex bg-white min-h-0 relative"
        style={{ overflowY: "auto", overflowX: "clip" }}
      >
        <TimeColumn hourHeight={hourHeight} />
        <SwipeableCalendar
          renderPage={renderPage}
          onSwipeLeft={handleNextWeek}
          onSwipeRight={handlePrevWeek}
        />
      </div>

      {/* FAB — new appointment */}
      <button
        type="button"
        aria-label="Новая запись"
        onClick={handleNewAppointment}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl hover:bg-indigo-700 transition-colors z-20"
      >
        +
      </button>
    </>
  );
}
