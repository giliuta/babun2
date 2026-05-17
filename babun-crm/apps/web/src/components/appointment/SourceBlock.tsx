"use client";

import { useMemo } from "react";
import { Smartphone } from "@babun/shared/icons";
import {
  APPOINTMENT_SOURCE_LABELS,
  type AppointmentSource,
} from "@babun/shared/local/appointments";

interface SourceBlockProps {
  value: AppointmentSource | null;
  readonly: boolean;
  onChange?: (next: AppointmentSource | null) => void;
  /** v611 P1 §19 — most-recently-used source from localStorage.
   *  When present, the matching pill is hoisted to the first
   *  position and rendered with a coloured outline so the operator
   *  doesn't have to find their usual source in the row. */
  lastUsed?: AppointmentSource | null;
}

const BASE_ORDER: AppointmentSource[] = [
  "phone",
  "whatsapp",
  "instagram",
  "online",
  "referral",
  "repeat",
  "walk_in",
  "other",
];

export default function SourceBlock({ value, readonly, onChange, lastUsed }: SourceBlockProps) {
  const order = useMemo<AppointmentSource[]>(() => {
    if (!lastUsed) return BASE_ORDER;
    return [lastUsed, ...BASE_ORDER.filter((s) => s !== lastUsed)];
  }, [lastUsed]);

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
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
          Источник заявки
        </span>
      </div>
      {/* v607 P0 #3: source is optional, so the pill strip is a chip
          group — tapping the active pill deselects it (back to null).
          Aria still says `radiogroup` with allow-none semantics. */}
      <div
        role="radiogroup"
        aria-label="Источник заявки"
        className="flex flex-wrap gap-1.5"
      >
        {order.map((s) => {
          const active = value === s;
          const isLastUsed = !active && lastUsed === s;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                onChange?.(active ? null : s);
              }}
              className={`px-3 h-8 rounded-full text-[13px] font-semibold transition active:scale-[0.97] ${
                active
                  ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                  : isLastUsed
                    ? "bg-[var(--fill-tertiary)] text-[var(--label)] border border-[var(--accent)]"
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
