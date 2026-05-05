// STORY-070 wave 2 — /admin/billing
//
// Shows a paginated platform-wide feed of:
//   * SMS topups (sms_topups) — each tenant's prepaid balance refills
//   * Stripe billing events (billing_events) — subscription transitions
//
// Both come from a single admin_billing_history(p_limit, p_offset) RPC.
// Owner-gated by the layout's is_platform_admin check + the RPC's own
// guard.

import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";

interface TopupRow {
  id: string;
  tenant_id: string | null;
  tenant_name: string | null;
  amount_cents: number;
  credits_added: number;
  pack_label: string;
  status: string;
  stripe_payment_intent_id: string | null;
  created_at: string;
  completed_at: string | null;
}

interface EventRow {
  id: string;
  tenant_id: string | null;
  tenant_name: string | null;
  event_type: string;
  stripe_event_id: string | null;
  created_at: string;
}

interface History {
  topups?: TopupRow[];
  events?: EventRow[];
  error?: string;
}

const PAGE_SIZE = 50;

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>;
}) {
  const params = await searchParams;
  const offset = Math.max(0, parseInt(params.offset ?? "0", 10) || 0);

  const supabase = await getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).rpc("admin_billing_history", {
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });
  const h = (data as History | null) ?? {};
  const topups = h.topups ?? [];
  const events = h.events ?? [];

  const totalEur = topups
    .filter((t) => t.status === "completed")
    .reduce((s, t) => s + t.amount_cents, 0) / 100;

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="px-6 py-5 border-b border-[var(--separator)] bg-[var(--surface-card)]">
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--label)]">
          Платежи и пополнения
        </h1>
        <p className="text-[13px] text-[var(--label-secondary)] mt-1">
          Stripe-события и пополнения SMS-баланса по всем тенантам.
        </p>
      </header>

      <div className="p-6 max-w-4xl mx-auto space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <Tile label="Пополнений (стр.)" value={topups.length} />
          <Tile label="Stripe-событий (стр.)" value={events.length} />
          <Tile label={`Сумма стр. (€)`} value={totalEur.toFixed(2)} />
        </div>

        <section className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
          <div className="px-5 pt-4 pb-2 flex items-baseline justify-between">
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
              SMS-пополнения
            </h2>
            <span className="text-[11px] text-[var(--label-tertiary)] tabular-nums">
              {topups.length} записей
            </span>
          </div>
          {topups.length === 0 ? (
            <div className="px-5 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
              Пока нет пополнений.
            </div>
          ) : (
            <div className="divide-y divide-[var(--separator)]">
              {topups.map((t) => (
                <Link
                  key={t.id}
                  href={t.tenant_id ? `/admin/tenants/${t.tenant_id}` : "#"}
                  className="block px-5 py-3 active:bg-[var(--fill-quaternary)] transition"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-medium text-[var(--label)] truncate">
                      {t.tenant_name ?? "—"}
                    </span>
                    <span className="text-[13px] font-semibold tabular-nums">
                      €{(t.amount_cents / 100).toFixed(2)} → {t.credits_added}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--label-tertiary)] mt-0.5 flex items-center gap-2">
                    <span
                      className={`text-[10px] uppercase font-bold ${
                        t.status === "completed"
                          ? "text-[var(--system-green)]"
                          : t.status === "failed"
                            ? "text-[var(--system-red)]"
                            : "text-[var(--label-tertiary)]"
                      }`}
                    >
                      {t.status}
                    </span>
                    <span>·</span>
                    <span>{t.pack_label}</span>
                    <span>·</span>
                    <span className="tabular-nums">
                      {new Date(t.created_at).toLocaleString("ru-RU")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
          <div className="px-5 pt-4 pb-2 flex items-baseline justify-between">
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
              Stripe-события
            </h2>
            <span className="text-[11px] text-[var(--label-tertiary)] tabular-nums">
              {events.length} записей
            </span>
          </div>
          {events.length === 0 ? (
            <div className="px-5 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
              Пока нет событий.
            </div>
          ) : (
            <div className="divide-y divide-[var(--separator)]">
              {events.map((e) => (
                <Link
                  key={e.id}
                  href={e.tenant_id ? `/admin/tenants/${e.tenant_id}` : "#"}
                  className="block px-5 py-3 active:bg-[var(--fill-quaternary)] transition"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-medium text-[var(--label)] truncate">
                      {e.tenant_name ?? "—"}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-[var(--accent)] tracking-wider">
                      {e.event_type}
                    </span>
                  </div>
                  <div className="text-[10px] text-[var(--label-tertiary)] font-mono mt-0.5 break-all">
                    {e.stripe_event_id} ·{" "}
                    {new Date(e.created_at).toLocaleString("ru-RU")}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="flex items-center justify-between">
          <Link
            href={`/admin/billing?offset=${Math.max(0, offset - PAGE_SIZE)}`}
            aria-disabled={offset === 0}
            className={`text-[13px] ${
              offset === 0
                ? "text-[var(--label-tertiary)] pointer-events-none"
                : "text-[var(--accent)] active:opacity-70"
            }`}
          >
            ← Назад
          </Link>
          <span className="text-[12px] text-[var(--label-tertiary)] tabular-nums">
            {offset + 1}–{offset + Math.max(topups.length, events.length)}
          </span>
          <Link
            href={`/admin/billing?offset=${offset + PAGE_SIZE}`}
            aria-disabled={topups.length < PAGE_SIZE && events.length < PAGE_SIZE}
            className={`text-[13px] ${
              topups.length < PAGE_SIZE && events.length < PAGE_SIZE
                ? "text-[var(--label-tertiary)] pointer-events-none"
                : "text-[var(--accent)] active:opacity-70"
            }`}
          >
            Вперёд →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] truncate">
        {label}
      </div>
      <div className="text-[24px] font-semibold tabular-nums tracking-tight mt-1 text-[var(--label)]">
        {value}
      </div>
    </div>
  );
}
