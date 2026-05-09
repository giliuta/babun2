"use client";

// STORY-056 — Bottom-sheet picker for push offset on the unified
// EventSheet. Compact replacement of PushOffsetPicker (which was a
// card with toggle + inline radio list eating vertical space).
//
// Value model: minutes BEFORE event start (5, 15, 30, 60, 1440), or
// `null` for "no push". The "exact time" datetime variant (event_push_at)
// stays in scope but lives on a separate row; this picker only handles
// the relative-offset choice.

import SheetShell from "@/components/ui/SheetShell";

interface EventPushPickerProps {
  open: boolean;
  onClose: () => void;
  value: number | null;
  onChange: (next: number | null) => void;
}

interface PushOption {
  label: string;
  value: number | null;
}

const OPTIONS: PushOption[] = [
  { label: "Не напоминать", value: null },
  { label: "В момент события", value: 0 },
  { label: "За 5 минут", value: 5 },
  { label: "За 15 минут", value: 15 },
  { label: "За 30 минут", value: 30 },
  { label: "За 1 час", value: 60 },
  { label: "За 1 день", value: 1440 },
];

export function formatPushOffsetLabel(minutes: number | null): string {
  if (minutes === null) return "Нет";
  const opt = OPTIONS.find((o) => o.value === minutes);
  if (opt) return opt.label.replace("За ", "");
  if (minutes < 60) return `${minutes} мин`;
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    if (h === 24) return "1 день";
    if (h % 24 === 0) return `${h / 24} дн`;
    return `${h} ч`;
  }
  return `${minutes} мин`;
}

export default function EventPushPicker({
  open,
  onClose,
  value,
  onChange,
}: EventPushPickerProps) {
  const handlePick = (next: number | null) => {
    onChange(next);
    onClose();
  };

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      title="Push-уведомление"
      subtitle="Когда напомнить о событии"
      height="auto"
    >
      <div className="divide-y divide-[var(--separator)] bg-[var(--surface-card)]">
        {OPTIONS.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => handlePick(opt.value)}
              className={`w-full flex items-center justify-between px-4 py-3 min-h-[48px] text-[15px] active:bg-[var(--fill-quaternary)] transition ${
                active
                  ? "text-[var(--accent)] font-semibold"
                  : "text-[var(--label)]"
              }`}
            >
              <span>{opt.label}</span>
              {active && (
                <span className="text-[var(--accent)] text-[16px] font-semibold">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </SheetShell>
  );
}
