// Backend killswitch (ADR-001).
//
// Three modes drive where the app reads and writes:
//
//   * `localStorage`  — legacy single-device store. Default until the
//                       CEO flips the env var. Keeps the app shippable
//                       while the Supabase project is provisioned.
//   * `shadow`        — reads from localStorage, also reads from
//                       Supabase for each entity and logs a diff.
//                       No Supabase writes. Lets us soak two weeks
//                       of parity data without risking real data.
//   * `supabase`      — Supabase is the source of truth; localStorage
//                       becomes an offline cache served by the IDB
//                       outbox layer (next sub-story).
//
// Configured via NEXT_PUBLIC_BACKEND_MODE so Vercel can flip it per
// environment without a code deploy. Absent / misspelled values fall
// back to `localStorage` — the safe default.

export type BackendMode = "localStorage" | "shadow" | "supabase";

const VALID: BackendMode[] = ["localStorage", "shadow", "supabase"];

export function getBackendMode(): BackendMode {
  const raw = process.env.NEXT_PUBLIC_BACKEND_MODE?.trim();
  if (raw && (VALID as string[]).includes(raw)) {
    return raw as BackendMode;
  }
  return "localStorage";
}

export function isSupabaseEnabled(): boolean {
  const mode = getBackendMode();
  return mode === "shadow" || mode === "supabase";
}

export function isWriteThroughSupabase(): boolean {
  return getBackendMode() === "supabase";
}
