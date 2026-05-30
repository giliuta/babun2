"use client";

/**
 * ObjectNoteCard — crew note (door code, floor, gate colour…) for the
 * selected object. Promoted from a faint sub-line under the object to
 * its own row with an amber key tile, so the brigade actually sees it
 * on arrival. Tap opens the object editor (note field). In read-only
 * mode with no note it renders nothing (no empty clutter).
 */

import SectionCard from "./SectionCard";
import AppointmentRow from "./AppointmentRow";

interface ObjectNoteCardProps {
  readonly: boolean;
  note?: string;
  onTap?: () => void;
}

export default function ObjectNoteCard({
  readonly,
  note,
  onTap,
}: ObjectNoteCardProps) {
  if (readonly && !note) return null;
  return (
    <SectionCard>
      <AppointmentRow
        label="ЗАМЕТКА ДЛЯ БРИГАДЫ"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7.5" cy="15.5" r="5.5" />
            <path d="m21 2-9.6 9.6" />
            <path d="m15.5 7.5 3 3L22 7l-3-3" />
          </svg>
        }
        tileClass="bg-[var(--tile-orange)]"
        value={note ?? "Заметка для бригады"}
        accent={!note && !readonly}
        onTap={readonly ? undefined : onTap}
        showChevron={!readonly}
      />
    </SectionCard>
  );
}
