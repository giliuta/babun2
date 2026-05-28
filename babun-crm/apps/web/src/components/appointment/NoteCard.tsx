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
        value={value}
        accent={!trimmed && !readonly}
        onTap={readonly ? undefined : onTap}
        showChevron={!readonly}
      />
    </SectionCard>
  );
}
