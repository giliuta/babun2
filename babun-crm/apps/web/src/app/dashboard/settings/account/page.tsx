// STORY-041 G4 — Account settings hub.
//
// Server component shell that resolves user + tenant once, then hands
// off to client sub-sections. The four sections are split to honour
// the 400-line cap and let each form manage its own state without
// pulling in a global store. The dashboard layout already guarantees
// a session and a tenant row, but we re-fetch user + tenant here so
// each form gets stable initial values without an extra round-trip.

import { redirect } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { getSupabaseServer } from "@/lib/supabase/server";
import AccountSection from "@/components/settings/account/AccountSection";
import BusinessSection from "@/components/settings/account/BusinessSection";
import BrandContactsSection from "@/components/settings/account/BrandContactsSection";
import RegionSection from "@/components/settings/account/RegionSection";
import PersonalCalendarSection from "@/components/settings/account/PersonalCalendarSection";
import SecuritySection from "@/components/settings/account/SecuritySection";
import ImportLocalAppointmentsSection from "@/components/settings/account/ImportLocalAppointmentsSection";
import ImportLocalScheduleSection from "@/components/settings/account/ImportLocalScheduleSection";
import ImportLocalRecurringSection from "@/components/settings/account/ImportLocalRecurringSection";
import DemoDataSection from "@/components/settings/account/DemoDataSection";
import DataExportSection from "@/components/settings/account/DataExportSection";
import DangerZoneSection from "@/components/settings/account/DangerZoneSection";

export default async function AccountSettingsPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // STORY-039 — resolve via JWT app_metadata + tenant_members fallback.
  const jwtTenantId = (user.app_metadata as { tenant_id?: string } | undefined)
    ?.tenant_id;
  let activeTenantId = jwtTenantId ?? null;
  if (!activeTenantId) {
    const { data: membership } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    activeTenantId = membership?.tenant_id ?? null;
  }
  if (!activeTenantId) redirect("/login?error=tenant_missing");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (supabase as any)
    .from("tenants")
    .select(
      "id, name, vertical, city, personal_calendar_enabled, country, currency, " +
        "booking_slug, logo_url, business_address, contact_phone, contact_email, " +
        "contact_whatsapp, contact_telegram, contact_instagram",
    )
    .eq("id", activeTenantId)
    .maybeSingle();

  if (!tenant) redirect("/login?error=tenant_missing");

  return (
    <>
      <PageHeader title="Аккаунт" backHref="/dashboard/settings" />
      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-xl mx-auto px-4 py-4 space-y-5">
          <AccountSection
            email={user.email ?? ""}
            createdAt={user.created_at}
            userId={user.id}
          />
          <BusinessSection
            tenantId={tenant.id}
            initialName={tenant.name}
            initialVertical={tenant.vertical ?? "other"}
            initialCity={tenant.city ?? ""}
          />
          <PersonalCalendarSection
            initialEnabled={Boolean(tenant.personal_calendar_enabled)}
          />
          <RegionSection
            initialCountry={tenant.country ?? "CY"}
            initialCurrency={(tenant.currency ?? "EUR") as "EUR" | "USD" | "RUB" | "UAH" | "GBP"}
          />
          <BrandContactsSection
            initial={{
              booking_slug: tenant.booking_slug ?? null,
              logo_url: tenant.logo_url ?? null,
              business_address: tenant.business_address ?? null,
              contact_phone: tenant.contact_phone ?? null,
              contact_email: tenant.contact_email ?? null,
              contact_whatsapp: tenant.contact_whatsapp ?? null,
              contact_telegram: tenant.contact_telegram ?? null,
              contact_instagram: tenant.contact_instagram ?? null,
            }}
          />
          <SecuritySection />
          <ImportLocalAppointmentsSection />
          <ImportLocalScheduleSection />
          <ImportLocalRecurringSection />
          <DemoDataSection />
          <DataExportSection />
          <DangerZoneSection />
        </div>
      </div>
    </>
  );
}
