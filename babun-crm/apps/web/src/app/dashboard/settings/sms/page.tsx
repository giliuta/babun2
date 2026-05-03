// STORY-047 G5 — /dashboard/settings/sms.
//
// Owner-gated server shell that:
//   1. Resolves user + tenant_id + role from JWT app_metadata
//      (with the tenant_members fallback shared across the dashboard).
//   2. Hard-redirects non-owners back to /dashboard/settings — the
//      DB-side RPC `read_tenant_sms_config_safe()` ALSO enforces
//      owner-only via a server-side raise, but bouncing here gives a
//      cleaner UX than a 401 toast.
//   3. Calls the safe RPC to load the config (token is replaced with
//      `twilio_auth_token_configured` boolean) and the latest 50
//      sms_messages rows for the history section.
//   4. Hands off to client sections for the form + history table.
//
// New tenants don't have a tenant_sms_config row until first save —
// the UI handles that gracefully (initial config below).

import { redirect } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { getSupabaseServer } from "@/lib/supabase/server";
import SmsConfigForm from "@/components/settings/sms/SmsConfigForm";
import SmsHistoryTable from "@/components/settings/sms/SmsHistoryTable";
import type { SmsConfigInitial, SmsMessageRow } from "@/components/settings/sms/types";

export default async function SmsSettingsPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Tenant resolution — same shape as /settings/account.
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

  // Role gate — only owners reach this surface.
  const { data: membershipRow } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", activeTenantId)
    .maybeSingle();
  if (!membershipRow || membershipRow.role !== "owner") {
    redirect("/dashboard/settings?error=sms_owner_only");
  }

  // Load config via the safe RPC (token shielded). Returns 0 rows
  // for new tenants who haven't saved yet — show the form pre-filled
  // with platform defaults.
  // Cast through `any` — generated DB types pre-date STORY-047
  // (regen scheduled as STORY-047b cleanup).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: configRows } = await sb.rpc("read_tenant_sms_config_safe");
  const initial: SmsConfigInitial = (configRows?.[0] as SmsConfigInitial) ?? {
    tenant_id: activeTenantId,
    mode: "platform",
    enabled: false,
    remind_24h_before: true,
    remind_2h_before: false,
    template_24h:
      "Здравствуйте, {client_name}! Напоминаем что у Вас завтра в {time} назначен визит. Если что-то изменилось — позвоните нам.",
    template_2h:
      "Здравствуйте, {client_name}! Через 2 часа у Вас назначен визит на {time}.",
    twilio_account_sid: null,
    twilio_phone_number: null,
    twilio_auth_token_configured: false,
    sent_this_month: 0,
    free_quota_per_month: 50,
    quota_period_start: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Tenant business name for the {business_name} preview placeholder.
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", activeTenantId)
    .maybeSingle();

  // History — latest 50 rows. RLS allows any authenticated user in the
  // tenant; no service role needed here.
  const { data: historyRows } = await sb
    .from("sms_messages")
    .select(
      "id, to_phone, message_body, status, error_code, error_message, trigger_type, mode, created_at, delivered_at",
    )
    .eq("tenant_id", activeTenantId)
    .order("created_at", { ascending: false })
    .limit(50);
  const history = (historyRows ?? []) as SmsMessageRow[];

  return (
    <>
      <PageHeader title="Автоматические SMS" backHref="/dashboard/settings" />
      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-xl mx-auto px-4 py-4 space-y-5">
          <SmsConfigForm
            businessName={tenant?.name ?? ""}
            initial={initial}
          />
          <SmsHistoryTable rows={history} />
        </div>
      </div>
    </>
  );
}
