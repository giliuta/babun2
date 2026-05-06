// STORY-077 — Apple-style settings hub.
//
// Top-level hub that navigates to per-section pages instead of
// rendering one giant scrolly page. Mirrors the structure of iOS
// Settings → Apple Account: profile card on top, then nav rows.

import { redirect } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { getSupabaseServer } from "@/lib/supabase/server";
import AccountNavList from "@/components/settings/account/AccountNavList";

export default async function AccountSettingsPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const email = user.email ?? "";
  const initials = email.length > 0 ? email[0]!.toUpperCase() : "?";

  return (
    <>
      <PageHeader title="Аккаунт" backHref="/dashboard/settings" />
      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-xl mx-auto px-4 py-4">
          <AccountNavList email={email} initials={initials} />
        </div>
      </div>
    </>
  );
}
