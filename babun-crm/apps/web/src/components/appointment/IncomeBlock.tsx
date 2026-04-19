"use client";

import { useMemo, useState } from "react";
import type {
  AppointmentService,
  Discount,
} from "@/lib/appointments";
import type { Service } from "@/lib/services";
import {
  appointmentTotal,
  globalDiscountAmount,
  lineTotal,
  subtotal,
  totalDuration,
} from "@/lib/finance/appointment-calc";
import { formatEUR } from "@/lib/money";

interface IncomeBlockProps {
  services: AppointmentService[];
  globalDiscount: Discount | null;
  catalog: Service[];
  readonly: boolean;
  onServicesChange: (next: AppointmentService[]) => void;
  onGlobalDiscountChange: (next: Discount | null) => void;
}

// ДОХОД card — always visible, tappable.
// Tap opens a popup with:
//  - per-service breakdown (name × qty = line total, editable price)
//  - global discount toggle (€ / %)
//  - grand total
export default function IncomeBlock({
  services,
  globalDiscount,
  catalog,
  readonly,
  onServicesChange,
  onGlobalDiscountChange,
}: IncomeBlockProps) {
  const byId = useMemo(() => {
    const map = new Map<string, Service>();
    for (const s of catalog) map.set(s.id, s);
    return map;
  }, [catalog]);

  const sub = subtotal(services);
  const total = appointmentTotal(services, globalDiscount);
  const discount = globalDiscountAmount(services, globalDiscount);
  const duration = totalDuration(services);

  const [open, setOpen] = useState(false);
  const canEdit = !readonly;

  return (
    <div className="px-4 pt-2">
      <button
        type="button"
        onClick={() => canEdit && services.length > 0 && setOpen(true)}
        disabled={!canEdit || services.length === 0}
        className="w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-left active:bg-slate-100 disabled:active:bg-slate-50 transition"
      >
        {discount > 0 && (
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
              <span className="tabular-nums">−{formatEUR(discount)}</span>
            </div>
            <div className="h-px bg-slate-200 my-1.5" />
          </>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-slate-900">ДОХОД</span>
          <div className="flex items-center gap-2">
            <span
              className={`text-[20px] font-bold tabular-nums ${
                total > 0 ? "text-emerald-700" : "text-slate-400"
              }`}
            >
              {formatEUR(total)}
            </span>
            {canEdit && services.length > 0 && (
              <span className="text-slate-300">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </span>
            )}
          </div>
        </div>
        <div className="text-[11px] text-slate-500 tabular-nums">
          {duration} мин общей длительности
        </div>
      </button>

      {open && (
        <IncomePopup
          services={services}
          byId={byId}
          globalDiscount={globalDiscount}
          onServicesChange={onServicesChange}
          onGlobalDiscountChange={onGlobalDiscountChange}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function IncomePopup({
  services,
  byId,
  globalDiscount,
  onServicesChange,
  onGlobalDiscountChange,
  onClose,
}: {
  services: AppointmentService[];
  byId: Map<string, Service>;
  globalDiscount: Discount | null;
  onServicesChange: (next: AppointmentService[]) => void;
  onGlobalDiscountChange: (next: Discount | null) => void;
  onClose: () => void;
}) {
  const [discType, setDiscType] = useState<"none" | "fixed" | "percent">(
    globalDiscount?.type ?? "none"
  );
  const [discValue, setDiscValue] = useState(
    globalDiscount ? String(globalDiscount.value) : ""
  );

  const setLinePrice = (idx: number, raw: string) => {
    const normalized = raw.replace(",", ".").replace(/[^\d.]/g, "");
    const val = Number(normalized);
    if (!Number.isFinite(val) || val < 0) return;
    onServicesChange(
      services.map((s, i) =>
        i === idx ? { ...s, pricePerUnit: val } : s
      )
    );
  };

  const applyDiscount = () => {
    if (discType === "none") {
      onGlobalDiscountChange(null);
      onClose();
      return;
    }
    const raw = discValue.replace(",", ".").replace(/[^\d.]/g, "");
    const val = Number(raw);
    if (!Number.isFinite(val) || val <= 0) {
      onGlobalDiscountChange(null);
      onClose();
      return;
    }
    onGlobalDiscountChange({ type: discType, value: val });
    onClose();
  };

  const sub = subtotal(services);
  const preview: Discount | null =
    discType === "none"
      ? null
      : Number(discValue.replace(",", "."))
      ? {
          type: discType,
          value: Number(discValue.replace(",", ".")),
        }
      : null;
  const previewDiscount = globalDiscountAmount(services, preview);
  const previewTotal = Math.max(0, sub - previewDiscount);

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="text-[14px] font-semibold text-slate-900">Доход</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 active:bg-slate-100"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-3 space-y-3">
            {/* Line breakdown */}
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Разбивка
              </div>
              <div className="space-y-1.5">
                {services.map((line, idx) => {
                  const svc = byId.get(line.serviceId);
                  const lt = lineTotal(line);
                  return (
                    <div
                      key={`${line.serviceId}-${idx}`}
                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-slate-900 truncate">
                          ×{line.quantity} · {svc?.name ?? "Услуга"}
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          {line.duration} мин · {formatEUR(lt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-[11px] text-slate-500">€/шт</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={line.pricePerUnit}
                          onChange={(e) => setLinePrice(idx, e.target.value)}
                          className="w-16 h-9 px-2 text-right rounded-lg bg-white border border-slate-300 text-[13px] font-semibold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                    </div>
                  );
                })}
                {services.length === 0 && (
                  <div className="text-center text-[12px] text-slate-400 py-4">
                    Услуг ещё нет
                  </div>
                )}
              </div>
            </div>

            {/* Global discount */}
            {services.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Скидка на всё
                </div>
                <div className="flex gap-1.5 mb-2">
                  {(
                    [
                      { key: "none", label: "Без скидки" },
                      { key: "fixed", label: "€" },
                      { key: "percent", label: "%" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setDiscType(opt.key)}
                      className={`flex-1 h-9 rounded-lg text-[12px] font-semibold transition ${
                        discType === opt.key
                          ? "bg-violet-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {discType !== "none" && (
                  <input
                    type="text"
                    inputMode="decimal"
                    value={discValue}
                    onChange={(e) => setDiscValue(e.target.value)}
                    placeholder={discType === "fixed" ? "10" : "10"}
                    className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-[14px] text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                )}
              </div>
            )}

            {/* Preview total */}
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
              <div className="flex items-center justify-between text-[12px] text-slate-600">
                <span>Подытог</span>
                <span className="tabular-nums">{formatEUR(sub)}</span>
              </div>
              {previewDiscount > 0 && (
                <div className="flex items-center justify-between text-[12px] text-rose-600 font-semibold">
                  <span>Скидка</span>
                  <span className="tabular-nums">−{formatEUR(previewDiscount)}</span>
                </div>
              )}
              <div className="h-px bg-emerald-200 my-1.5" />
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-slate-900">
                  Итого
                </span>
                <span className="text-[20px] font-bold tabular-nums text-emerald-700">
                  {formatEUR(previewTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex-shrink-0 px-4 pt-2 border-t border-slate-200"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 10px)" }}
        >
          <button
            type="button"
            onClick={applyDiscount}
            className="w-full h-12 rounded-xl bg-violet-600 text-white text-[14px] font-semibold active:scale-[0.99]"
          >
            Применить
          </button>
        </div>
      </div>
    </div>
  );
}
