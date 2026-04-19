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
  onGlobalDiscountChange?: (next: Discount | null) => void;
  onOpenPicker: () => void;
}

// Uniform vertical list of services. Each service occupies its own
// full-width row (×N / name / price / ✕). The last row is a dashed
// "+ Добавить услугу" button that keeps the block's layout predictable.
//
// Empty state has the same row size but only the dashed "+" row,
// so switching from 0 → 1 service doesn't jump the surrounding layout.
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

  return (
    <div className="px-4 pt-2">
      <div className="rounded-xl bg-white border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {services.map((line, idx) => {
          const svc = byId.get(line.serviceId) ?? null;
          const total = lineTotal(line);
          return (
            <div
              key={`${line.serviceId}-${idx}`}
              className="flex items-center gap-2 px-3 h-12"
            >
              <span className="flex-shrink-0 w-7 text-center text-[13px] font-bold text-violet-700 tabular-nums">
                ×{line.quantity}
              </span>
              <span className="flex-1 min-w-0 text-[14px] font-medium text-slate-900 truncate">
                {svc?.name ?? "Услуга"}
              </span>
              <span className="flex-shrink-0 text-[14px] font-bold text-emerald-700 tabular-nums">
                {formatEUR(total)}
              </span>
              {!readonly && (
                <button
                  type="button"
                  onClick={() => removeAt(idx)}
                  aria-label="Убрать"
                  className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 active:text-rose-500 active:bg-rose-50"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
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
            className="w-full h-12 flex items-center justify-center gap-2 text-[13px] font-semibold text-violet-600 active:bg-violet-50"
          >
            <span className="text-[16px] leading-none">+</span>
            {services.length === 0 ? "Выбрать услугу" : "Добавить услугу"}
          </button>
        )}
      </div>
    </div>
  );
}
