"use client";

// P0 #8 (CRM Core brief) — choice dialog for the «what to create»
// ambiguity. The brief framed it around «Мой календарь + Бригада»
// both being active, but the same dialog answers a more universal
// question: when the dispatcher taps on an empty slot, do they
// mean a client visit, a personal event, or a time-block?
//
// Persists the last choice in localStorage:babun-tap-default so
// the next tap doesn't re-ask. Pressing the same chip dismisses
// without action.

import { useEffect } from "react";
import { CalendarPlus, StickyNote, Ban, X } from "@babun/shared/icons";
import { haptic } from "@/lib/haptics";

export type TapChoice = "appointment" | "personal" | "block";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (choice: TapChoice) => void;
}

const STORAGE_KEY = "babun-tap-default";

export function loadTapDefault(): TapChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "appointment" || v === "personal" || v === "block") return v;
    return null;
  } catch {
    return null;
  }
}

export function saveTapDefault(choice: TapChoice): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // ignore
  }
}

export default function TapChoiceDialog({ open, onClose, onPick }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handlePick = (choice: TapChoice) => {
    haptic("tap");
    saveTapDefault(choice);
    onPick(choice);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-[var(--surface-card)] rounded-t-[20px] sm:rounded-[20px] shadow-[var(--shadow-sheet)] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[15px] font-semibold text-[var(--label)]">
            Что создать?
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-7 h-7 rounded-full bg-[var(--fill-tertiary)] text-[var(--label-secondary)] flex items-center justify-center"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
        <p className="text-[12px] text-[var(--label-tertiary)] leading-snug mb-3">
          Запомним выбор — в следующий раз сразу откроем нужный лист.
        </p>
        <div className="space-y-1.5">
          <ChoiceRow
            icon={<CalendarPlus size={16} strokeWidth={2.2} />}
            label="Запись клиента"
            onClick={() => handlePick("appointment")}
            tone="accent"
          />
          <ChoiceRow
            icon={<StickyNote size={16} strokeWidth={2.2} />}
            label="Личное событие"
            onClick={() => handlePick("personal")}
            tone="neutral"
          />
          <ChoiceRow
            icon={<Ban size={16} strokeWidth={2.2} />}
            label="Блокировка слота"
            onClick={() => handlePick("block")}
            tone="warning"
          />
        </div>
      </div>
    </div>
  );
}

function ChoiceRow({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone: "accent" | "neutral" | "warning";
}) {
  const cls =
    tone === "accent"
      ? "text-[var(--accent)] bg-[var(--accent-tint)]"
      : tone === "warning"
        ? "text-[var(--system-orange)] bg-[rgba(255,149,0,0.10)]"
        : "text-[var(--label)] bg-[var(--fill-tertiary)]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 h-12 px-3 rounded-[12px] text-[14px] font-semibold active:scale-[0.98] transition ${cls}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}
