// 0001_seed_brigades: seed 3 finance brigades; backfill brigadeId on
// existing appointments (default br_yd).

import { seedBrigades } from "@/lib/brigades";
import { loadAppointments, saveAppointments } from "@/lib/appointments";

export function migration0001SeedBrigades(): void {
  seedBrigades();

  // Backfill brigadeId on appointments that don't have one yet.
  // Cast to a record so we can inspect the field without touching Appointment type.
  const appointments = loadAppointments();
  let changed = false;
  const patched = appointments.map((a) => {
    const raw = a as unknown as Record<string, unknown>;
    if (!raw["brigadeId"]) {
      changed = true;
      return { ...a, brigadeId: "br_yd" };
    }
    return a;
  });
  if (changed) saveAppointments(patched);
}
