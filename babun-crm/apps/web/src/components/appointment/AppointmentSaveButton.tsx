"use client";

/**
 * AppointmentSaveButton — sticky-footer save CTA + transient
 * «Заполните сначала данные» warning banner that appears for 4
 * seconds when a disabled tap is attempted.
 *
 * v615 P1 §16 — backdrop-blur(12px) on the footer so scrolled
 * content shows through softly instead of a hard cut.
 *
 * Extracted from AppointmentSheet (Sprint #4 §9 step 9, v629).
 */

import { useEffect, useState } from "react";

interface AppointmentSaveButtonProps {
  canSave: boolean;
  label: string;
  onSave: () => void;
}

export default function AppointmentSaveButton({
  canSave,
  label,
  onSave,
}: AppointmentSaveButtonProps) {
  const [bottomWarning, setBottomWarning] = useState<string | null>(null);
  // STORY audit (tester 1.1): без isSubmitting guard два быстрых тапа
  // подряд приводили к двум вызовам onSave → две вставки в Supabase →
  // duplicate appointment. Теперь после первого валидного клика
  // блокируем кнопку до тех пор, пока родитель не отмонтирует sheet
  // (что происходит в success-flow). На быстром флуоксе оператор
  // обычно ждёт ≤1 с пока sheet закрывается — этого достаточно.
  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => {
    if (!bottomWarning) return;
    const t = window.setTimeout(() => setBottomWarning(null), 4000);
    return () => window.clearTimeout(t);
  }, [bottomWarning]);

  const disabled = !canSave || isSubmitting;

  return (
    <div
      className="flex-shrink-0 px-4 pt-2 border-t border-[var(--separator)] sticky bottom-0 z-10 backdrop-blur-[12px]"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 10px)",
        background: "color-mix(in srgb, var(--surface-card) 80%, transparent)",
      }}
    >
      {bottomWarning && (
        <div className="mb-2 px-3 py-2 rounded-[10px] bg-[rgba(255,59,48,0.08)] border border-[rgba(255,59,48,0.2)] text-[13px] font-semibold text-[var(--system-red)] text-center">
          {bottomWarning}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          if (isSubmitting) return;
          if (!canSave) {
            setBottomWarning("Заполните сначала данные");
            return;
          }
          setIsSubmitting(true);
          onSave();
        }}
        disabled={isSubmitting}
        data-testid="appointment-sheet-save"
        className={`w-full h-11 rounded-[10px] text-[15px] font-semibold transition ${
          disabled
            ? "bg-[var(--fill-primary)] text-[var(--label-tertiary)]"
            : "bg-[var(--accent)] text-[var(--label-on-accent)] active:bg-[var(--accent-pressed)] active:scale-[0.99]"
        }`}
      >
        {isSubmitting ? "Сохраняем…" : label}
      </button>
    </div>
  );
}
