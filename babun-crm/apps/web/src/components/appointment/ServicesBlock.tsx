"use client";

import { useMemo, useState } from "react";
import type {
  AppointmentService,
  Discount,
} from "@babun/shared/local/appointments";
import type { Service } from "@babun/shared/local/services";
import {
  appointmentTotal,
  globalDiscountAmount,
  lineTotal,
  subtotal,
  totalDuration,
} from "@babun/shared/local/finance/appointment-calc";
import { formatEUR } from "@babun/shared/common/utils/money";
import { Tag } from "@babun/shared/icons";
import IncomePopup from "./IncomePopup";

interface ServicesBlockProps {
  services: AppointmentService[];
  globalDiscount: Discount | null;
  catalog: Service[];
  readonly: boolean;
  onServicesChange: (next: AppointmentService[]) => void;
  onGlobalDiscountChange?: (next: Discount | null) => void;
  onOpenPicker: () => void;
}

// The service rows themselves are the interactive element. Tap anywhere
// on a row → opens the picker to change the selection / add more. The ✕
// button keeps its own onClick + stopPropagation so removing doesn't
// also open the sheet. Empty state shows a single "Выбрать услугу" row
// that is tappable in the same way.
//
// When services.length > 0, an «Итого» footer row is appended inside the
// card (below the «Выбрать ещё услугу» row). Tapping it (when !readonly
// and onGlobalDiscountChange is provided) opens IncomePopup for per-line
// price editing + global discount.
export default function ServicesBlock({
  services,
  globalDiscount,
  catalog,
  readonly,
  onServicesChange,
  onGlobalDiscountChange,
  onOpenPicker,
}: ServicesBlockProps) {
  const byId = useMemo(() => {
    const map = new Map<string, Service>();
    for (const s of catalog) map.set(s.id, s);
    return map;
  }, [catalog]);

  const [incomeOpen, setIncomeOpen] = useState(false);

  const removeAt = (idx: number) => {
    onServicesChange(services.filter((_, i) => i !== idx));
  };

  const rowBase =
    "w-full flex items-center gap-2 px-3 h-12 text-left active:bg-[var(--fill-quaternary)] transition";

  const canOpenIncome = !readonly && Boolean(onGlobalDiscountChange);

  // Totals for the footer row.
  const sub = subtotal(services);
  const discountAmt = globalDiscountAmount(services, globalDiscount);
  const grandTotal = appointmentTotal(services, globalDiscount);
  const dur = totalDuration(services);

  return (
    <div className="px-4 pt-3">
      <div className="rounded-[14px] bg-[var(--surface-card)] border border-[var(--separator)] shadow-[var(--shadow-card)] divide-y divide-[var(--separator)] overflow-hidden">
        {services.length === 0 ? (
          <button
            type="button"
            disabled={readonly}
            onClick={onOpenPicker}
            className={`${rowBase} text-[15px] font-semibold text-[var(--accent)] disabled:text-[var(--label-tertiary)] disabled:cursor-not-allowed`}
          >
            <span className="flex-1">Выбрать услугу</span>
            <span className="flex-shrink-0 text-[18px] leading-none">+</span>
          </button>
        ) : (
          <>
            {services.map((line, idx) => {
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
                  aria-label={
                    readonly
                      ? undefined
                      : `Заменить услугу «${svc?.name ?? "Услуга"}» — откроется список услуг`
                  }
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
                      className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-lg text-[var(--label-tertiary)] active:text-[var(--system-red)] active:bg-[rgba(255,59,48,0.08)]"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}

            {/* «Выбрать ещё услугу» add-more row */}
            {!readonly && (
              <button
                type="button"
                onClick={onOpenPicker}
                className={`${rowBase} text-[15px] font-semibold text-[var(--accent)]`}
              >
                <span className="flex-1">Выбрать ещё услугу</span>
                <span className="flex-shrink-0 text-[18px] leading-none">+</span>
              </button>
            )}

            {/* «Итого» footer row — tappable, opens IncomePopup for price/discount edit. */}
            <div
              role={canOpenIncome ? "button" : undefined}
              tabIndex={canOpenIncome ? 0 : -1}
              onClick={canOpenIncome ? () => setIncomeOpen(true) : undefined}
              onKeyDown={(e) => {
                if (!canOpenIncome) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIncomeOpen(true);
                }
              }}
              aria-label={canOpenIncome ? "Редактировать цены и скидку" : undefined}
              className={`px-3 py-2.5 bg-[var(--fill-quaternary)] ${
                canOpenIncome ? "active:bg-[var(--fill-tertiary)] cursor-pointer" : ""
              }`}
            >
              {/* Discount sub-lines when a global discount exists */}
              {discountAmt > 0 && (
                <>
                  <div className="flex items-center justify-between text-[12px] text-[var(--label-secondary)]">
                    <span>
                      Подытог ({services.length} усл.)
                    </span>
                    <span className="tabular-nums">{formatEUR(sub)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[12px] text-[var(--system-red)] font-semibold mt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <Tag size={12} strokeWidth={2} />
                      {globalDiscount?.type === "percent"
                        ? `−${globalDiscount.value}%`
                        : "Скидка"}
                      {globalDiscount?.reason && ` · ${globalDiscount.reason}`}
                    </span>
                    <span className="tabular-nums">−{formatEUR(discountAmt)}</span>
                  </div>
                  <div className="h-px bg-[var(--separator)] my-1.5" />
                </>
              )}

              {/* Bold grand total + duration */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px] font-bold text-[var(--label)]">
                    Итого {formatEUR(grandTotal)}
                  </span>
                  <span className="text-[12px] text-[var(--label-secondary)] tabular-nums">
                    · {dur} мин
                  </span>
                </div>
                {canOpenIncome && (
                  <span className="text-[var(--label-quaternary)]">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {incomeOpen && onGlobalDiscountChange && (
        <IncomePopup
          services={services}
          byId={byId}
          globalDiscount={globalDiscount}
          onServicesChange={onServicesChange}
          onGlobalDiscountChange={onGlobalDiscountChange}
          onClose={() => setIncomeOpen(false)}
        />
      )}
    </div>
  );
}
