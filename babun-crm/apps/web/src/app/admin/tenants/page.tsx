// STORY-070 — /admin/tenants list. Server component reads via the
// admin_tenants_list RPC; client-side search via querystring round-trip.
// Plan filter as toggle chips.

import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";

interface TenantRow {
  id: string;
  name: string;
  plan: string;
  plan_override: string | null;
  created_at: string;
  owner_email: string | null;
  sender_name: string | null;
  sender_status: string | null;
  balance_cents: number | null;
  free_sms_remaining: number | null;
  total_sent_count: number | null;
  appointment_count: number;
  client_count: number;
}

const PLAN_FILTERS = [
  { id: "", label: "Все" },
  { id: "free", label: "Free" },
  { id: "pro", label: "Pro" },
  { id: "business", label: "Business" },
  { id: "lifetime", label: "Lifetime" },
];

export default async function AdminTenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; plan?: string }>;
}) {
  const sp = await searchParams;
  const search = (sp.q ?? "").trim();
  const planFilter = sp.plan ?? "";

  const supabase = await getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).rpc("admin_tenants_list", {
    p_search: search || null,
    p_plan_filter: planFilter || null,
    p_limit: 100,
    p_offset: 0,
  });
  const rows: TenantRow[] = Array.isArray(data) ? data : [];

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="px-6 py-5 border-b border-[var(--separator)] bg-[var(--surface-card)]">
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--label)]">
          Тенанты
        </h1>
        <p className="text-[13px] text-[var(--label-secondary)] mt-1">
          Все компании, зарегистрированные в Babun.
        </p>
      </header>

      <div className="p-6 max-w-5xl mx-auto space-y-4">
        {/* Search + plan filter */}
        <form className="flex flex-wrap gap-2" method="get">
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Поиск по названию или email владельца"
            className="flex-1 min-w-[220px] h-10 px-3 text-[14px] bg-[var(--surface-card)] border border-[var(--separator)] rounded-[10px] focus:outline-none focus:border-[var(--accent)]"
          />
          {/* Pass plan filter through so search keeps it */}
          <input type="hidden" name="plan" value={planFilter} />
          <button
            type="submit"
            className="h-10 px-4 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[14px] font-semibold active:bg-[var(--accent-pressed)]"
          >
            Найти
          </button>
        </form>

        <div className="flex flex-wrap gap-1.5">
          {PLAN_FILTERS.map((f) => {
            const active = (planFilter || "") === f.id;
            const params = new URLSearchParams();
            if (search) params.set("q", search);
            if (f.id) params.set("plan", f.id);
            const href =
              params.toString().length > 0
                ? `/admin/tenants?${params}`
                : "/admin/tenants";
            return (
              <Link
                key={f.id || "all"}
                href={href}
                className={`h-8 px-3 rounded-full text-[13px] font-medium inline-flex items-center transition ${
                  active
                    ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                    : "bg-[var(--surface-card)] border border-[var(--separator)] text-[var(--label)] active:bg-[var(--fill-quaternary)]"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        {/* Result count */}
        <div className="text-[12px] text-[var(--label-tertiary)]">
          Найдено: {rows.length}
        </div>

        {/* Table */}
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
          <div className="hidden lg:grid grid-cols-[1fr_140px_120px_120px_140px] gap-3 px-4 py-2 border-b border-[var(--separator)] bg-[var(--surface-card-secondary)] text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
            <div>Тенант</div>
            <div>Тариф</div>
            <div className="text-right">Клиентов</div>
            <div className="text-right">Записей</div>
            <div>Sender</div>
          </div>

          {rows.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-[var(--label-tertiary)]">
              Ничего не найдено.
            </div>
          ) : (
            <div className="divide-y divide-[var(--separator)]">
              {rows.map((row) => (
                <TenantListRow key={row.id} row={row} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TenantListRow({ row }: { row: TenantRow }) {
  const effectivePlan = row.plan_override ?? row.plan ?? "free";
  return (
    <Link
      href={`/admin/tenants/${row.id}`}
      className="grid grid-cols-1 lg:grid-cols-[1fr_140px_120px_120px_140px] gap-3 px-4 py-3 active:bg-[var(--fill-quaternary)] transition"
    >
      <div className="min-w-0">
        <div className="text-[14px] font-semibold text-[var(--label)] truncate">
          {row.name || "Без названия"}
        </div>
        <div className="text-[12px] text-[var(--label-secondary)] truncate">
          {row.owner_email ?? "—"}
        </div>
      </div>
      <div>
        <PlanBadge plan={effectivePlan} override={row.plan_override !== null} />
      </div>
      <div className="text-[13px] text-[var(--label-secondary)] tabular-nums lg:text-right">
        <span className="lg:hidden text-[var(--label-tertiary)]">Клиентов: </span>
        {row.client_count}
      </div>
      <div className="text-[13px] text-[var(--label-secondary)] tabular-nums lg:text-right">
        <span className="lg:hidden text-[var(--label-tertiary)]">Записей: </span>
        {row.appointment_count}
      </div>
      <div className="text-[12px] text-[var(--label-secondary)] truncate">
        {row.sender_name ? (
          <>
            «{row.sender_name}»{" "}
            <SenderStatusDot status={row.sender_status} />
          </>
        ) : (
          <span className="text-[var(--label-tertiary)]">—</span>
        )}
      </div>
    </Link>
  );
}

function PlanBadge({
  plan,
  override,
}: {
  plan: string;
  override: boolean;
}) {
  const label = plan.toUpperCase();
  const cls =
    plan === "lifetime"
      ? "bg-[rgba(175,82,222,0.14)] text-[#AF52DE]"
      : plan === "business"
        ? "bg-[rgba(0,122,255,0.14)] text-[var(--system-blue)]"
        : plan === "pro"
          ? "bg-[var(--accent-tint)] text-[var(--accent)]"
          : "bg-[var(--fill-tertiary)] text-[var(--label-secondary)]";
  return (
    <span
      className={`inline-flex items-center px-2 h-6 rounded-full text-[11px] font-bold tracking-wide ${cls}`}
    >
      {label}
      {override && <span className="ml-1 opacity-60">·O</span>}
    </span>
  );
}

function SenderStatusDot({ status }: { status: string | null }) {
  if (!status) return null;
  const dotCls =
    status === "approved"
      ? "bg-[var(--system-green)]"
      : status === "pending"
        ? "bg-[var(--system-orange)]"
        : "bg-[var(--system-red)]";
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotCls}`} aria-label={status} />;
}
