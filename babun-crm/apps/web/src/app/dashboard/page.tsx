"use client";

import { useState, useCallback } from "react";
import { getMonday, addWeeks } from "@/lib/date-utils";
import { getMockAppointments, MOCK_TEAMS, type MockAppointment } from "@/lib/mock-data";
import Header, { type ViewMode } from "@/components/layout/Header";
import WeekView from "@/components/calendar/WeekView";
import AppointmentDialog from "@/components/appointments/AppointmentDialog";

const ZOOM_LEVELS = [40, 60, 90, 120];

export default function DashboardPage() {
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  const [activeTeamId, setActiveTeamId] = useState(MOCK_TEAMS[0].id);
  const [selectedAppointment, setSelectedAppointment] = useState<MockAppointment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [zoomIndex, setZoomIndex] = useState(1); // Default: 60px (index 1)
  const [prefillDate, setPrefillDate] = useState<string | undefined>();
  const [prefillTime, setPrefillTime] = useState<string | undefined>();

  const hourHeight = ZOOM_LEVELS[zoomIndex];

  // Get appointments for the current week filtered by team
  const allAppointments = getMockAppointments(currentMonday);
  const appointments = allAppointments.filter((a) => a.team_id === activeTeamId);

  const handlePrevWeek = useCallback(() => {
    setCurrentMonday((prev) => addWeeks(prev, -1));
  }, []);

  const handleNextWeek = useCallback(() => {
    setCurrentMonday((prev) => addWeeks(prev, 1));
  }, []);

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

  const handleSave = useCallback((_data: Partial<MockAppointment>) => {
    // In a real app, this would save to Supabase
    // For now we just close the dialog
    handleDialogClose();
  }, [handleDialogClose]);

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
      />

      <WeekView
        mondayDate={currentMonday}
        appointments={appointments}
        viewMode={viewMode}
        hourHeight={hourHeight}
        onAppointmentClick={handleAppointmentClick}
        onEmptySlotClick={handleEmptySlotClick}
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
