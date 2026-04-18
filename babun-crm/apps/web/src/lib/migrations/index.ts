// Migration runner — idempotent, tracks applied migrations in localStorage.
//
// Each migration runs exactly once. Applied IDs are persisted in
// babun2:migrations. Import runAllMigrations() from the app bootstrap.

import { migration0001SeedBrigades } from "./0001_seed_brigades";
import { migration0002AppointmentFinance } from "./0002_appointment_finance";
import { migration0003ClientSalutation } from "./0003_client_salutation";
import { migration0004ServiceCategories } from "./0004_service_categories";

const MIGRATIONS_KEY = "babun2:migrations";

type MigrationFn = () => void;

interface Migration {
  id: string;
  run: MigrationFn;
}

const ALL_MIGRATIONS: Migration[] = [
  { id: "0001_seed_brigades", run: migration0001SeedBrigades },
  { id: "0002_appointment_finance", run: migration0002AppointmentFinance },
  { id: "0003_client_salutation", run: migration0003ClientSalutation },
  { id: "0004_service_categories", run: migration0004ServiceCategories },
];

function loadApplied(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MIGRATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function markApplied(id: string): void {
  const applied = loadApplied();
  if (!applied.includes(id)) {
    applied.push(id);
    window.localStorage.setItem(MIGRATIONS_KEY, JSON.stringify(applied));
  }
}

export function runAllMigrations(): void {
  if (typeof window === "undefined") return;
  const applied = loadApplied();
  for (const migration of ALL_MIGRATIONS) {
    if (!applied.includes(migration.id)) {
      try {
        migration.run();
        markApplied(migration.id);
      } catch (err) {
        console.error(`Migration ${migration.id} failed:`, err);
      }
    }
  }
}

export function getAppliedMigrations(): string[] {
  return loadApplied();
}
