"use client";

import { useMemo } from "react";
import type {
  AppointmentService,
  Discount,
} from "@babun/shared/local/appointments";
import type { Service } from "@babun/shared/local/services";
import { lineTotal } from "@babun/shared/local/finance/appointment-calc";
import { pricePerUnit } from "@babun/shared/local/services";
import { formatEUR } from "@babun/shared/common/utils/money";

interface ServicesBlockProps {
  services: AppointmentService[];
  globalDiscount: Discount | null;
  catalog: Service[];
  readonly: boolean;
  onServicesChange: (next: AppointmentService[]) => void;
  onGlobalDiscountChange?: (next: Discount | null) => void;
  onOpenPicker: () => void;
  /** v611 P0 §1.6 — 3 most-used services in the tenant's history.
   *  Rendered as a chip strip in the empty state for one-tap add.
   *  Empty array hides the strip (cold-start tenants, fresh demo). */
  popularServices?: Service[];
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
  popularServices = [],
}: ServicesBlockProps) {
  const addService = (svc: Service) => {
    const existing = services.find((l) => l.serviceId === svc.id);
    if (existing) {
      const nextQty = existing.quantity + 1;
      const ppu = pricePerUnit(svc, nextQty);
      onServicesChange(
        services.map((l) =>
          l.serviceId === svc.id
            ? {
                ...l,
                quantity: nextQty,
                pricePerUnit: ppu,
                originalPrice: svc.price,
                totalPrice: nextQty * ppu,
                duration: nextQty * svc.duration_minutes,
              }
            : l
        )
      );
      return;
    }
    const ppu = pricePerUnit(svc, 1);
    onServicesChange([
      ...services,
      {
        serviceId: svc.id,
        quantity: 1,
        pricePerUnit: ppu,
        originalPrice: svc.price,
        totalPrice: ppu,
        duration: svc.duration_minutes,
      },
    ]);
  };
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
    <div className="px-4 pt-2 space-y-2">
      {/* STORY audit: ДВА фикса в одном.
          1) Раньше popular chips показывались ТОЛЬКО когда
             services.length === 0. Диспетчер добавил первую услугу
             («Сплит-система»), второй услугой обычно идёт «Монтаж» из
             популярных — а chips уже скрылись. Теперь показываются
             всегда, пока !readonly.
          2) chips h-8 → h-10. Это primary one-tap shortcut, должен
             быть 44 pt-class tap target. */}
      {!readonly && popularServices.length > 0 && (
        <div
          className="flex gap-2 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {popularServices.slice(0, 5).map((svc) => (
            <button
              key={svc.id}
              type="button"
              onClick={() => addService(svc)}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 h-10 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] border border-[var(--accent)]/30 text-[13px] font-semibold active:scale-[0.97]"
            >
              <span className="text-[15px] leading-none">+</span>
              <span className="truncate max-w-[160px]">{svc.name}</span>
            </button>
          ))}
        </div>
      )}
      <div className="rounded-[14px] bg-[var(--surface-card)] border border-[var(--separator)] divide-y divide-[var(--separator)] overflow-hidden">
        {services.length === 0 ? (
          <button
            type="button"
            disabled={readonly}
            onClick={onOpenPicker}
            className={`${rowBase} justify-center text-[15px] font-semibold text-[var(--accent)] disabled:text-[var(--label-tertiary)] disabled:cursor-not-allowed`}
          >
            <span className="text-[16px] leading-none">+</span>
            Выбрать услугу
          </button>
        ) : (
          services.map((line, idx) => {
            const svc = byId.get(line.serviceId) ?? null;
            const total = lineTotal(line);
            // v616 P2 — 4 px category-colour stripe on the left edge so
            // the operator scans the list by category at a glance.
            const stripe = svc?.color ?? "transparent";
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
                aria-label={readonly ? undefined : `Заменить услугу «${svc?.name ?? "Услуга"}» — откроется список услуг`}
                className={rowBase}
                style={{ borderLeft: `4px solid ${stripe}` }}
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
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
