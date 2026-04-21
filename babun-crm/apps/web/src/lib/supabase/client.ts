"use client";

// Browser Supabase client.
//
// Returns a singleton `SupabaseClient<Database>` configured with the
// env-provided URL + anon key. Uses `@supabase/supabase-js` directly
// (no `@supabase/ssr`) because Babun is a client-only PWA — auth state
// lives in the browser, there's no server-side data fetching today.
// Revisit if we add server actions.
//
// The client is created *lazily* on first call so that modules which
// import this file don't crash at import time when env vars are
// absent (during the long scaffolding phase before the CEO provisions
// the project).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

type Client = SupabaseClient<Database>;

let cached: Client | null = null;

export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function getSupabase(): Client {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  cached = createClient<Database>(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return cached;
}

export type { Client as Supabase };
