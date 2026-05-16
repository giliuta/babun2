"use client";

import { Smartphone } from "@babun/shared/icons";
import {
  APPOINTMENT_SOURCE_LABELS,
  type AppointmentSource,
} from "@babun/shared/local/appointments";

interface SourceBlockProps {
  value: AppointmentSource | null;
  readonly: boolean;
  onChange?: (next: AppointmentSource | null) => void;
  /** v524 §3.9 — render the «Источник заявки» label with a red
   *  asterisk + the «Выберите источник заявки» hint when the create
   *  form is gating on this field. Edit mode passes `false` so a
   *  legacy record without a source doesn't shame the user. */
  required?: boolean;
}

const ORDER: AppointmentSource[] = [
  "phone",
  "whatsapp",
  "instagram",
  "online",
  "referral",
  "repeat",
  "walk_in",
  "other",
];

export default function SourceBlock({ value, readonly, onChange, required = false }: SourceBlockProps) {
  if (readonly) {
    if (!value) return null;
    return (
      <div className="px-4 pt-2">
        <div className="px-3 py-2 rounded-[14px] bg-[var(--fill-tertiary)] border border-[var(--separator)] text-[13px] text-[var(--label)] flex items-center gap-2">
          <span className="flex-shrink-0 text-[var(--label-tertiary)]">
            <Smartphone size={14} strokeWidth={2} />
          </span>
          <span className="text-[var(--label-secondary)]">Источник:</span>
          <span className="font-semibold">{APPOINTMENT_SOURCE_LABELS[value]}</span>
        </div>
      </div>
    );
  }

  const missing = required && !value;

  return (
    <div className="px-4 pt-2">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
          Источник заявки
        </span>
        {required && (
          <span
            aria-hidden
            className="text-[12px] font-bold text-[var(--system-red)]"
            title="Обязательное поле"
          >
            *
          </span>
        )}
      </div>
      {missing && (
        <div className="mb-1.5 text-[11px] text-[var(--system-red)]">
          Выберите источник заявки.
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {ORDER.map((s) => {
          const active = value === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onChange?.(active ? null : s)}
              className={`px-3 h-8 rounded-full text-[13px] font-semibold transition active:scale-[0.97] ${
                active
                  ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                  : "bg-[var(--fill-tertiary)] text-[var(--label)] border border-[var(--separator)]"
              }`}
            >
              {APPOINTMENT_SOURCE_LABELS[s]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
