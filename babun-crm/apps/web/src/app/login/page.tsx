import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import LoginForm from "@/components/auth/LoginForm";

// Server gate — already-signed-in users skip the form.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; deleted?: string }>;
}) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error, deleted } = await searchParams;
  // STORY-038 G3.5 — when ?error=tenant_missing arrives we MUST stay
  // on /login to surface the banner, even if the user has a session
  // (a session without a tenant row IS the broken state we're
  // showing). Otherwise we'd bounce them back to /dashboard, hit the
  // tenant-lookup redirect, and ping-pong forever.
  // STORY-041 G4 — same belt-and-suspenders for ?deleted=true: the
  // session may still be in the cookie when the redirect lands,
  // before the client-side signOut completes.
  if (user && !error && !deleted) redirect("/dashboard/clients");
  return <LoginForm errorCode={error ?? null} deleted={deleted === "true"} />;
}
