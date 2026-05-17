// Anon-role Supabase client for server contexts (Beta #52 — public
// feedback page + submit route).
//
// `getSupabaseService()` is the right tool when you legitimately need
// to bypass RLS (account self-delete, cron jobs). For public surfaces
// like /feedback/<token>, using service role is unnecessary risk —
// and on Vercel deploys where SUPABASE_SECRET_KEY is missing or holds
// the publishable key by mistake, it silently downgrades to anon and
// the surface returns 404.
//
// This helper takes the explicit "I want anon" path: reads the same
// NEXT_PUBLIC_* env vars that the browser client uses (so it's
// guaranteed to be set on any deploy that boots at all), builds a
// stateless client, and lets the SECURITY DEFINER RPCs from
// migration _007 (lookup_rating_token, submit_rating) carry the
// privileged work.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@babun/shared/db/database.types";

export function getSupabaseAnonServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
