import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export default async function ForgotPasswordPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard/clients");
  return <ForgotPasswordForm />;
}
