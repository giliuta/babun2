"use client";

import { useMemo } from "react";
import type {
  AppointmentService,
  Discount,
} from "@/lib/appointments";
import type { Service } from "@/lib/services";
import { pricePerUnit } from "@/lib/services";
import {
  appointmentTotal,
  globalDiscountAmount,
  subtotal,
  totalDuration,
} from "@/lib/finance/appointment-calc";
import { formatEUR } from "@/lib/money";
import ServiceRow from "./ServiceRow";
import GlobalDiscountForm from "./GlobalDiscountForm";

interface ServicesBlockProps {
  services: AppointmentService[];
  globalDiscount: Discount | null;
  catalog: Service[];
  readonly: boolean;
  onServicesChange: (next: AppointmentService[]) => void;
  onGlobalDiscountChange: (next: Discount | null) => void;
  onOpenPicker: () => void;
}

// Блок 6-9: услуги (строки со степперами), кнопка «+ добавить»,
// глобальная скидка и итог.
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

  const sub = subtotal(services);
  const total = appointmentTotal(services, globalDiscount);
  const discountAmount = globalDiscountAmount(services, globalDiscount);
  const duration = totalDuration(services);

  const updateLine = (idx: number, next: AppointmentService) => {
    onServicesChange(services.map((s, i) => (i === idx ? next : s)));
  };

  const removeLine = (idx: number) => {
    onServicesChange(services.filter((_, i) => i !== idx));
  };

  return (
    <div className="pt-2">
      {/* Services list */}
      {services.length > 0 && (
        <div className="px-4 space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Услуги ({services.length})
          </div>
          {services.map((line, idx) => {
            const svc = byId.get(line.serviceId) ?? null;
            return (
              <ServiceRow
                key={`${line.serviceId}-${idx}`}
                line={{
                  ...line,
                  pricePerUnit:
                    // пересчитать bulk при каждом рендере (безопасно — при изменении qty setQty
                    // внутри ServiceRow уже подменит, но для свежего чтения сделаем согласование)
                    svc && line.pricePerUnit === line.originalPrice
                      ? pricePerUnit(svc, line.quantity)
                      : line.pricePerUnit,
                }}
                service={svc}
                readonly={readonly}
                onUpdate={(n) => updateLine(idx, n)}
                onRemove={() => removeLine(idx)}
              />
            );
          })}
        </div>
      )}

      {/* + Add service */}
      {!readonly && (
        <div className="px-4 pt-2">
          <button
            type="button"
            onClick={onOpenPicker}
            className={`w-full h-11 rounded-xl text-[13px] font-semibold transition active:scale-[0.99] ${
              services.length === 0
                ? "bg-white border-2 border-dashed border-slate-300 text-slate-500"
                : "bg-violet-50 text-violet-700 active:bg-violet-100"
            }`}
          >
            {services.length === 0 ? "Выбрать услугу" : "+ Добавить ещё услугу"}
          </button>
        </div>
      )}

      {/* Global discount */}
      {!readonly && services.length > 0 && (
        <GlobalDiscountForm
          discount={globalDiscount}
          onChange={onGlobalDiscountChange}
        />
      )}

      {/* Totals — always visible so the dispatcher sees доход immediately.
          Shows €0 / 0 мин when no services are picked yet. */}
      <div className="px-4 pt-3">
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1.5">
          {discountAmount > 0 && (
            <>
              <div className="flex items-center justify-between text-[12px] text-slate-600">
                <span>Подытог ({services.length} усл.)</span>
                <span className="tabular-nums">{formatEUR(sub)}</span>
              </div>
              <div className="flex items-center justify-between text-[12px] text-rose-600 font-semibold">
                <span>
                  🏷{" "}
                  {globalDiscount?.type === "percent"
                    ? `−${globalDiscount.value}%`
                    : `Скидка`}
                  {globalDiscount?.reason && ` ${globalDiscount.reason}`}
                </span>
                <span className="tabular-nums">−{formatEUR(discountAmount)}</span>
              </div>
              <div className="h-px bg-slate-200" />
            </>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-slate-900">ДОХОД</span>
            <span
              className={`text-[20px] font-bold tabular-nums ${
                total > 0 ? "text-emerald-700" : "text-slate-400"
              }`}
            >
              {formatEUR(total)}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            {duration} мин общей длительности
          </div>
        </div>
      </div>
    </div>
  );
}
