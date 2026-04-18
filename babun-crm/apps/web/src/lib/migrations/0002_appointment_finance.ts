// 0002_appointment_finance: create AppointmentFinance records for
// existing appointments using dummy defaults. Idempotent — skips
// appointments that already have a finance record.

import { generateId } from "@/lib/masters";
import { loadAppointments } from "@/lib/appointments";
import type { AppointmentFinance } from "@babun/shared/types/finance";

const AF_KEY = "babun2:finance:appointment_finance";

function loadAppointmentFinances(): AppointmentFinance[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(AF_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAppointmentFinances(list: AppointmentFinance[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AF_KEY, JSON.stringify(list));
  } catch {
    // ignore quota errors
  }
}

export function migration0002AppointmentFinance(): void {
  const appointments = loadAppointments();
  const existing = loadAppointmentFinances();
  const existingAptIds = new Set(existing.map((af) => af.appointmentId));

  const toAdd: AppointmentFinance[] = [];

  for (const apt of appointments) {
    if (existingAptIds.has(apt.id)) continue;

    // Map legacy total_amount (EUR float) to euro-cents for subtotal.
    const subtotalEur = Math.round((apt.total_amount ?? 0) * 100);
    const discountEur = Math.round((apt.discount_amount ?? 0) * 100);
    const totalEur = Math.max(0, subtotalEur - discountEur);

    // Map legacy status to finance status.
    let status: AppointmentFinance["status"] = "new";
    if (apt.status === "completed") status = "completed";
    else if (apt.status === "cancelled") status = "cancelled";

    toAdd.push({
      id: generateId("af"),
      appointmentId: apt.id,
      brigadeId: (apt as unknown as Record<string, unknown>)["brigadeId"] as string | null ?? "br_yd",
      serviceLines: [],
      discountPercent: 0,
      discountAbsoluteEur: discountEur,
      subtotalEur,
      discountEur,
      totalEur,
      outsourceCostTotalEur: 0,
      status,
      source: apt.is_online_booking ? "online" : "manual",
      completedAt: status === "completed" ? (apt.updated_at ?? null) : null,
      createdAt: apt.created_at ?? new Date().toISOString(),
    });
  }

  if (toAdd.length > 0) {
    saveAppointmentFinances([...existing, ...toAdd]);
  }
}
