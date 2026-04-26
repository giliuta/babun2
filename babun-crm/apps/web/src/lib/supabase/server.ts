// Server Supabase client (STORY-036).
//
// For use in route handlers, server components, server actions.
// Reads cookies via Next 16's async `cookies()`. No middleware-based
// session refresh in STORY-036 — auth lands in STORY-037.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@babun/shared/db/database.types";

export async function getSupabaseServer() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const c of toSet) {
            cookieStore.set(c.name, c.value, c.options);
          }
        } catch {
          // Read-only cookie store inside a server component — safe to
          // ignore until middleware-based refresh lands in STORY-037.
        }
      },
    },
  });
}
