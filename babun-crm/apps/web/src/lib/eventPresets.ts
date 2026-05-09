// STORY-056 — System event presets for the unified EventSheet.
//
// Hard-coded set of 6 preset chips shown in the new compact EventSheet
// when kind='event'. User taps a chip → title, color, time_end (=
// time_start + durationMin), and event_push_offset_min get auto-filled.
//
// Custom presets live in `event_templates` (Supabase, per-user) and
// are loaded separately. They appear in the chip row AFTER these six
// system presets, in `sort_order` ascending.

export interface EventPreset {
  id: string;            // 'sys.*' for system, uuid for custom
  name: string;          // RU label, e.g. "Звонок"
  emoji: string | null;  // single emoji, e.g. "📞"
  color: string;         // hex, e.g. "#3B82F6"
  durationMin: number;   // minutes, 5..1440
  pushOffsetMin: number | null; // minutes before event start, null = no push
  isSystem: boolean;     // true for SYSTEM_PRESETS, false for custom
}

export const SYSTEM_PRESETS: EventPreset[] = [
  {
    id: "sys.call",
    name: "Звонок",
    emoji: "📞",
    color: "#3B82F6",
    durationMin: 15,
    pushOffsetMin: 5,
    isSystem: true,
  },
  {
    id: "sys.meeting",
    name: "Встреча",
    emoji: "🤝",
    color: "#10B981",
    durationMin: 60,
    pushOffsetMin: 15,
    isSystem: true,
  },
  {
    id: "sys.work",
    name: "Работа",
    emoji: "💼",
    color: "#6366F1",
    durationMin: 120,
    pushOffsetMin: 15,
    isSystem: true,
  },
  {
    id: "sys.lunch",
    name: "Обед",
    emoji: "🍽️",
    color: "#F59E0B",
    durationMin: 60,
    pushOffsetMin: null,
    isSystem: true,
  },
  {
    id: "sys.workout",
    name: "Тренировка",
    emoji: "💪",
    color: "#EF4444",
    durationMin: 90,
    pushOffsetMin: 30,
    isSystem: true,
  },
  {
    id: "sys.commute",
    name: "Дорога",
    emoji: "🚗",
    color: "#6B7280",
    durationMin: 30,
    pushOffsetMin: null,
    isSystem: true,
  },
];

// Shape that the EventSheet's preset application returns to the
// caller — the subset of state fields that a preset overrides.
export interface PresetApplication {
  title: string;
  color: string;
  timeEnd: string;          // HH:MM, computed from timeStart + duration
  pushOffsetMin: number | null;
}

// Compute time_end given a starting "HH:MM" and a duration in minutes.
// Clamped at 23:59 to avoid wrapping past midnight (matches the
// existing convention in AppointmentSheet's handleCreate).
export function addMinutesClamped(timeStart: string, durationMin: number): string {
  const [h, m] = timeStart.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return timeStart;
  const endMin = Math.min(23 * 60 + 59, h * 60 + m + durationMin);
  const eh = Math.floor(endMin / 60);
  const em = endMin % 60;
  return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
}

// Resolve the patch the EventSheet should apply when the user taps a
// preset chip. Pure: caller decides whether to commit it.
export function applyPreset(
  preset: EventPreset,
  timeStart: string,
): PresetApplication {
  return {
    title: preset.name,
    color: preset.color,
    timeEnd: addMinutesClamped(timeStart, preset.durationMin),
    pushOffsetMin: preset.pushOffsetMin,
  };
}
