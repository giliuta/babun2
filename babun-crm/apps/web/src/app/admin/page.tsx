// STORY-070 — Admin landing. Five tiles + quick links to deep pages.
// Single round-trip via admin_dashboard_summary() RPC.

import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";

interface DashboardSummary {
  total_tenants: number;
  paid_tenants: number;
  pending_senders: number;
  sms_today: number;
  topups_total_eur: number;
}

export default async function AdminDashboardPage() {
  const supabase = await getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).rpc("admin_dashboard_summary");
  const summary: DashboardSummary | null =
    data && !("error" in data) ? data : null;

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="px-6 py-5 border-b border-[var(--separator)] bg-[var(--surface-card)]">
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--label)]">
          Обзор платформы
        </h1>
        <p className="text-[13px] text-[var(--label-secondary)] mt-1">
          Состояние Babun одной картиной — клиенты, платежи, SMS.
        </p>
      </header>

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {!summary ? (
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-6 text-center text-[14px] text-[var(--label-secondary)]">
            Не удалось загрузить статистику. Проверь, что миграция
            <code className="px-1 mx-1 bg-[var(--fill-tertiary)] rounded">20260504_002_platform_admin.sql</code>
            применена.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Tile
                label="Всего тенантов"
                value={summary.total_tenants}
                href="/admin/tenants"
              />
              <Tile
                label="Платящих"
                value={summary.paid_tenants}
                href="/admin/tenants?plan=pro"
                tone="green"
              />
              <Tile
                label="Заявок на Sender ID"
                value={summary.pending_senders}
                href="/admin/sms-senders"
                tone={summary.pending_senders > 0 ? "orange" : "neutral"}
                emphasize={summary.pending_senders > 0}
              />
              <Tile
                label="SMS сегодня"
                value={summary.sms_today}
                href="/admin/billing"
              />
            </div>

            <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-5">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-2">
                Заработано на пополнениях SMS
              </div>
              <div className="text-[28px] font-semibold text-[var(--label)] tabular-nums">
                €{summary.topups_total_eur.toFixed(2)}
              </div>
              <p className="text-[12px] text-[var(--label-tertiary)] mt-1">
                За всё время. Состоит из платежей через Stripe Checkout. Подписки на Pro/Business сюда не входят — они в разделе «Платежи».
              </p>
            </div>

            <div>
              <h2 className="text-[14px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-3">
                Быстрые ссылки
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <QuickLink
                  href="/admin/tenants"
                  title="Все тенанты"
                  description="Поиск, фильтр по тарифу, ручной override плана"
                />
                <QuickLink
                  href="/admin/sms-senders"
                  title="Sender-заявки"
                  description="Approve/reject имён отправителей"
                />
                <QuickLink
                  href="/admin/billing"
                  title="Платежи и пополнения"
                  description="Stripe-события + история top-up'ов"
                />
                <QuickLink
                  href="/admin/stats"
                  title="Статистика"
                  description="Регистрации, MRR, отправки SMS по дням"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  href,
  tone = "neutral",
  emphasize = false,
}: {
  label: string;
  value: number;
  href: string;
  tone?: "neutral" | "green" | "orange";
  emphasize?: boolean;
}) {
  const ringCls =
    tone === "green"
      ? "ring-[rgba(52,199,89,0.5)]"
      : tone === "orange"
        ? "ring-[rgba(255,149,0,0.5)]"
        : "ring-transparent";
  const valueCls =
    tone === "orange"
      ? "text-[var(--system-orange)]"
      : tone === "green"
        ? "text-[var(--system-green)]"
        : "text-[var(--label)]";
  return (
    <Link
      href={href}
      className={`bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 active:bg-[var(--fill-quaternary)] transition ${
        emphasize ? "ring-2 " + ringCls : ""
      }`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] truncate">
        {label}
      </div>
      <div className={`text-[28px] font-semibold tracking-tight tabular-nums mt-1 ${valueCls}`}>
        {value}
      </div>
    </Link>
  );
}

function QuickLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 active:bg-[var(--fill-quaternary)] transition"
    >
      <div className="text-[15px] font-semibold text-[var(--label)] tracking-tight">
        {title} →
      </div>
      <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 leading-snug">
        {description}
      </div>
    </Link>
  );
}
