// STORY-056 — Pure helpers extracted from EventSheet to keep the
// main component under the 400-line golden-rule budget. No React,
// no side effects — easy to test in isolation.

import type {
  Appointment,
  AppointmentService,
  AppointmentSource,
  Discount,
  PersonalEventRepeat,
} from "@babun/shared/local/appointments";
import type { Client, Location } from "@babun/shared/local/clients";
import type { Service } from "@babun/shared/local/services";
import { pricePerUnit } from "@babun/shared/local/services";
import {
  appointmentTotal,
  totalDuration as calcDuration,
} from "@babun/shared/local/finance/appointment-calc";

export interface EventPayloadInput {
  appointment: Appointment;
  dateKey: string;
  timeStart: string;
  timeEnd: string;
  allDay: boolean;
  title: string;
  color: string;
  notes: string;
  address: string;
  url: string;
  pushOffsetMin: number | null;
  repeat: PersonalEventRepeat;
}

export function buildEventPayload(input: EventPayloadInput): Appointment {
  const { appointment } = input;
  return {
    ...appointment,
    kind: "event",
    date: input.dateKey,
    time_start: input.allDay ? "00:00" : input.timeStart,
    time_end: input.allDay ? "23:59" : input.timeEnd,
    comment: input.title.trim(),
    color_override: input.color,
    address: input.address.trim(),
    event_notes: input.notes.trim(),
    event_url: input.url.trim(),
    event_all_day: input.allDay,
    event_push_enabled: input.pushOffsetMin !== null,
    event_push_offsets: input.pushOffsetMin !== null ? [input.pushOffsetMin] : [],
    event_push_at: null,
    event_repeat: input.repeat,
    team_id: appointment.team_id ?? null,
    total_amount: 0,
    custom_total: true,
    status: appointment.status === "cancelled" ? "cancelled" : "scheduled",
    updated_at: new Date().toISOString(),
  };
}

export interface WorkPayloadInput {
  appointment: Appointment;
  mode: "create" | "edit";
  dateKey: string;
  timeStart: string;
  timeEnd: string;
  client: Client | null;
  clientId: string | null;
  selectedLocation: Location | null;
  locationId: string | null;
  addressNote: string;
  services: AppointmentService[];
  globalDiscount: Discount | null;
  catalog: Service[];
  comment: string;
  source: AppointmentSource | null;
  activeTeamId: string | null;
}

export function buildWorkPayload(input: WorkPayloadInput): Appointment {
  const { appointment, services, catalog, comment } = input;
  const totalAmount = appointmentTotal(services, input.globalDiscount);
  const totalDur = calcDuration(services);
  const serviceNames = services
    .map((l) => {
      const svc = catalog.find((s) => s.id === l.serviceId);
      return svc ? (l.quantity > 1 ? `x${l.quantity} ${svc.name}` : svc.name) : null;
    })
    .filter(Boolean)
    .join(", ");
  const finalComment = comment.trim() ? `${serviceNames} — ${comment.trim()}` : serviceNames;
  const computedEnd = (() => {
    if (input.mode !== "create" || totalDur <= 0) return input.timeEnd;
    const [h, m] = input.timeStart.split(":").map(Number);
    const endMin = Math.min(23 * 60 + 59, h * 60 + m + totalDur);
    return `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
  })();
  return {
    ...appointment,
    kind: "work",
    date: input.dateKey,
    time_start: input.timeStart,
    time_end: computedEnd,
    client_id: input.clientId,
    location_id: input.locationId,
    team_id: input.activeTeamId,
    service_ids: services.map((s) => s.serviceId),
    services,
    global_discount: input.globalDiscount,
    total_duration: totalDur,
    total_amount: totalAmount,
    custom_total: true,
    comment: finalComment,
    address: input.selectedLocation?.address ?? appointment.address ?? "",
    address_note: input.addressNote.trim(),
    source: input.source,
    reminder_enabled: appointment.reminder_enabled && Boolean(input.client?.phone),
    status:
      appointment.status === "cancelled"
        ? "cancelled"
        : appointment.status === "completed"
          ? "completed"
          : "scheduled",
    updated_at: new Date().toISOString(),
  };
}

// id ↔ AppointmentService helpers — same logic as legacy AppointmentSheet
// so the saved row matches dispatcher expectations exactly.
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
  const seen = new Set<string>();
  for (const line of prev) {
    const q = qty.get(line.serviceId);
    if (!q) continue;
    seen.add(line.serviceId);
    const svc = byId.get(line.serviceId);
    if (!svc) continue;
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
