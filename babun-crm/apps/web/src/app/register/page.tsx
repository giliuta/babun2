import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import RegisterForm from "@/components/auth/RegisterForm";

export default async function RegisterPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // v677 / Audit-2026-05-21 P0-12 — authed users should land on the
  // calendar (matches /login redirect target), not /clients. Previous
  // target was a copy-paste from page.tsx and felt arbitrary.
  if (user) redirect("/dashboard");
  return <RegisterForm />;
}
