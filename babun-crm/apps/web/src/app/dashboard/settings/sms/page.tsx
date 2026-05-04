// STORY-047 G5 + STORY-069 — /dashboard/settings/sms.
//
// Owner-gated server shell. Resolves user + tenant_id + role from JWT
// app_metadata (with the tenant_members fallback shared across the
// dashboard), bounces non-owners, calls the tenant_sms_summary() RPC
// for the managed-SMS UI (sender state + balance + last 20 logs),
// then loads the tenant business name for {business_name} preview.
//
// STORY-069 wave 1: ManagedSmsPanel replaces the legacy BYOK form.
// Templates + reminder toggles still live below in the existing
// SmsConfigForm — kept in case the user has BYOK from a prior
// configuration. Both can coexist; managed mode is the new default
// and the panel above always renders first.

import { redirect } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { getSupabaseServer } from "@/lib/supabase/server";
import SmsConfigForm from "@/components/settings/sms/SmsConfigForm";
import type {
  SmsConfigInitial,
  SmsMessageRow,
} from "@/components/settings/sms/types";
import ManagedSmsPanel, {
  type ManagedSmsConfig,
  type ManagedSmsLog,
} from "@/components/settings/sms/ManagedSmsPanel";
import SmsHistoryTable from "@/components/settings/sms/SmsHistoryTable";

export default async function SmsSettingsPage() {
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

  // Owner gate.
  const { data: membershipRow } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", activeTenantId)
    .maybeSingle();
  if (!membershipRow || membershipRow.role !== "owner") {
    redirect("/dashboard/settings?error=sms_owner_only");
  }

  // STORY-069 — managed-mode summary (sender + balance + last 20 logs).
  // The RPC returns `{ config, logs }`. New tenants don't have a row
  // yet; we provide UI defaults so the panel renders without errors.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: summary } = await sb.rpc("tenant_sms_summary");

  type SummaryShape =
    | { config: ManagedSmsConfig | null; logs: ManagedSmsLog[] }
    | { error: string };
  const parsed = (summary as SummaryShape | null) ?? null;

  const managedConfig: ManagedSmsConfig =
    parsed && "config" in parsed && parsed.config
      ? parsed.config
      : {
          enabled: false,
          sender_name: null,
          sender_status: null,
          sender_rejection_reason: null,
          free_sms_remaining: 10,
          total_sent_count: 0,
          balance_cents: 0,
        };
  const managedLogs: ManagedSmsLog[] =
    parsed && "logs" in parsed ? parsed.logs : [];

  // Legacy BYOK + templates form. Falls back to defaults for new
  // tenants — shape preserved so STORY-047 form stays mountable.
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

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", activeTenantId)
    .maybeSingle();

  // Legacy history table (STORY-047) — kept as fallback while new
  // sms_logs table back-populates. Two history surfaces exist for
  // one cycle until the legacy table is deprecated.
  const { data: historyRows } = await sb
    .from("sms_messages")
    .select(
      "id, to_phone, message_body, status, error_code, error_message, trigger_type, mode, created_at, delivered_at",
    )
    .eq("tenant_id", activeTenantId)
    .order("created_at", { ascending: false })
    .limit(50);
  const legacyHistory = (historyRows ?? []) as SmsMessageRow[];

  return (
    <>
      <PageHeader title="Автоматические SMS" backHref="/dashboard/settings" />
      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-xl mx-auto px-4 py-4 space-y-5">
          {/* STORY-069 — Managed SMS panel. Free trial / balance /
              sender ID / top-up / new history. Always renders first. */}
          <ManagedSmsPanel config={managedConfig} logs={managedLogs} />

          {/* Templates + reminder toggles + legacy BYOK fallback.
              Will simplify in wave 3 when send_sms uses the managed
              sender exclusively. */}
          <SmsConfigForm businessName={tenant?.name ?? ""} initial={initial} />

          {legacyHistory.length > 0 && managedLogs.length === 0 && (
            <SmsHistoryTable rows={legacyHistory} />
          )}
        </div>
      </div>
    </>
  );
}
