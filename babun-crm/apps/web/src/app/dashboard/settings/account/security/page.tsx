// STORY-077 — Вход и безопасность subpage.
//
// Brief 2 #20/#21 (per user decision 2026-05-17): «Скоро»-плашки
// удалены, чтобы страница не обещала функционал, которого нет. То
// что не работает — собрано одной строкой в «Coming-soon footer»
// внизу: «Скоро: SMS-код, email-код, FaceID, журнал входов».
//
// Components LoginHistorySection.tsx + FaceIdSection.tsx остаются в
// репо для будущей имплементации (STORY-097 / STORY-098 в
// REMAINING-WORK-2026-05-17.md), но НЕ монтируются здесь.

import { redirect } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { getSupabaseServer } from "@/lib/supabase/server";
import SecuritySection from "@/components/settings/account/SecuritySection";
import DevicesSection from "@/components/settings/account/DevicesSection";
import DangerZoneSection from "@/components/settings/account/DangerZoneSection";

export default async function SecurityPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <>
      <PageHeader title="Вход и безопасность" backHref="/dashboard/settings" />
      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-xl mx-auto px-4 py-4 space-y-5">
          <SecuritySection />
          <DevicesSection />
          <DangerZoneSection email={user.email ?? ""} />
          <div className="text-center text-[11px] text-[var(--label-tertiary)] leading-snug px-4">
            Скоро: SMS-код, email-код, FaceID, журнал входов
          </div>
        </div>
      </div>
    </>
  );
}
