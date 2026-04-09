"use client";

import { useState, useCallback } from "react";
import { getMonday, addWeeks } from "@/lib/date-utils";
import { getMockAppointments, MOCK_TEAMS, type MockAppointment } from "@/lib/mock-data";
import Header from "@/components/layout/Header";
import WeekView from "@/components/calendar/WeekView";
import AppointmentDialog from "@/components/appointments/AppointmentDialog";

export default function DashboardPage() {
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  const [activeTeamId, setActiveTeamId] = useState(MOCK_TEAMS[0].id);
  const [selectedAppointment, setSelectedAppointment] = useState<MockAppointment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false);
    setSelectedAppointment(null);
  }, []);

  const handleSave = useCallback((_data: Partial<MockAppointment>) => {
    // In a real app, this would save to Supabase
    // For now we just close the dialog
    handleDialogClose();
  }, [handleDialogClose]);

  return (
    <>
      <Header
        currentDate={currentMonday}
        activeTeamId={activeTeamId}
        teams={MOCK_TEAMS}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onToday={handleToday}
        onTeamChange={handleTeamChange}
      />

      <WeekView
        mondayDate={currentMonday}
        appointments={appointments}
        onAppointmentClick={handleAppointmentClick}
      />

      <AppointmentDialog
        appointment={selectedAppointment}
        open={dialogOpen}
        onClose={handleDialogClose}
        onSave={handleSave}
      />
    </>
  );
}
