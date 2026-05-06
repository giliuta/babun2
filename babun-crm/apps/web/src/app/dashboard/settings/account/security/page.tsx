// STORY-077 — Вход и безопасность subpage.
//
// Pulls together every entry-point control:
//   * SecuritySection — пароль + 2FA TOTP (existing) + email/SMS stubs
//   * Подключенные устройства — list + sign out (placeholder for v402)
//   * История входов — placeholder
//   * Face ID — placeholder
//   * Опасная зона — удаление аккаунта (was inside Аккаунт)

import { redirect } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { getSupabaseServer } from "@/lib/supabase/server";
import SecuritySection from "@/components/settings/account/SecuritySection";
import DevicesSection from "@/components/settings/account/DevicesSection";
import LoginHistorySection from "@/components/settings/account/LoginHistorySection";
import FaceIdSection from "@/components/settings/account/FaceIdSection";
import DangerZoneSection from "@/components/settings/account/DangerZoneSection";

export default async function SecurityPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <>
      <PageHeader title="Вход и безопасность" backHref="/dashboard/settings/account" />
      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-xl mx-auto px-4 py-4 space-y-5">
          <SecuritySection />
          <FaceIdSection />
          <DevicesSection />
          <LoginHistorySection />
          <DangerZoneSection />
        </div>
      </div>
    </>
  );
}
