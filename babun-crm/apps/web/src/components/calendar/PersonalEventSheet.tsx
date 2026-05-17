"use client";

// PersonalEventSheet — thin wrapper around the shared EventForm.
//
// All rendering logic now lives in EventForm (context="personal").
// This file exists only to keep the import path
// `@/components/calendar/PersonalEventSheet` working for:
//   • apps/web/src/app/dashboard/page.tsx (dynamic import)
//
// Sprint #4 P0 §4 — unified EventForm integration.

import EventForm from "@/components/event/EventForm";
import type { Appointment } from "@babun/shared/local/appointments";

export type PersonalEventSheetMode = "create" | "edit";

interface PersonalEventSheetProps {
  open: boolean;
  onClose: () => void;
  mode: PersonalEventSheetMode;
  appointment: Appointment;
  onSave: (apt: Appointment) => void;
  onDelete?: (apt: Appointment) => void;
}

export default function PersonalEventSheet({
  open,
  onClose,
  mode,
  appointment,
  onSave,
  onDelete,
}: PersonalEventSheetProps) {
  return (
    <EventForm
      open={open}
      onClose={onClose}
      mode={mode}
      event={appointment}
      context="personal"
      onSave={onSave}
      onDelete={onDelete}
    />
  );
}
