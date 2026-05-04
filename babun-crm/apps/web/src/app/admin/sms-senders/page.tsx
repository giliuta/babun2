// STORY-070 — Sender approval queue. List of pending sender_name
// requests + Approve / Reject buttons per row.
//
// Workflow:
//   1. Tenant submits sender name → status='pending'
//   2. Admin opens this page, registers Alphanumeric Sender ID in
//      Twilio Console (manual ~1-5 min for Cyprus / EU)
//   3. Tap "Одобрить" here → status='approved', SMS now uses the
//      registered name as `from`
//   4. If Twilio rejects (rare, e.g. trademark) → tap "Отклонить",
//      enter reason → status='rejected', tenant sees the reason

import { getSupabaseServer } from "@/lib/supabase/server";
import SenderApprovalRow from "@/components/admin/SenderApprovalRow";

interface PendingSender {
  tenant_id: string;
  tenant_name: string;
  owner_email: string | null;
  sender_name: string;
  sender_status: "pending";
  sender_requested_at: string;
}

export default async function AdminSmsSendersPage() {
  const supabase = await getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).rpc("admin_pending_senders");
  const pending: PendingSender[] = Array.isArray(data) ? data : [];

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="px-6 py-5 border-b border-[var(--separator)] bg-[var(--surface-card)]">
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--label)]">
          Заявки на Sender ID
        </h1>
        <p className="text-[13px] text-[var(--label-secondary)] mt-1 leading-snug max-w-2xl">
          Тенанты просят зарегистрировать своё имя отправителя для SMS.
          Зарегистрируй его в Twilio Console (Messaging → Senders →
          Alpha Senders) и нажми «Одобрить». Если оператор отклонил —
          укажи причину при отклонении.
        </p>
      </header>

      <div className="p-6 max-w-3xl mx-auto space-y-4">
        {pending.length === 0 ? (
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-8 text-center">
            <div className="text-[16px] font-semibold text-[var(--label)] mb-1">
              Нет заявок
            </div>
            <p className="text-[13px] text-[var(--label-secondary)]">
              Отлично — все sender ID уже одобрены.
            </p>
          </div>
        ) : (
          <>
            <div className="text-[12px] text-[var(--label-tertiary)]">
              Pending: {pending.length}
            </div>
            <div className="space-y-3">
              {pending.map((p) => (
                <SenderApprovalRow
                  key={p.tenant_id}
                  tenantId={p.tenant_id}
                  tenantName={p.tenant_name}
                  ownerEmail={p.owner_email}
                  senderName={p.sender_name}
                  requestedAt={p.sender_requested_at}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
