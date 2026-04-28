import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import LoginForm from "@/components/auth/LoginForm";

// Server gate — already-signed-in users skip the form.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await searchParams;
  // STORY-038 G3.5 — when ?error=tenant_missing arrives we MUST stay
  // on /login to surface the banner, even if the user has a session
  // (a session without a tenant row IS the broken state we're
  // showing). Otherwise we'd bounce them back to /dashboard, hit the
  // tenant-lookup redirect, and ping-pong forever.
  if (user && !error) redirect("/dashboard/clients");
  return <LoginForm errorCode={error ?? null} />;
}
