// Reset-password page. Reachable via the recovery email link →
// /auth/callback (token_hash flow) → here. The callback already
// established a session via verifyOtp; this page guards against
// the case where the user landed here directly without a session
// (e.g. clicked an expired link, or bookmarked /reset-password).

import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export default async function ResetPasswordPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // No session → callback never fired or token expired. Send the
    // user back to /forgot-password with a message instead of
    // showing them a form that will fail with "Auth session missing".
    redirect("/forgot-password?error=link_expired");
  }
  return <ResetPasswordForm />;
}
