// STORY-070 — Tenant detail. One round-trip via admin_tenant_detail.
// Three column-stacked sections: Tenant info + plan, SMS state +
// balance grant, recent SMS / topups / billing events.

import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import TenantPlanForm from "@/components/admin/TenantPlanForm";
import GrantBalanceForm from "@/components/admin/GrantBalanceForm";
import ImpersonateButton from "@/components/admin/ImpersonateButton";

interface DetailResponse {
  tenant?: {
    id: string;
    name: string;
    vertical: string | null;
    city: string | null;
    plan: string;
    plan_override: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    subscription_status: string | null;
    current_period_end: string | null;
    created_at: string;
  };
  owner_email?: string | null;
  sms?: {
    sender_name: string | null;
    sender_status: string | null;
    sender_requested_at: string | null;
    sender_approved_at: string | null;
    sender_rejection_reason: string | null;
    balance_cents: number | null;
    free_sms_remaining: number | null;
    total_sent_count: number | null;
    enabled: boolean;
  } | null;
  recent_logs?: Array<{
    id: string;
    to_phone: string;
    body: string;
    sender_name_used: string;
    cost_cents: number;
    was_free: boolean;
    twilio_status: string | null;
    error_message: string | null;
    created_at: string;
  }>;
  topups?: Array<{
    id: string;
    amount_cents: number;
    credits_added: number;
    pack_label: string;
    status: string;
    created_at: string;
    completed_at: string | null;
  }>;
  billing_events?: Array<{
    id: string;
    event_type: string;
    stripe_event_id: string | null;
    created_at: string;
  }>;
  error?: string;
}

export default async function AdminTenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).rpc("admin_tenant_detail", {
    p_tenant_id: id,
  });
  const detail = (data as DetailResponse | null) ?? {};
  const t = detail.tenant;

  if (!t) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Link
          href="/admin/tenants"
          className="text-[13px] text-[var(--accent)] active:opacity-70"
        >
          ← К списку тенантов
        </Link>
        <div className="mt-4 bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-6 text-center">
          <div className="text-[16px] font-semibold text-[var(--label)]">
            Тенант не найден
          </div>
        </div>
      </div>
    );
  }

  const effectivePlan = t.plan_override ?? t.plan ?? "free";
  const sms = detail.sms ?? null;
  const logs = detail.recent_logs ?? [];
  const topups = detail.topups ?? [];
  const billing = detail.billing_events ?? [];

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="px-6 py-4 border-b border-[var(--separator)] bg-[var(--surface-card)] sticky top-0 z-10">
        <Link
          href="/admin/tenants"
          className="text-[12px] text-[var(--accent)] active:opacity-70"
        >
          ← К списку тенантов
        </Link>
        <h1 className="text-[20px] font-semibold tracking-tight text-[var(--label)] mt-1">
          {t.name || "Без названия"}
        </h1>
        <p className="text-[13px] text-[var(--label-secondary)] mt-0.5">
          {detail.owner_email ?? "—"}
          {t.city && ` · ${t.city}`}
          {t.vertical && ` · ${t.vertical}`}
        </p>
      </header>

      <div className="p-6 max-w-3xl mx-auto space-y-5">
        {/* Plan & Subscription */}
        <section className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-5 space-y-4">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
              Тариф
            </h2>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-1.5 h-5 inline-flex items-center rounded-full ${
                effectivePlan === "lifetime"
                  ? "bg-[rgba(175,82,222,0.14)] text-[#AF52DE]"
                  : effectivePlan === "business"
                    ? "bg-[rgba(0,122,255,0.14)] text-[var(--system-blue)]"
                    : effectivePlan === "pro"
                      ? "bg-[var(--accent-tint)] text-[var(--accent)]"
                      : "bg-[var(--fill-tertiary)] text-[var(--label-secondary)]"
              }`}
            >
              {effectivePlan}
            </span>
          </div>
          <dl className="text-[12px] text-[var(--label-secondary)] space-y-1">
            <Row label="Stripe план">{t.plan ?? "—"}</Row>
            <Row label="Override">{t.plan_override ?? "не задан"}</Row>
            <Row label="Subscription status">{t.subscription_status ?? "—"}</Row>
            <Row label="Subscription ID">
              <span className="font-mono text-[11px] break-all">
                {t.stripe_subscription_id ?? "—"}
              </span>
            </Row>
            <Row label="Customer ID">
              <span className="font-mono text-[11px] break-all">
                {t.stripe_customer_id ?? "—"}
              </span>
            </Row>
            <Row label="Текущий период до">
              {t.current_period_end
                ? new Date(t.current_period_end).toLocaleDateString("ru-RU")
                : "—"}
            </Row>
            <Row label="Создан">
              {new Date(t.created_at).toLocaleDateString("ru-RU")}
            </Row>
          </dl>

          <TenantPlanForm
            tenantId={t.id}
            current={t.plan_override}
          />

          <div className="pt-3 border-t border-[var(--separator)]">
            <ImpersonateButton tenantId={t.id} tenantName={t.name || "—"} />
          </div>
        </section>

        {/* SMS state */}
        <section className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-5 space-y-4">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
            SMS
          </h2>
          {sms === null ? (
            <p className="text-[13px] text-[var(--label-tertiary)]">
              Тенант ни разу не открывал настройки SMS.
            </p>
          ) : (
            <>
              <dl className="text-[12px] text-[var(--label-secondary)] space-y-1">
                <Row label="Sender">
                  {sms.sender_name ? (
                    <>
                      «{sms.sender_name}»{" "}
                      <span className="text-[10px] uppercase font-bold">
                        {sms.sender_status ?? "—"}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </Row>
                <Row label="Запросил">
                  {sms.sender_requested_at
                    ? new Date(sms.sender_requested_at).toLocaleString("ru-RU")
                    : "—"}
                </Row>
                <Row label="Одобрен">
                  {sms.sender_approved_at
                    ? new Date(sms.sender_approved_at).toLocaleString("ru-RU")
                    : "—"}
                </Row>
                {sms.sender_rejection_reason && (
                  <Row label="Причина отказа">
                    {sms.sender_rejection_reason}
                  </Row>
                )}
                <Row label="Баланс (cents)">
                  <span className="tabular-nums">
                    {sms.balance_cents ?? 0} ≈ €
                    {((sms.balance_cents ?? 0) / 100).toFixed(2)}
                  </span>
                </Row>
                <Row label="Free SMS осталось">
                  <span className="tabular-nums">
                    {sms.free_sms_remaining ?? 0}
                  </span>
                </Row>
                <Row label="Всего отправлено">
                  <span className="tabular-nums">
                    {sms.total_sent_count ?? 0}
                  </span>
                </Row>
                <Row label="Включены SMS">{sms.enabled ? "да" : "нет"}</Row>
              </dl>
              <GrantBalanceForm tenantId={t.id} />
            </>
          )}
        </section>

        {/* Recent SMS logs */}
        {logs.length > 0 && (
          <section className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
            <div className="px-5 pt-4 pb-2">
              <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
                Последние SMS
              </h2>
            </div>
            <div className="divide-y divide-[var(--separator)]">
              {logs.map((l) => (
                <div key={l.id} className="px-5 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12px] font-semibold text-[var(--label)] tabular-nums">
                      {l.to_phone}
                    </span>
                    <span className="text-[10px] text-[var(--label-tertiary)] tabular-nums">
                      {new Date(l.created_at).toLocaleString("ru-RU")}
                    </span>
                  </div>
                  <div className="text-[12px] text-[var(--label-secondary)] mt-1 line-clamp-2 leading-snug">
                    {l.body}
                  </div>
                  <div className="text-[11px] text-[var(--label-tertiary)] mt-0.5">
                    «{l.sender_name_used}» ·{" "}
                    {l.was_free
                      ? "free"
                      : `€${(l.cost_cents / 100).toFixed(2)}`}{" "}
                    · {l.twilio_status ?? "queued"}
                    {l.error_message && (
                      <span className="text-[var(--system-red)] ml-1">
                        · {l.error_message}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Topups */}
        {topups.length > 0 && (
          <section className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
            <div className="px-5 pt-4 pb-2">
              <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
                Пополнения SMS
              </h2>
            </div>
            <div className="divide-y divide-[var(--separator)]">
              {topups.map((tp) => (
                <div key={tp.id} className="px-5 py-3 flex items-baseline justify-between gap-2">
                  <div>
                    <div className="text-[13px] font-medium text-[var(--label)]">
                      {tp.pack_label}
                    </div>
                    <div className="text-[11px] text-[var(--label-tertiary)]">
                      {new Date(tp.created_at).toLocaleString("ru-RU")} ·{" "}
                      {tp.status}
                    </div>
                  </div>
                  <div className="text-[13px] font-semibold tabular-nums">
                    €{(tp.amount_cents / 100).toFixed(2)} → {tp.credits_added}{" "}
                    SMS
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Billing events */}
        {billing.length > 0 && (
          <section className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
            <div className="px-5 pt-4 pb-2">
              <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
                Stripe-события
              </h2>
            </div>
            <div className="divide-y divide-[var(--separator)]">
              {billing.map((b) => (
                <div key={b.id} className="px-5 py-2.5">
                  <div className="text-[12px] font-medium text-[var(--label)]">
                    {b.event_type}
                  </div>
                  <div className="text-[10px] text-[var(--label-tertiary)] font-mono break-all">
                    {b.stripe_event_id} ·{" "}
                    {new Date(b.created_at).toLocaleString("ru-RU")}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-[140px] flex-shrink-0 text-[var(--label-tertiary)]">
        {label}
      </dt>
      <dd className="flex-1 text-[var(--label)]">{children}</dd>
    </div>
  );
}
