import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // v677 / Audit-2026-05-21 P0-12 — match /login and /register: go to
  // /dashboard, not /clients.
  if (user) redirect("/dashboard");
  const { error } = await searchParams;
  return <ForgotPasswordForm errorCode={error ?? null} />;
}
