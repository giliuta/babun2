import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import RegisterForm from "@/components/auth/RegisterForm";

export default async function RegisterPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard/clients");
  return <RegisterForm />;
}
