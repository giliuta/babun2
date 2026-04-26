"use client";

// Browser Supabase client (STORY-036).
//
// Singleton `SupabaseClient<Database>` for use from client components.
// Created lazily on first call so module-time imports don't crash when
// env vars are absent during a fresh clone.

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@babun/shared/db/database.types";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function getSupabaseBrowser() {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
    );
  }
  cached = createBrowserClient<Database>(url, key);
  return cached;
}
