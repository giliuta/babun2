import type { AppointmentService } from "@babun/shared/local/appointments";
import type { Service } from "@/features/services/queries";

export const pad2 = (n: number) => String(n).padStart(2, "0");

export function formatYMD(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseYMD(s: string): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const [y, m, day] = s.split("-").map(Number);
  if (y) d.setFullYear(y, (m || 1) - 1, day || 1);
  return d;
}

export function formatHM(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function parseHM(s: string, base?: Date): Date {
  const d = base ? new Date(base) : new Date();
  const [h, m] = s.split(":").map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

export function addMinutesHM(hm: string, minutes: number): string {
  const [h, m] = hm.split(":").map(Number);
  const total = (h || 0) * 60 + (m || 0) + minutes;
  const norm = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${pad2(Math.floor(norm / 60))}:${pad2(norm % 60)}`;
}

export interface ServiceOverride {
  qty?: number;
  price?: number;
}

// Build the appointment's services[] from selected catalog ids, applying
// per-service quantity / price overrides when present.
export function buildServices(
  serviceIds: string[],
  catalog: Map<string, Service>,
  overrides?: Record<string, ServiceOverride>,
): AppointmentService[] {
  return serviceIds.map((id) => {
    const c = catalog.get(id);
    const catalogPrice = c ? Number(c.price) : 0;
    const baseDuration = c ? c.duration_minutes : 60;
    const ov = overrides?.[id];
    const qty = ov?.qty != null && ov.qty > 0 ? ov.qty : 1;
    const price = ov?.price != null ? ov.price : catalogPrice;
    return {
      serviceId: id,
      quantity: qty,
      pricePerUnit: price,
      originalPrice: catalogPrice,
      totalPrice: price * qty,
      duration: baseDuration * qty,
    };
  });
}

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

// "ср, 15 июля" — human day label from YYYY-MM-DD.
export function humanDay(ymd: string): string {
  if (!ymd) return "—";
  const d = parseYMD(ymd);
  if (Number.isNaN(d.getTime())) return ymd;
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
