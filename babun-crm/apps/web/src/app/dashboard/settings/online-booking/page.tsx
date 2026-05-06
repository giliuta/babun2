// Settings → Online booking (STORY-085).
//
// Hub for everything related to the customer-facing booking page that
// will eventually live at babun.app/book/<slug>. Today the page is a
// stub for the booking_slug field that used to live in BrandContacts —
// future passes will add: working hours selector, deposit toggle,
// confirmation message editor, slot availability rules, etc.

import { redirect } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { getSupabaseServer } from "@/lib/supabase/server";
import OnlineBookingForm from "@/components/settings/online-booking/OnlineBookingForm";

export default async function OnlineBookingPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tenantId = (user.app_metadata as { tenant_id?: string } | undefined)
    ?.tenant_id;
  if (!tenantId) redirect("/login?error=tenant_missing");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (supabase as any)
    .from("tenants")
    .select("booking_slug")
    .eq("id", tenantId)
    .maybeSingle();

  return (
    <>
      <PageHeader title="Онлайн запись" backHref="/dashboard/settings" />
      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-xl mx-auto px-4 py-4 space-y-5">
          <OnlineBookingForm
            initialSlug={tenant?.booking_slug ?? null}
          />

          <div className="px-4 text-[12px] text-[var(--label-tertiary)] leading-snug">
            Скоро здесь появятся: рабочие часы для онлайн-записи,
            предоплата, тексты подтверждения и правила слотов.
          </div>
        </div>
      </div>
    </>
  );
}
