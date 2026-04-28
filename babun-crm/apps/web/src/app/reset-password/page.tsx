import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

// Reset-password page. Reachable via the magic link Supabase emails on
// password recovery. The /auth/callback route handler exchanges the
// `code` query param for a session, then redirects here. From this
// point the user has a session — updateUser({ password }) just works.

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
