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
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { Tag, X } from "@babun/shared/icons";

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
        className="w-full rounded-[14px] bg-[var(--fill-tertiary)] border border-[var(--separator)] p-3 text-left active:bg-[var(--fill-secondary)] disabled:active:bg-[var(--fill-tertiary)] transition"
      >
        {discount > 0 && (
          <>
            <div className="flex items-center justify-between text-[12px] text-[var(--label-secondary)]">
              <span>Подытог ({services.length} усл.)</span>
              <span className="tabular-nums">{formatEUR(sub)}</span>
            </div>
            <div className="flex items-center justify-between text-[12px] text-[var(--system-red)] font-semibold">
              <span className="inline-flex items-center gap-1">
                <Tag size={12} strokeWidth={2} />
                {globalDiscount?.type === "percent"
                  ? `−${globalDiscount.value}%`
                  : `Скидка`}
                {globalDiscount?.reason && ` ${globalDiscount.reason}`}
              </span>
              <span className="tabular-nums">−{formatEUR(discount)}</span>
            </div>
            <div className="h-px bg-[var(--separator)] my-1.5" />
          </>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">Доход</span>
          <div className="flex items-center gap-2">
            <span
              className={`text-[22px] font-bold tabular-nums ${
                total > 0 ? "text-[var(--label)]" : "text-[var(--label-tertiary)]"
              }`}
            >
              {formatEUR(total)}
            </span>
            {canEdit && services.length > 0 && (
              <span className="text-[var(--label-quaternary)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </span>
            )}
          </div>
        </div>
        <div className="text-[12px] text-[var(--label-secondary)] tabular-nums">
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
  const confirmDialog = useConfirm();
  const [discType, setDiscType] = useState<"none" | "fixed" | "percent">(
    globalDiscount?.type ?? "none"
  );
  const [discValue, setDiscValue] = useState(
    globalDiscount ? String(globalDiscount.value) : ""
  );

  const [dirty, setDirty] = useState(false);

  const setLinePrice = (idx: number, raw: string) => {
    const normalized = raw.replace(",", ".").replace(/[^\d.]/g, "");
    const val = Number(normalized);
    if (!Number.isFinite(val) || val < 0) return;
    setDirty(true);
    onServicesChange(
      services.map((s, i) =>
        i === idx ? { ...s, pricePerUnit: val } : s
      )
    );
  };

  const attemptClose = async () => {
    if (!dirty && discType === (globalDiscount?.type ?? "none") && discValue === (globalDiscount ? String(globalDiscount.value) : "")) {
      onClose();
      return;
    }
    if (await confirmDialog({ title: "Отменить изменения цены / скидки?", confirmLabel: "Отменить", danger: false })) {
      onClose();
    }
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
      className="fixed inset-0 z-[85] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
      onClick={attemptClose}
    >
      <div
        className="w-full max-w-md bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col"
        style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--separator)]">
          <div className="text-[17px] font-semibold tracking-tight text-[var(--label)]">Доход</div>
          <button
            type="button"
            onClick={attemptClose}
            aria-label="Закрыть"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-3 space-y-3">
            {/* Line breakdown */}
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1.5">
                Разбивка
              </div>
              <div className="space-y-1.5">
                {services.map((line, idx) => {
                  const svc = byId.get(line.serviceId);
                  const lt = lineTotal(line);
                  return (
                    <div
                      key={`${line.serviceId}-${idx}`}
                      className="flex items-center gap-2 p-2 rounded-[10px] bg-[var(--fill-tertiary)] border border-[var(--separator)]"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-semibold text-[var(--label)] truncate">
                          ×{line.quantity} · {svc?.name ?? "Услуга"}
                        </div>
                        <div className="text-[12px] text-[var(--label-secondary)] tabular-nums">
                          {line.duration} мин · {formatEUR(lt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-[12px] text-[var(--label-secondary)]">€/шт</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={line.pricePerUnit}
                          onChange={(e) => setLinePrice(idx, e.target.value)}
                          className="w-16 h-9 px-2 text-right rounded-[10px] bg-[var(--surface-card)] border border-[var(--separator)] text-[15px] font-semibold text-[var(--label)] tabular-nums focus:outline-none focus:border-[var(--accent)]"
                        />
                      </div>
                    </div>
                  );
                })}
                {services.length === 0 && (
                  <div className="text-center text-[12px] text-[var(--label-tertiary)] py-4">
                    Услуг ещё нет
                  </div>
                )}
              </div>
            </div>

            {/* Global discount */}
            {services.length > 0 && (
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1.5">
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
                      className={`flex-1 h-9 rounded-[10px] text-[13px] font-semibold transition ${
                        discType === opt.key
                          ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                          : "bg-[var(--fill-tertiary)] text-[var(--label-secondary)]"
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
                    className="w-full h-11 px-3.5 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[15px] text-[var(--label)] tabular-nums focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
                  />
                )}
              </div>
            )}

            {/* Preview total */}
            <div className="rounded-[14px] bg-[var(--fill-tertiary)] border border-[var(--separator)] p-3">
              <div className="flex items-center justify-between text-[12px] text-[var(--label-secondary)]">
                <span>Подытог</span>
                <span className="tabular-nums">{formatEUR(sub)}</span>
              </div>
              {previewDiscount > 0 && (
                <div className="flex items-center justify-between text-[12px] text-[var(--system-red)] font-semibold">
                  <span>Скидка</span>
                  <span className="tabular-nums">−{formatEUR(previewDiscount)}</span>
                </div>
              )}
              <div className="h-px bg-[var(--separator)] my-1.5" />
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-semibold text-[var(--label)]">
                  Итого
                </span>
                <span className="text-[22px] font-bold tabular-nums text-[var(--label)]">
                  {formatEUR(previewTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex-shrink-0 px-4 pt-2 border-t border-[var(--separator)]"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 10px)" }}
        >
          <button
            type="button"
            onClick={applyDiscount}
            className="w-full h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.99]"
          >
            Применить
          </button>
        </div>
      </div>
    </div>
  );
}
