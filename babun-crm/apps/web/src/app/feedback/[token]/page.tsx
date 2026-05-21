// Beta #52 (CRM Core brief) — public post-visit feedback page.
//
// URL is `/feedback/<token>` where token is the 192-bit one-shot the
// post-visit SMS dispatcher attached. The page calls the
// SECURITY DEFINER RPC `lookup_rating_token(p_token)` (migration
// _007) which is grantable to anon — no service-role required on the
// server. If the token doesn't exist, is used, or expired, the RPC
// returns no rows / row.used_at / row.expires_at accordingly and we
// render the appropriate state.
//
// Submission goes through `/api/feedback/submit` which calls the
// `submit_rating(p_token, p_stars, p_comment)` RPC — the same
// migration provides the atomic insert + token-consume path.

import { notFound } from "next/navigation";
import { getSupabaseAnonServer } from "@/lib/supabase/anon-server";
import FeedbackForm from "@/components/feedback/FeedbackForm";

interface PageProps {
  params: Promise<{ token: string }>;
}

// v691 / Audit-2026-05-21 P3-15 — was producing «Оцените визит · Babun · Babun»
// via the root layout's «%s · Babun» template. Use `absolute` to suppress.
export const metadata = {
  title: { absolute: "Оцените визит · Babun" },
};

interface TokenLookup {
  token: string;
  tenant_id: string;
  master_id: string;
  appointment_id: string | null;
  used_at: string | null;
  expires_at: string;
  brand_name: string | null;
}

async function loadToken(token: string): Promise<TokenLookup | null> {
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(token)) return null;
  const sb = getSupabaseAnonServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).rpc("lookup_rating_token", {
    p_token: token,
  });
  if (error) return null;
  // RPC returns table → array; pick first row.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return row as TokenLookup;
}

export default async function FeedbackPage(props: PageProps) {
  const { token } = await props.params;
  const row = await loadToken(token);
  if (!row) notFound();

  // Date.now() is impure but this is a server component — renders
  // once per request, no re-render unpredictability concerns.
  // eslint-disable-next-line react-hooks/purity
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
            Поставьте оценку мастеру
            {row.brand_name ? (
              <>
                {" · "}
                <span className="font-semibold text-[var(--label)]">
                  {row.brand_name}
                </span>
              </>
            ) : null}
            .
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
