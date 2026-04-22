"use client";

import { useState } from "react";
import type { AppointmentService, Discount } from "@/lib/appointments";
import type { Service } from "@/lib/services";
import { pricePerUnit } from "@/lib/services";
import { lineTotal } from "@/lib/finance/appointment-calc";
import { formatEUR } from "@/lib/money";
import PriceEditor from "./PriceEditor";
import { useConfirm } from "@/components/ui/ConfirmProvider";

interface ServiceRowProps {
  line: AppointmentService;
  service: Service | null;
  readonly: boolean;
  onUpdate: (next: AppointmentService) => void;
  onRemove: () => void;
}

// Одна услуга в записи. Степпер [− N +] (скрыт если
// service.is_countable === false), крупная цена справа, под ней
// длительность и бейдж скидки / bulk-подсказка, кнопка ✏️ открывает
// PriceEditor. Крест справа удаляет строку.
export default function ServiceRow({
  line,
  service,
  readonly,
  onUpdate,
  onRemove,
}: ServiceRowProps) {
  const confirm = useConfirm();
  const [editorOpen, setEditorOpen] = useState(false);
  const catalogPrice = service?.price ?? line.originalPrice;
  const displayTotal = lineTotal(line);

  const setQty = (q: number) => {
    if (!service) return;
    const safeQ = Math.max(1, q);
    const baseDur = service.duration_minutes;
    // Если bulk должен сработать — подтягиваем pricePerUnit автоматически,
    // но только если пользователь не переопределил цену вручную.
    const bulkPrice = pricePerUnit(service, safeQ);
    const userOverrode = line.pricePerUnit !== line.originalPrice;
    const nextPpu = userOverrode ? line.pricePerUnit : bulkPrice;
    onUpdate({
      ...line,
      quantity: safeQ,
      pricePerUnit: nextPpu,
      duration: safeQ * baseDur,
      totalPrice: 0, // пересчитается через lineTotal при отрисовке
    });
  };

  const setPriceAndDiscount = (ppu: number, discount: Discount | null) => {
    onUpdate({
      ...line,
      pricePerUnit: ppu,
      discount: discount ?? undefined,
    });
  };

  const isCountable = service?.is_countable ?? true;
  const bulkHint =
    service &&
    service.bulk_threshold > 0 &&
    service.bulk_price > 0 &&
    line.quantity >= service.bulk_threshold
      ? `от ${service.bulk_threshold}шт — ${service.bulk_price}€ вместо ${service.price}€`
      : null;

  return (
    <div className="bg-[var(--surface-card)] rounded-xl border border-[var(--separator)] px-3 py-2.5">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-[var(--label)] truncate">
            {service?.name ?? "Услуга"}
          </div>

          {/* Qty stepper + price expression */}
          <div className="flex items-center gap-2 mt-1.5">
            {isCountable && !readonly ? (
              <div className="inline-flex items-center gap-1 bg-[var(--fill-primary)] rounded-lg h-8 px-1">
                <button
                  type="button"
                  onClick={() => setQty(line.quantity - 1)}
                  disabled={line.quantity <= 1}
                  className="w-7 h-7 rounded-md bg-[var(--surface-card)] text-[var(--label)] text-[15px] font-bold active:bg-[var(--fill-tertiary)] disabled:opacity-40 flex items-center justify-center"
                >
                  −
                </button>
                <span className="min-w-[24px] text-center text-[14px] font-bold text-[var(--label)] tabular-nums">
                  {line.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQty(line.quantity + 1)}
                  className="w-7 h-7 rounded-md bg-[var(--surface-card)] text-[var(--label)] text-[15px] font-bold active:bg-[var(--fill-tertiary)] flex items-center justify-center"
                >
                  +
                </button>
              </div>
            ) : (
              <span className="text-[12px] font-semibold text-[var(--label-secondary)] tabular-nums">
                × {line.quantity}
              </span>
            )}
            <span className="text-[12px] text-[var(--label-secondary)] tabular-nums">
              × {formatEUR(line.pricePerUnit)}
            </span>
          </div>

          {/* Duration + hints */}
          <div className="text-[11px] text-[var(--label-secondary)] mt-1 tabular-nums">
            {line.duration} мин
            {line.pricePerUnit !== catalogPrice && (
              <span className="ml-1.5 text-[var(--label-tertiary)] line-through">
                было {formatEUR(catalogPrice)}/шт
              </span>
            )}
          </div>

          {bulkHint && (
            <div className="text-[11px] text-[var(--accent)] font-medium mt-0.5">
              {bulkHint}
            </div>
          )}

          {line.discount && (
            <div className="text-[11px] text-[var(--system-red)] font-medium mt-0.5">
              🏷 скидка{" "}
              {line.discount.type === "percent"
                ? `${line.discount.value}%`
                : `−€${line.discount.value}`}
              {line.discount.reason && ` · ${line.discount.reason}`}
            </div>
          )}
        </div>

        {/* Right column: total + actions */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="text-[16px] font-bold text-[var(--system-green)] tabular-nums">
            {formatEUR(displayTotal)}
          </div>
          {!readonly && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setEditorOpen((v) => !v)}
                aria-label="Изменить цену"
                className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--label-secondary)] active:bg-[var(--fill-primary)]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={onRemove}
                aria-label="Удалить"
                className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--label-tertiary)] active:text-[var(--system-red)]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {editorOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
          onClick={async () => {
            // Guard: PriceEditor has its own internal draft — always
            // confirm before silently losing it on backdrop-tap.
            if (
              await confirm({
                title: "Закрыть без применения изменений?",
                confirmLabel: "Закрыть",
                danger: false,
              })
            ) {
              setEditorOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-md bg-[var(--surface-card)] rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pt-3 pb-2 text-[13px] font-semibold text-[var(--label)] truncate">
              {service?.name ?? "Цена"}
            </div>
            <PriceEditor
              catalogPrice={catalogPrice}
              currentPricePerUnit={line.pricePerUnit}
              currentDiscount={line.discount}
              onApply={setPriceAndDiscount}
              onClose={() => setEditorOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
