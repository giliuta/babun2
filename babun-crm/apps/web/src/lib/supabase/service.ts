// Service-role Supabase client (STORY-041 G4).
//
// Server-only. Use ONLY for operations that legitimately need to
// bypass RLS — currently just account self-delete (cascade across
// tenant data + auth.users) where the user is the same person whose
// JWT we already validated upstream. Do NOT use this from any
// surface that has untrusted input.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@babun/shared/db/database.types";

export function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Supabase's modern naming is SUPABASE_SECRET_KEY; older deploys
  // keep SUPABASE_SERVICE_ROLE_KEY around — accept either.
  const secret =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) {
    throw new Error(
      "Supabase service env missing. Set SUPABASE_SECRET_KEY (server-only).",
    );
  }
  return createClient<Database>(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
