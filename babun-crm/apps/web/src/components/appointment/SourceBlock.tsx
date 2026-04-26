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

export default function SourceBlock({ value, readonly, onChange }: SourceBlockProps) {
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

  return (
    <div className="px-4 pt-2">
      <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1.5">
        Источник заявки
      </div>
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
