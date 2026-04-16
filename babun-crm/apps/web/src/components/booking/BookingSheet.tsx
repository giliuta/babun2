"use client";

import { useState } from "react";
import type { Client } from "@/lib/clients";
import type { DraftClient } from "@/lib/draft-clients";
import type { EventPreset } from "@/lib/event-presets";
import { getCityColor } from "@/lib/day-cities";
import { getMonthNameGenitive } from "@/lib/date-utils";
import BottomSheet from "./shared/BottomSheet";
import SegmentControl from "./shared/SegmentControl";
import ClientMode from "./ClientMode";
import type { ClientBookingPayload } from "./ClientMode";
import EventMode from "./EventMode";

interface BookingSheetProps {
  open: boolean;
  onClose: () => void;
  /** Initial date/time seeded from the tapped slot. */
  dateKey: string;
  timeStart: string;
  timeEnd: string;
  city: string;
  teamId: string | null;
  teamLabel: string;
  clients: Client[];
  draftClients: DraftClient[];
  recentClientIds: string[];
  onCreateClient: (payload: ClientBookingPayload, ctx: BookingContext) => void;
  onCreateEvent: (label: string, preset: EventPreset, ctx: BookingContext) => void;
}

export interface BookingContext {
  dateKey: string;
  timeStart: string;
  timeEnd: string;
  teamId: string | null;
}

type Mode = "client" | "event";

// STORY-002 BookingSheet — replaces the old slot-menu → NewAppointment
// full-screen form. Single bottom sheet with two modes (Client /
// Event). Context (date/time/city/team) is carried by this wrapper
// and passed down to the mode components as human-readable labels.

export default function BookingSheet({
  open,
  onClose,
  dateKey,
  timeStart,
  timeEnd,
  city,
  teamId,
  teamLabel,
  clients,
  draftClients,
  recentClientIds,
  onCreateClient,
  onCreateEvent,
}: BookingSheetProps) {
  const [mode, setMode] = useState<Mode>("client");

  const dateLabel = formatDateLabel(dateKey);
  const timeLabel = `${timeStart}–${timeEnd}`;
  const cityColor = city ? getCityColor(city) : "#64748b";

  const ctx: BookingContext = { dateKey, timeStart, timeEnd, teamId };

  return (
    <BottomSheet open={open} onClose={onClose} heightVh={92}>
      {/* Header bar with segment control */}
      <div className="flex-shrink-0 px-4 pt-1 pb-3 flex items-center justify-between">
        <SegmentControl<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: "client", label: "Клиент" },
            { value: "event", label: "Событие" },
          ]}
        />
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 active:bg-slate-100"
          aria-label="Закрыть"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Mode content */}
      <div className="flex-1 min-h-0">
        {mode === "client" ? (
          <ClientMode
            dateLabel={dateLabel}
            timeLabel={timeLabel}
            cityLabel={city}
            cityColor={cityColor}
            teamLabel={teamLabel}
            clients={clients}
            draftClients={draftClients}
            recentClientIds={recentClientIds}
            dateKey={dateKey}
            onCreate={(payload) => onCreateClient(payload, ctx)}
            onCancel={onClose}
          />
        ) : (
          <EventMode
            dateLabel={dateLabel}
            timeLabel={timeLabel}
            teamLabel={teamLabel}
            onSave={(label, preset) => onCreateEvent(label, preset, ctx)}
            onCancel={onClose}
          />
        )}
      </div>
    </BottomSheet>
  );
}

function formatDateLabel(dateKey: string): string {
  if (!dateKey) return "";
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const month = getMonthNameGenitive(dt.getMonth()).toLowerCase();
  return `${d} ${month}`;
}
