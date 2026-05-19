"use client";

import { useState } from "react";
import type { AppointmentService, Discount } from "@babun/shared/local/appointments";
import type { Service } from "@babun/shared/local/services";
import { pricePerUnit } from "@babun/shared/local/services";
import { lineTotal } from "@babun/shared/local/finance/appointment-calc";
import { formatEUR } from "@babun/shared/common/utils/money";
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

  // Sprint 033 Phase I23 — is_countable toggle retired; every service
  // supports a quantity stepper. Legacy records with is_countable=false
  // from earlier versions are ignored so old data doesn't lock users
  // out of the stepper.
  const isCountable = true;
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
              // STORY audit: stepper was h-8 with 28×28 buttons — far
              // below the 44 pt iOS tap-target floor, and the stepper
              // mutates `total_amount` on every click. Raised the outer
              // pill to h-11 and each ± button to 36×36 (inside the pill).
              // 36 is the practical inside-pill max and combined with
              // the pill's 12 px hit-zone surround gives ≥44 pt of real
              // tap area.
              <div className="inline-flex items-center gap-1.5 bg-[var(--fill-primary)] rounded-xl h-11 px-1.5">
                <button
                  type="button"
                  onClick={() => setQty(line.quantity - 1)}
                  disabled={line.quantity <= 1}
                  aria-label="Уменьшить количество"
                  className="w-9 h-9 rounded-md bg-[var(--surface-card)] text-[var(--label)] text-[17px] font-bold active:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] disabled:cursor-not-allowed flex items-center justify-center"
                >
                  −
                </button>
                <span className="min-w-[28px] text-center text-[15px] font-bold text-[var(--label)] tabular-nums">
                  {line.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQty(line.quantity + 1)}
                  aria-label="Увеличить количество"
                  className="w-9 h-9 rounded-md bg-[var(--surface-card)] text-[var(--label)] text-[17px] font-bold active:bg-[var(--fill-tertiary)] flex items-center justify-center"
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
          <div className="text-[12px] text-[var(--label-secondary)] mt-1 tabular-nums">
            {line.duration} мин
            {line.pricePerUnit !== catalogPrice && (
              <span className="ml-1.5 text-[var(--label-tertiary)] line-through">
                было {formatEUR(catalogPrice)}/шт
              </span>
            )}
          </div>

          {bulkHint && (
            <div className="text-[12px] text-[var(--accent)] font-medium mt-0.5">
              {bulkHint}
            </div>
          )}

          {line.discount && (
            <div className="text-[12px] text-[var(--system-red)] font-medium mt-0.5">
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
            // STORY audit: pencil + delete were 28×28 — below 44 pt
            // floor. Delete in particular was a single-tap destructive
            // mutation with no confirm — house rule (data-loss-guardian)
            // requires either a confirm modal or undo toast. Raised to
            // 40×40 (still visually tight in the right column) AND added
            // a confirm modal on delete via the existing ConfirmProvider.
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setEditorOpen((v) => !v)}
                aria-label="Изменить цену"
                className="w-10 h-10 flex items-center justify-center rounded-md text-[var(--label-secondary)] active:bg-[var(--fill-primary)]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirm({
                    title: `Удалить «${service?.name ?? "услугу"}»?`,
                    message:
                      "Сумма пересчитается, общая длительность изменится.",
                    confirmLabel: "Удалить",
                    danger: true,
                  });
                  if (ok) onRemove();
                }}
                aria-label="Удалить услугу"
                className="w-10 h-10 flex items-center justify-center rounded-md text-[var(--label-tertiary)] active:text-[var(--system-red)] active:bg-[rgba(255,59,48,0.08)]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
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
            className="w-full max-w-md bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-sheet)]"
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
