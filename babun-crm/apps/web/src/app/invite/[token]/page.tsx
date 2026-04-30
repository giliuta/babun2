// STORY-039 G3 — /invite/[token] accept landing.
//
// Server-resolves the invitation row by token (anon-readable when
// caller email matches, but we use service role here to give a
// useful error UX even before login). Three branches:
//   1. Logged out → redirect to /login?return=/invite/[token].
//   2. Logged in but email mismatch → 403 panel "пригласили другую почту".
//   3. Logged in + email match → call accept_invitation(token) RPC.
//      Success → redirect to /dashboard.
//
// Expired / already-accepted / not-found surface as the same error
// page with a tailored message.

import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseService } from "@/lib/supabase/service";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InviteAcceptPage({ params }: InvitePageProps) {
  const { token } = await params;

  // Service-role lookup so we can render a useful error even when the
  // invitee email doesn't match the signed-in user.
  const service = getSupabaseService();
  const { data: invite } = await service
    .from("invitations")
    .select("id, tenant_id, email, role, expires_at, accepted_at")
    .eq("token", token)
    .maybeSingle();

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?return=${encodeURIComponent(`/invite/${token}`)}`);
  }

  if (!invite) {
    return <InviteError title="Приглашение не найдено" body="Возможно ссылка скопирована не полностью или приглашение было удалено." />;
  }
  if (invite.accepted_at) {
    return <InviteError title="Приглашение уже принято" body="Эта ссылка уже использовалась. Откройте панель — вы уже в команде." />;
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return <InviteError title="Срок ссылки истёк" body="Приглашения действуют 7 дней. Попросите Owner выпустить новое." />;
  }

  const callerEmail = (user.email ?? "").toLowerCase();
  if (invite.email.toLowerCase() !== callerEmail) {
    return (
      <InviteError
        title="Ссылка для другой почты"
        body={`Приглашение отправлено на ${invite.email}. Войдите под этим адресом или попросите новое приглашение.`}
      />
    );
  }

  // All checks pass — call the RPC. This stamps accepted_at and
  // appends to available_tenants. Subsequent /dashboard access will
  // see the new tenant via the JWT (next refreshSession picks it up).
  const { error: rpcErr } = await supabase.rpc("accept_invitation", {
    p_token: token,
  });
  if (rpcErr) {
    return (
      <InviteError
        title="Не удалось принять приглашение"
        body={rpcErr.message}
      />
    );
  }

  // Switch active tenant to the just-joined one so dashboard renders
  // the new context immediately.
  await service.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...((user.app_metadata as Record<string, unknown> | undefined) ?? {}),
      tenant_id: invite.tenant_id,
    },
  });

  redirect("/dashboard");
}

function InviteError({ title, body }: { title: string; body: string }) {
  // Plain server-renderable header — /invite/[token] lives outside
  // the dashboard tree, so PageHeader (uses useSidebar) can't be used.
  return (
    <div className="min-h-[100dvh] bg-[var(--surface-grouped)] flex flex-col">
      <header className="h-12 flex items-center px-4 bg-[var(--surface-card)] border-b border-[var(--separator)]">
        <h1 className="text-[15px] font-semibold text-[var(--label)]">Приглашение</h1>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 py-8">
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-5 space-y-3">
            <h2 className="text-[18px] font-semibold text-[var(--label)]">{title}</h2>
            <p className="text-[14px] text-[var(--label-secondary)] leading-snug">{body}</p>
            <a
              href="/dashboard"
              className="block text-center mt-2 h-11 leading-[44px] rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] transition"
            >
              На главную
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
