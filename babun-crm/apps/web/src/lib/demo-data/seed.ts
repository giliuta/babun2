/* eslint-disable @typescript-eslint/no-explicit-any */
// `as any` casts on Supabase payloads are intentional — the generated
// Database types pre-date the `is_demo` column (migration
// 20260503_002). Same workaround used in src/app/dashboard/settings/
// billing/actions.ts and tracked alongside the STORY-052b db:types
// regeneration cleanup. File-level disable rather than per-line so
// the cast pattern stays consistent across all four call sites here.

// STORY-059 — sample-data seed.
//
// Settings → Account "Загрузить демо-данные" creates a small fixture
// in the current tenant so testers (and you) can see what a populated
// CRM looks like without entering ten clients by hand. Marked
// `is_demo: true` (migration 20260503_002) so the matching cleanup
// is a single DELETE per table.
//
// Inserts go directly via Supabase (not through the cached repo
// wrappers) — this is a one-shot bulk seed, doesn't need optimistic
// IDB writes, and the realtime channel picks the rows up on its own
// to refresh the in-memory dashboard state.
//
// The demo set is intentionally small (5 clients + 3 appointments).
// Bigger fixtures encourage testers to confuse demo data with their
// own. Russian names + Cyprus cities to match Babun's primary market;
// services left simple ("Чистка кондиционера").

import type { SupabaseClient } from "@supabase/supabase-js";

interface DemoClientFixture {
  full_name: string;
  phone: string;
  city: string;
  /** Schema column on clients table is `comment`, not `notes`. */
  comment: string;
}

interface DemoAppointmentFixture {
  client_index: number;
  /** Days from "today" — keeps demos rolling forward instead of
   *  pinning to a specific calendar date. */
  day_offset: number;
  start_hour: number;
  duration_minutes: number;
  service: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
}

const DEMO_CLIENTS: DemoClientFixture[] = [
  {
    full_name: "Анна Петрова",
    phone: "+35799100001",
    city: "Лимассол",
    comment: "Демо-клиент. Регулярный сервис кондиционера.",
  },
  {
    full_name: "Сергей Иванов",
    phone: "+35799100002",
    city: "Никосия",
    comment: "Демо-клиент. Установка нового split-системы.",
  },
  {
    full_name: "Мария Соколова",
    phone: "+35799100003",
    city: "Пафос",
    comment: "Демо-клиент. Сезонная чистка двух кондиционеров.",
  },
  {
    full_name: "Дмитрий Волков",
    phone: "+35799100004",
    city: "Ларнака",
    comment: "Демо-клиент. Ремонт после короткого замыкания.",
  },
  {
    full_name: "Елена Новикова",
    phone: "+35799100005",
    city: "Лимассол",
    comment: "Демо-клиент. Ежегодное обслуживание трёх объектов.",
  },
];

const DEMO_APPOINTMENTS: DemoAppointmentFixture[] = [
  {
    client_index: 0,
    day_offset: 0,
    start_hour: 10,
    duration_minutes: 60,
    service: "Чистка кондиционера",
    status: "scheduled",
  },
  {
    client_index: 1,
    day_offset: 1,
    start_hour: 14,
    duration_minutes: 120,
    service: "Установка split-системы",
    status: "scheduled",
  },
  {
    client_index: 2,
    day_offset: 2,
    start_hour: 11,
    duration_minutes: 90,
    service: "Сезонная чистка",
    status: "scheduled",
  },
];

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback — extremely unlikely; the demo seed is a dashboard-only
  // path which always has crypto available. Throw rather than ship
  // a non-uuid id that the DB will reject.
  throw new Error("crypto.randomUUID unavailable");
}

function buildAppointmentTimes(
  dayOffset: number,
  startHour: number,
  durationMinutes: number,
): { date: string; time_start: string; time_end: string } {
  // Schema columns are `date` (TEXT, YYYY-MM-DD) and `time_start` /
  // `time_end` (TEXT, HH:MM) — see migration 20260430_003_appointments.
  // These are NOT timestamps, so we build local-clock strings rather
  // than ISO timestamps.
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() + dayOffset);
  start.setHours(startHour, 0, 0, 0);
  const endMinutes = startHour * 60 + durationMinutes;
  const endHour = Math.floor(endMinutes / 60) % 24;
  const endMin = endMinutes % 60;
  const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  const time_start = `${String(startHour).padStart(2, "0")}:00`;
  const time_end = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;
  return { date, time_start, time_end };
}

/**
 * Seed the demo fixture into the current tenant. Returns the count
 * of inserted (clients, appointments). Throws on any insert failure
 * after writing partial state — the cleanup function tolerates that.
 *
 * Uses `as any` casts on the Supabase payloads because the generated
 * Database types pre-date the `is_demo` column (migration
 * 20260503_002). The TypeScript type-regen is tracked alongside the
 * STORY-052b db:types cleanup item.
 */
export async function seedDemoData(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<{ clientCount: number; appointmentCount: number }> {
  const clientIds = DEMO_CLIENTS.map(() => newId());

  const clientRows = DEMO_CLIENTS.map((c, i) => ({
    id: clientIds[i],
    tenant_id: tenantId,
    full_name: c.full_name,
    phone: c.phone,
    city: c.city,
    // Schema column is `comment`, not `notes`.
    comment: c.comment,
    is_demo: true,
    // updated_at + created_at default to now() in the schema.
  }));

  const { error: cErr } = await (supabase.from("clients") as any).insert(
    clientRows,
  );
  if (cErr) throw new Error(`seedDemoData clients: ${cErr.message}`);

  const apptRows = DEMO_APPOINTMENTS.map((a) => {
    const times = buildAppointmentTimes(
      a.day_offset,
      a.start_hour,
      a.duration_minutes,
    );
    return {
      id: newId(),
      tenant_id: tenantId,
      client_id: clientIds[a.client_index],
      // Schema columns: date / time_start / time_end (TEXT) +
      // total_duration (INTEGER). Service name lives inside the
      // jsonb `services` array per migration 20260430_003.
      date: times.date,
      time_start: times.time_start,
      time_end: times.time_end,
      total_duration: a.duration_minutes,
      kind: "work" as const,
      status: a.status,
      comment: `Демо-запись. ${a.service} для ${DEMO_CLIENTS[a.client_index].full_name}.`,
      services: [{ name: a.service, price: 0, duration: a.duration_minutes }],
      is_demo: true,
    };
  });

  const { error: aErr } = await (supabase.from("appointments") as any).insert(
    apptRows,
  );
  if (aErr) throw new Error(`seedDemoData appointments: ${aErr.message}`);

  return {
    clientCount: clientRows.length,
    appointmentCount: apptRows.length,
  };
}

/**
 * Remove every demo row from the current tenant. Idempotent — safe
 * to call when nothing has been seeded.
 */
export async function removeDemoData(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<{ clientsDeleted: number; appointmentsDeleted: number }> {
  // Delete appointments first (FK to clients).
  const { count: aCount, error: aErr } = await (
    supabase.from("appointments") as any
  )
    .delete({ count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("is_demo", true);
  if (aErr) throw new Error(`removeDemoData appointments: ${aErr.message}`);

  const { count: cCount, error: cErr } = await (
    supabase.from("clients") as any
  )
    .delete({ count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("is_demo", true);
  if (cErr) throw new Error(`removeDemoData clients: ${cErr.message}`);

  return {
    clientsDeleted: cCount ?? 0,
    appointmentsDeleted: aCount ?? 0,
  };
}

/**
 * Live count of demo rows in the current tenant — used by the
 * Settings UI to decide whether to show "Загрузить" or "Удалить".
 */
export async function countDemoData(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<number> {
  const { count, error } = await (supabase.from("clients") as any)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("is_demo", true);
  if (error) return 0;
  return count ?? 0;
}
