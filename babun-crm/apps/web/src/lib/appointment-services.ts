// id ↔ AppointmentService helpers. ServicePickerSheet operates on a
// `string[]` with duplicates (quantity = number of repeated ids).
// AppointmentService[] is what we need for bulk-price tiers and
// per-line price overrides. These two bridge the representations
// while preserving operator overrides from the previous state.
// v615 — extracted from AppointmentSheet (Sprint #4 §9 pass 2).

import type { AppointmentService } from "@babun/shared/local/appointments";
import { type Service, pricePerUnit } from "@babun/shared/local/services";

export function servicesToIds(list: AppointmentService[]): string[] {
  const out: string[] = [];
  for (const s of list) {
    for (let i = 0; i < s.quantity; i++) out.push(s.serviceId);
  }
  return out;
}

export function idsToServices(
  ids: string[],
  catalog: Service[],
  prev: AppointmentService[],
): AppointmentService[] {
  const byId = new Map<string, Service>();
  for (const svc of catalog) byId.set(svc.id, svc);

  const qty = new Map<string, number>();
  for (const id of ids) qty.set(id, (qty.get(id) ?? 0) + 1);

  const out: AppointmentService[] = [];
  // Preserve original order: first the lines already in prev (so manual
  // UI reorderings survive), then the new ones.
  const seen = new Set<string>();
  for (const line of prev) {
    const q = qty.get(line.serviceId);
    if (!q) continue;
    seen.add(line.serviceId);
    const svc = byId.get(line.serviceId);
    if (!svc) continue;
    // If the operator didn't touch the price (pricePerUnit ===
    // originalPrice), recompute with bulk tiers. If they did, keep the
    // override.
    const userOverride = line.pricePerUnit !== line.originalPrice;
    const ppu = userOverride ? line.pricePerUnit : pricePerUnit(svc, q);
    out.push({
      ...line,
      quantity: q,
      pricePerUnit: ppu,
      originalPrice: svc.price,
      totalPrice: q * ppu,
      duration: q * svc.duration_minutes,
    });
  }
  for (const [id, q] of qty) {
    if (seen.has(id)) continue;
    const svc = byId.get(id);
    if (!svc) continue;
    const ppu = pricePerUnit(svc, q);
    out.push({
      serviceId: id,
      quantity: q,
      pricePerUnit: ppu,
      originalPrice: svc.price,
      totalPrice: q * ppu,
      duration: q * svc.duration_minutes,
    });
  }
  return out;
}
