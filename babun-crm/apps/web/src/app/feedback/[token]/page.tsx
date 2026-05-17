// Beta #52 (CRM Core brief) — public post-visit feedback page.
//
// URL is `/feedback/<token>` where token is the 192-bit one-shot the
// post-visit SMS dispatcher attached. We:
//   1. Look up the token row (service-role bypasses RLS for the slug
//      check — the only field we surface is the master name).
//   2. If unused + not expired → render the rating form.
//   3. If used or expired → render a polite «уже принято» card.
//
// Submission goes through `/api/feedback/submit` which inserts a
// `master_ratings` row carrying the token. The RLS policy from
// migration 20260517_004 only accepts inserts when the token row
// exists, is unused, not expired, and matches tenant_id + master_id.
// The trigger consumes the token on success.

import { notFound } from "next/navigation";
import { getSupabaseService } from "@/lib/supabase/service";
import FeedbackForm from "@/components/feedback/FeedbackForm";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const metadata = {
  title: "Оцените визит · Babun",
};

interface TokenLookup {
  token: string;
  tenant_id: string;
  master_id: string;
  appointment_id: string | null;
  used_at: string | null;
  expires_at: string;
  master_name: string;
  brand_name: string | null;
}

async function loadToken(token: string): Promise<TokenLookup | null> {
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(token)) return null;
  const sb = getSupabaseService();
  // Pull the token row + denormalised master name + tenant brand
  // in a single round-trip. The master_ratings_tokens RLS lets
  // service role read.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from("master_rating_tokens")
    .select(
      "token, tenant_id, master_id, appointment_id, used_at, expires_at",
    )
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;

  // Display-friendly name lookups (best-effort — names aren't critical
  // for the form to function; rating row will save fine with id only).
  let masterName = "мастера";
  let brandName: string | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mRow } = await (sb as any)
      .from("masters")
      .select("full_name")
      .eq("id", data.master_id)
      .maybeSingle();
    if (mRow?.full_name) masterName = mRow.full_name;
  } catch {
    // ignore — masters table may live in localStorage for some tenants
  }
  try {
    const { data: tRow } = await sb
      .from("tenants")
      .select("name")
      .eq("id", data.tenant_id)
      .maybeSingle();
    if (tRow?.name) brandName = tRow.name;
  } catch {
    // ignore
  }

  return {
    ...data,
    master_name: masterName,
    brand_name: brandName,
  } as TokenLookup;
}

export default async function FeedbackPage(props: PageProps) {
  const { token } = await props.params;
  const row = await loadToken(token);
  if (!row) notFound();

  const expired = new Date(row.expires_at).getTime() <= Date.now();
  const used = row.used_at !== null;

  if (used || expired) {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center bg-[var(--surface-grouped)] px-6 text-center"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 12px)",
          paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
        }}
      >
        <div className="w-14 h-14 rounded-[18px] bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center text-[26px] mb-6">
          ★
        </div>
        <h1 className="text-[22px] font-bold text-[var(--label)]">
          {used ? "Спасибо за оценку!" : "Ссылка устарела"}
        </h1>
        <p className="mt-2 text-[15px] text-[var(--label-secondary)] max-w-xs leading-snug">
          {used
            ? "Мы уже получили ваш отзыв. Ещё одна оценка по этой ссылке не нужна."
            : "Ссылка действительна 60 дней с момента отправки. Если хотите оставить отзыв — попросите у команды свежую."}
        </p>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center bg-[var(--surface-grouped)] px-4"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 24px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
      }}
    >
      <div className="w-full max-w-md">
        <header className="text-center mb-6">
          <div className="w-14 h-14 rounded-[18px] bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center text-[26px] mx-auto mb-3">
            ★
          </div>
          <h1 className="text-[22px] font-bold text-[var(--label)] leading-snug">
            Как прошёл визит?
          </h1>
          <p className="mt-1 text-[15px] text-[var(--label-secondary)] leading-snug">
            Поставьте оценку мастеру{" "}
            <span className="font-semibold text-[var(--label)]">
              {row.master_name}
            </span>
            {row.brand_name ? <> · {row.brand_name}</> : null}.
          </p>
        </header>

        <FeedbackForm
          token={row.token}
          tenantId={row.tenant_id}
          masterId={row.master_id}
          appointmentId={row.appointment_id}
        />

        <p className="mt-6 text-[11px] text-[var(--label-tertiary)] text-center leading-snug">
          Оценка анонимна для других клиентов. Команда увидит звёзды
          и комментарий — это поможет сделать сервис лучше.
        </p>
      </div>
    </main>
  );
}
