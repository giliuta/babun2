"use client";

import { useMemo } from "react";
import type {
  AppointmentService,
  Discount,
} from "@/lib/appointments";
import type { Service } from "@/lib/services";
import { lineTotal } from "@/lib/finance/appointment-calc";
import { formatEUR } from "@/lib/money";

interface ServicesBlockProps {
  services: AppointmentService[];
  globalDiscount: Discount | null;
  catalog: Service[];
  readonly: boolean;
  onServicesChange: (next: AppointmentService[]) => void;
  /** Not used by the compact chip layout but kept for API continuity
   *  with callers that also mount an income popup. */
  onGlobalDiscountChange?: (next: Discount | null) => void;
  onOpenPicker: () => void;
}

// Compact services row:
//  - each picked service is a thin chip: "×1 · Чистка · €50  ✕"
//  - at the tail end, a small "[+]" round button opens the picker
//  - empty state shows a full-width "Выбрать услугу" CTA — same
//    behaviour, just a different resting shape
//
// Price / discount editing lives in the ДОХОД popup now, not here.
export default function ServicesBlock({
  services,
  catalog,
  readonly,
  onServicesChange,
  onOpenPicker,
}: ServicesBlockProps) {
  const byId = useMemo(() => {
    const map = new Map<string, Service>();
    for (const s of catalog) map.set(s.id, s);
    return map;
  }, [catalog]);

  const removeAt = (idx: number) => {
    onServicesChange(services.filter((_, i) => i !== idx));
  };

  // Empty state: single large CTA.
  if (services.length === 0) {
    if (readonly) return null;
    return (
      <div className="px-4 pt-2">
        <button
          type="button"
          onClick={onOpenPicker}
          className="w-full h-11 rounded-xl text-[13px] font-semibold transition active:scale-[0.99] bg-white border-2 border-dashed border-slate-300 text-slate-500"
        >
          Выбрать услугу
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {services.map((line, idx) => {
          const svc = byId.get(line.serviceId) ?? null;
          const total = lineTotal(line);
          return (
            <div
              key={`${line.serviceId}-${idx}`}
              className="flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full bg-violet-50 border border-violet-200 text-[12px] text-slate-900 max-w-full"
            >
              <span className="font-semibold text-violet-700 tabular-nums">
                ×{line.quantity}
              </span>
              <span className="font-medium truncate max-w-[150px]">
                {svc?.name ?? "Услуга"}
              </span>
              <span className="text-emerald-700 font-bold tabular-nums">
                {formatEUR(total)}
              </span>
              {!readonly && (
                <button
                  type="button"
                  onClick={() => removeAt(idx)}
                  aria-label="Убрать"
                  className="w-5 h-5 flex items-center justify-center rounded-full text-slate-400 active:bg-white active:text-rose-500"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
        {!readonly && (
          <button
            type="button"
            onClick={onOpenPicker}
            aria-label="Добавить услугу"
            className="w-8 h-8 rounded-full bg-white border-2 border-dashed border-violet-300 text-violet-600 text-[16px] font-bold flex items-center justify-center active:bg-violet-50 active:scale-[0.96]"
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}
