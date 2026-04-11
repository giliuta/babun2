import { createClient } from "@supabase/supabase-js";

// Prerender-safe fallbacks: real values are injected via Vercel env vars
// once STORY-001 (Supabase migration) lands. Until then the app runs on
// localStorage and only auth calls touch supabase — those will fail fast
// at runtime if env vars are missing, which is the correct behaviour.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
