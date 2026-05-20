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
  /** v669 — return value semantics:
   *    • `true` (or undefined): save succeeded / is in flight → button
   *      stays locked at «Сохраняем…» until parent unmounts the sheet.
   *    • `false`: save was rejected (precondition failed, e.g. invalid
   *      state caught synchronously) → unlock immediately so the user
   *      can retry without closing the form. This is what closes the
   *      «isSubmitting forever» deadlock when handleCreate / EventForm
   *      .handleSave early-return on `!client` / `!canSave`.
   *    • `Promise<boolean>`: same rules, awaited.
   *    • thrown error: treated as `false`, lock released. */
  onSave: () => boolean | void | Promise<boolean | void>;
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

  // v660 — was: disabled-grey when !canSave. Mobile/design audit
  // flagged it as "punishment, not guidance" — operator sees a dead
  // button and has to scroll back up to find what's missing.
  //
  // Now: the button visually stays accent-coloured (soft-accent when
  // !canSave) and remains tappable. Tap on incomplete state nudges
  // with a transient warning AND focuses the scroll body so the
  // missing-parts label is on screen. Submit lock still blocks
  // double-fires.
  const submitLocked = isSubmitting;
  const incomplete = !canSave;

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
          if (submitLocked) return;
          if (incomplete) {
            setBottomWarning("Заполните сначала данные");
            return;
          }
          setIsSubmitting(true);
          // v669 — interpret return value to release the lock when the
          // save handler refuses to proceed (e.g. invalid state).
          // Previously the lock was permanent on any early-return,
          // leaving the button stuck at «Сохраняем…» forever.
          let result: boolean | void | Promise<boolean | void>;
          try {
            result = onSave();
          } catch {
            setIsSubmitting(false);
            return;
          }
          if (result === false) {
            setIsSubmitting(false);
            return;
          }
          if (result instanceof Promise) {
            result
              .then((settled) => {
                if (settled === false) setIsSubmitting(false);
              })
              .catch(() => setIsSubmitting(false));
          }
          // Otherwise: synchronous void / true → keep lock until the
          // parent unmounts the sheet on success.
        }}
        disabled={submitLocked}
        data-testid="appointment-sheet-save"
        className={`w-full h-11 rounded-[10px] text-[15px] font-semibold transition ${
          submitLocked
            ? "bg-[var(--fill-primary)] text-[var(--label-tertiary)]"
            : incomplete
              // Soft-accent state: looks tappable, still nudges on tap.
              ? "bg-[var(--accent-tint)] text-[var(--accent)] active:scale-[0.99]"
              : "bg-[var(--accent)] text-[var(--label-on-accent)] active:bg-[var(--accent-pressed)] active:scale-[0.99]"
        }`}
      >
        {submitLocked ? "Сохраняем…" : label}
      </button>
    </div>
  );
}
