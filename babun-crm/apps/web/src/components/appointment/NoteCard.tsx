"use client";

/**
 * NoteCard — fixed-height card for ЗАМЕТКА К ЗАПИСИ. Shows first line
 * of comment truncated or "Добавить заметку" CTA. Tap opens NotePopup.
 * Always min-h-[76px].
 */

import SectionCard from "./SectionCard";
import AppointmentRow from "./AppointmentRow";

interface NoteCardProps {
  readonly: boolean;
  comment: string;
  onTap?: () => void;
}

export default function NoteCard({
  readonly,
  comment,
  onTap,
}: NoteCardProps) {
  const trimmed = comment.trim();
  const value = trimmed
    ? trimmed.split("\n")[0]!.slice(0, 80) + (trimmed.length > 80 ? "…" : "")
    : readonly
      ? "Нет заметки"
      : "Добавить заметку";

  return (
    <SectionCard>
      <AppointmentRow
        label="ЗАМЕТКА К ЗАПИСИ"
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h14v16H5z" /><path d="M8 9h8M8 13h6" /></svg>}
        tileClass="bg-[var(--tile-gray)]"
        value={value}
        accent={!trimmed && !readonly}
        onTap={readonly ? undefined : onTap}
        showChevron={!readonly}
      />
    </SectionCard>
  );
}
