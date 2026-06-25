import { useSession } from "@/providers/SessionProvider";

// Current tenant id from the JWT app_metadata (set on signup; RLS also has a
// tenant_members fallback). Queries gate on this being present.
export function useTenantId(): string | null {
  const { session } = useSession();
  const meta = session?.user.app_metadata as { tenant_id?: string } | undefined;
  return meta?.tenant_id ?? null;
}
