"use client";

// Auth session provider.
//
// Responsibilities:
//   1. On mount, read the current session from Supabase (if configured)
//      and expose it via context.
//   2. Subscribe to `onAuthStateChange` so login / logout / token
//      refresh flows propagate instantly to every consumer.
//   3. Expose `tenantId` pulled from the JWT claim / users table so
//      downstream queries don't have to fetch it each time.
//
// When Supabase is not yet configured (env missing, or BACKEND_MODE is
// `localStorage`), the provider renders children with `ready=true,
// session=null` — the rest of the app keeps using localStorage as
// before. No runtime surprises.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, hasSupabaseEnv } from "./client";
import { isSupabaseEnabled } from "./backend-mode";

interface SupabaseContextValue {
  /** `true` once the initial session hydration finished (success or failure). */
  ready: boolean;
  /** `null` when signed out, offline, or Supabase is disabled. */
  session: Session | null;
  user: User | null;
  /** Tenant id from the public.users row, or null when unauthenticated. */
  tenantId: string | null;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SupabaseContextValue | null>(null);

export function useSupabase(): SupabaseContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSupabase must be used within SupabaseProvider");
  return ctx;
}

export default function SupabaseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const enabled = useMemo(
    () => isSupabaseEnabled() && hasSupabaseEnv(),
    []
  );

  useEffect(() => {
    if (!enabled) {
      setReady(true);
      return;
    }

    const sb = getSupabase();
    let mounted = true;

    const hydrate = async () => {
      const { data } = await sb.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        await fetchTenant(data.session.user.id);
      }
      setReady(true);
    };

    const fetchTenant = async (userId: string) => {
      // Typed `.select("tenant_id")` resolves into a narrow shape that
      // TS rejects under our local Database definition (issue tracked
      // by replacing types.ts with `supabase gen types` output). Cast
      // the result to the narrow row we actually care about.
      const { data, error } = await sb
        .from("users")
        .select("tenant_id")
        .eq("id", userId)
        .maybeSingle<{ tenant_id: string }>();
      if (error) {
        // Signup trigger might still be racing on first load; surface
        // the null and let the UI retry on the next auth event.
        setTenantId(null);
        return;
      }
      setTenantId(data?.tenant_id ?? null);
    };

    hydrate();

    const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return;
      setSession(next);
      if (next?.user) {
        fetchTenant(next.user.id);
      } else {
        setTenantId(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [enabled]);

  const signOut = useCallback(async () => {
    if (!enabled) return;
    await getSupabase().auth.signOut();
  }, [enabled]);

  const value = useMemo<SupabaseContextValue>(
    () => ({
      ready,
      session,
      user: session?.user ?? null,
      tenantId,
      signOut,
    }),
    [ready, session, tenantId, signOut]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
