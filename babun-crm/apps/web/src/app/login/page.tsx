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
  if (user) redirect("/dashboard/clients");
  const { error } = await searchParams;
  return <LoginForm errorCode={error ?? null} />;
}
