// STORY-077 — Личная информация subpage.
//
// Aggregates everything an owner edits about their identity + brand:
//   * Аккаунт (email + регистрация + ID)
//   * Бизнес (имя + тип)
//   * Регион и валюта
//   * Бренд и контакты
//   * Личный календарь toggle
//   * Импорты из локального localStorage (только если есть что
//     импортировать — сами секции прячут себя в пустом состоянии).
//   * Дополнительно (экспорт данных GDPR, спрятан под раскрытие)

import { redirect } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { getSupabaseServer } from "@/lib/supabase/server";
import AccountSection from "@/components/settings/account/AccountSection";
import BusinessSection from "@/components/settings/account/BusinessSection";
import BrandContactsSection from "@/components/settings/account/BrandContactsSection";
import RegionSection from "@/components/settings/account/RegionSection";
import PersonalCalendarSection from "@/components/settings/account/PersonalCalendarSection";
import ImportLocalAppointmentsSection from "@/components/settings/account/ImportLocalAppointmentsSection";
import ImportLocalScheduleSection from "@/components/settings/account/ImportLocalScheduleSection";
import ImportLocalRecurringSection from "@/components/settings/account/ImportLocalRecurringSection";
import AdvancedSection from "@/components/settings/account/AdvancedSection";

export default async function PersonalInfoPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
      <PageHeader title="Личная информация" backHref="/dashboard/settings" />
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
          <PersonalCalendarSection
            initialEnabled={Boolean(tenant.personal_calendar_enabled)}
          />
          <ImportLocalAppointmentsSection />
          <ImportLocalScheduleSection />
          <ImportLocalRecurringSection />
          <AdvancedSection />
        </div>
      </div>
    </>
  );
}
