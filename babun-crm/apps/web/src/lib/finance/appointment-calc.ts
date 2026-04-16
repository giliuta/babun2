// MEGA-UPDATE: pure calculation helpers for a multi-service
// appointment with per-line and global discounts.
//
// Все функции чистые, не трогают DOM / localStorage. Поддерживают
// легковесный unit-testing в будущем (пока без Vitest).

import type { AppointmentService, Discount } from "@/lib/appointments";

/** Apply a discount to a number; clamped to [0, base]. */
export function applyDiscount(base: number, discount?: Discount | null): number {
  if (!discount) return base;
  const off =
    discount.type === "percent"
      ? (base * discount.value) / 100
      : discount.value;
  return Math.max(0, base - off);
}

/** Per-line total: qty × pricePerUnit − line discount. */
export function lineTotal(line: AppointmentService): number {
  const base = line.quantity * line.pricePerUnit;
  return Math.round(applyDiscount(base, line.discount));
}

/** Sum of line totals. */
export function subtotal(services: AppointmentService[]): number {
  return services.reduce((acc, l) => acc + lineTotal(l), 0);
}

/** Total = subtotal − globalDiscount. */
export function appointmentTotal(
  services: AppointmentService[],
  globalDiscount?: Discount | null
): number {
  const sub = subtotal(services);
  return Math.round(applyDiscount(sub, globalDiscount));
}

/** Sum of line durations — кешируется в appointment.total_duration. */
export function totalDuration(services: AppointmentService[]): number {
  return services.reduce((acc, l) => acc + l.duration, 0);
}

/** Рассчитать globalDiscount amount (в евро) для отображения. */
export function globalDiscountAmount(
  services: AppointmentService[],
  globalDiscount?: Discount | null
): number {
  if (!globalDiscount) return 0;
  const sub = subtotal(services);
  const after = applyDiscount(sub, globalDiscount);
  return Math.round(sub - after);
}
