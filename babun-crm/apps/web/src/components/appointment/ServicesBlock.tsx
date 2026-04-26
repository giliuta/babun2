"use client";

import { useMemo } from "react";
import type {
  AppointmentService,
  Discount,
} from "@/lib/appointments";
import type { Service } from "@/lib/services";
import { lineTotal } from "@/lib/finance/appointment-calc";
import { formatEUR } from "@babun/shared/common/utils/money";

interface ServicesBlockProps {
  services: AppointmentService[];
  globalDiscount: Discount | null;
  catalog: Service[];
  readonly: boolean;
  onServicesChange: (next: AppointmentService[]) => void;
  onGlobalDiscountChange?: (next: Discount | null) => void;
  onOpenPicker: () => void;
}

// Sprint 026-hotfix (CEO request): removed the "+ Добавить услугу"
// footer button — the service rows themselves are the interactive
// element now. Tap anywhere on a row → opens the picker so the user
// can change the selection / add more. The ✕ button keeps its own
// onClick + stopPropagation so removing doesn't also open the sheet.
// Empty state shows a single dashed "Выбрать услугу" row that is
// tappable in the same way.
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

  const rowBase =
    "w-full flex items-center gap-2 px-3 h-12 text-left active:bg-[var(--fill-quaternary)] transition";

  return (
    <div className="px-4 pt-2">
      <div className="rounded-[14px] bg-[var(--surface-card)] border border-[var(--separator)] divide-y divide-[var(--separator)] overflow-hidden">
        {services.length === 0 ? (
          <button
            type="button"
            disabled={readonly}
            onClick={onOpenPicker}
            className={`${rowBase} justify-center text-[15px] font-semibold text-[var(--accent)] disabled:opacity-50`}
          >
            <span className="text-[16px] leading-none">+</span>
            Выбрать услугу
          </button>
        ) : (
          services.map((line, idx) => {
            const svc = byId.get(line.serviceId) ?? null;
            const total = lineTotal(line);
            // Row is a div with role="button" so the inner ✕ can be a
            // real <button> without nesting two native buttons (invalid
            // HTML, trips a11y tools). Keyboard support: Enter/Space on
            // the row opens the picker; Tab reaches the ✕ independently.
            return (
              <div
                key={`${line.serviceId}-${idx}`}
                role={readonly ? undefined : "button"}
                tabIndex={readonly ? -1 : 0}
                onClick={readonly ? undefined : onOpenPicker}
                onKeyDown={(e) => {
                  if (readonly) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenPicker();
                  }
                }}
                aria-label={readonly ? undefined : "Изменить услугу"}
                className={rowBase}
              >
                <span className="flex-shrink-0 w-7 text-center text-[13px] font-bold text-[var(--accent)] tabular-nums">
                  ×{line.quantity}
                </span>
                <span className="flex-1 min-w-0 text-[15px] font-medium text-[var(--label)] truncate">
                  {svc?.name ?? "Услуга"}
                </span>
                <span className="flex-shrink-0 text-[15px] font-bold text-[var(--label)] tabular-nums">
                  {formatEUR(total)}
                </span>
                {!readonly && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAt(idx);
                    }}
                    aria-label="Убрать"
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[var(--label-tertiary)] active:text-[var(--system-red)] active:bg-[rgba(255,59,48,0.08)]"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
