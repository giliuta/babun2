"use client";

import { useState, useCallback, useMemo } from "react";
import { getMonday, addWeeks, addDays } from "@/lib/date-utils";
import { getMockAppointments, MOCK_TEAMS, type MockAppointment } from "@/lib/mock-data";
import Header, { type ViewMode } from "@/components/layout/Header";
import WeekView from "@/components/calendar/WeekView";
import SwipeableCalendar from "@/components/calendar/SwipeableCalendar";
import AppointmentDialog from "@/components/appointments/AppointmentDialog";
import { useSidebar } from "./layout";

const ZOOM_LEVELS = [40, 60, 90, 120];

// How many days to advance per "next" / "prev" depending on view mode.
const STEP_DAYS: Record<ViewMode, number> = {
  day: 1,
  "3days": 3,
  week: 7,
};

export default function DashboardPage() {
  const sidebar = useSidebar();
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  const [activeTeamId, setActiveTeamId] = useState(MOCK_TEAMS[0].id);
  const [selectedAppointment, setSelectedAppointment] = useState<MockAppointment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [zoomIndex, setZoomIndex] = useState(1); // Default: 60px (index 1)
  const [prefillDate, setPrefillDate] = useState<string | undefined>();
  const [prefillTime, setPrefillTime] = useState<string | undefined>();

  const hourHeight = ZOOM_LEVELS[zoomIndex];
  const stepDays = STEP_DAYS[viewMode];

  // All appointments visible across the swipe pages — fetch a wide window so prev/next pages have data.
  // For now we use mock data which is generated relative to the current Monday.
  const allAppointments = useMemo(
    () => getMockAppointments(currentMonday),
    [currentMonday]
  );
  const appointments = useMemo(
    () => allAppointments.filter((a) => a.team_id === activeTeamId),
    [allAppointments, activeTeamId]
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

  const handleAppointmentClick = useCallback((appointment: MockAppointment) => {
    setSelectedAppointment(appointment);
    setPrefillDate(undefined);
    setPrefillTime(undefined);
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false);
    setSelectedAppointment(null);
    setPrefillDate(undefined);
    setPrefillTime(undefined);
  }, []);

  const handleSave = useCallback(
    (_data: Partial<MockAppointment>) => {
      handleDialogClose();
    },
    [handleDialogClose]
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

  const handleEmptySlotClick = useCallback((date: string, time: string) => {
    setSelectedAppointment(null);
    setPrefillDate(date);
    setPrefillTime(time);
    setDialogOpen(true);
  }, []);

  // Render a calendar page for a given offset (-1 prev, 0 current, +1 next)
  const renderPage = useCallback(
    (offset: -1 | 0 | 1) => {
      const monday =
        viewMode === "week"
          ? addWeeks(currentMonday, offset)
          : addDays(currentMonday, offset * stepDays);
      // For prev/next we don't load real appointments — they animate in then state updates
      const pageAppointments = offset === 0 ? appointments : [];
      return (
        <WeekView
          mondayDate={monday}
          appointments={pageAppointments}
          viewMode={viewMode}
          hourHeight={hourHeight}
          onAppointmentClick={handleAppointmentClick}
          onEmptySlotClick={handleEmptySlotClick}
        />
      );
    },
    [
      currentMonday,
      viewMode,
      stepDays,
      appointments,
      hourHeight,
      handleAppointmentClick,
      handleEmptySlotClick,
    ]
  );

  return (
    <>
      <Header
        currentDate={currentMonday}
        activeTeamId={activeTeamId}
        teams={MOCK_TEAMS}
        viewMode={viewMode}
        hourHeight={hourHeight}
        allAppointments={allAppointments}
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

      <SwipeableCalendar
        renderPage={renderPage}
        onSwipeLeft={handleNextWeek}
        onSwipeRight={handlePrevWeek}
      />

      <AppointmentDialog
        appointment={selectedAppointment}
        open={dialogOpen}
        onClose={handleDialogClose}
        onSave={handleSave}
        prefillDate={prefillDate}
        prefillTime={prefillTime}
        activeTeamId={activeTeamId}
      />
    </>
  );
}
