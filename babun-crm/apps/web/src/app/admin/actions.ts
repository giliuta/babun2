"use server";

// STORY-070 — server actions for the admin surface.
//
// All actions assert is_platform_admin() server-side via the helper
// SQL function. The service-role client bypasses RLS for the writes
// since admin work crosses tenant boundaries.

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseService } from "@/lib/supabase/service";

type ActionResult = { ok: true } | { ok: false; error: string };

async function assertAdmin(): Promise<{ userId: string } | null> {
  const sb = await getSupabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdmin } = await (sb as any).rpc("is_platform_admin");
  if (!isAdmin) return null;
  return { userId: user.id };
}

// ── Plan override ────────────────────────────────────────────────
export async function setTenantPlanOverride(
  tenantId: string,
  override: "free" | "pro" | "business" | "lifetime" | null,
): Promise<ActionResult> {
  const auth = await assertAdmin();
  if (!auth) return { ok: false, error: "Доступ только для администратора" };

  const svc = getSupabaseService();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from("tenants")
    .update({ plan_override: override })
    .eq("id", tenantId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin/tenants");
  revalidatePath("/admin");
  return { ok: true };
}

// ── Sender approval ──────────────────────────────────────────────
export async function approveSender(
  tenantId: string,
): Promise<ActionResult> {
  const auth = await assertAdmin();
  if (!auth) return { ok: false, error: "Доступ только для администратора" };

  const svc = getSupabaseService();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from("tenant_sms_config")
    .update({
      sender_status: "approved",
      sender_approved_at: new Date().toISOString(),
      sender_rejection_reason: null,
    })
    .eq("tenant_id", tenantId)
    .eq("sender_status", "pending");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/sms-senders");
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin");
  return { ok: true };
}

export async function rejectSender(
  tenantId: string,
  reason: string,
): Promise<ActionResult> {
  const auth = await assertAdmin();
  if (!auth) return { ok: false, error: "Доступ только для администратора" };

  const trimmed = reason.trim().slice(0, 200);
  if (trimmed.length === 0) {
    return { ok: false, error: "Укажи причину отклонения" };
  }

  const svc = getSupabaseService();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from("tenant_sms_config")
    .update({
      sender_status: "rejected",
      sender_rejection_reason: trimmed,
    })
    .eq("tenant_id", tenantId)
    .eq("sender_status", "pending");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/sms-senders");
  revalidatePath(`/admin/tenants/${tenantId}`);
  return { ok: true };
}

// ── Manual SMS balance grant ─────────────────────────────────────
//
// One-click "+100 SMS" button on the tenant detail. Useful for
// support requests or comp'ing a screwed-up message. Records the
// reason in sms_topups so audit trail is intact.
export async function grantSmsBalance(
  tenantId: string,
  credits: number,
  reason: string,
): Promise<ActionResult> {
  const auth = await assertAdmin();
  if (!auth) return { ok: false, error: "Доступ только для администратора" };
  if (!Number.isInteger(credits) || credits <= 0 || credits > 10000) {
    return { ok: false, error: "Кол-во SMS должно быть 1–10000" };
  }
  const trimmed = reason.trim().slice(0, 140);
  if (trimmed.length === 0) {
    return { ok: false, error: "Укажи причину начисления" };
  }

  const svc = getSupabaseService();

  // Read current balance + free counter so we can decide where the
  // credits land. For ops grants the right behaviour is: bump
  // balance_cents by (credits * PER_SMS_COST_CENTS) so the user can
  // burn them at the normal per-send price.
  const PER_SMS = 10; // cents
  const amountCents = credits * PER_SMS;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = svc as any;

  // Insert audit row first
  const { error: tErr } = await sb.from("sms_topups").insert({
    tenant_id: tenantId,
    amount_cents: amountCents,
    credits_added: credits,
    pack_label: `Manual grant: ${trimmed}`,
    status: "completed",
    completed_at: new Date().toISOString(),
  });
  if (tErr) return { ok: false, error: `Не удалось записать аудит: ${tErr.message}` };

  // Bump balance
  const { data: cfg } = await sb
    .from("tenant_sms_config")
    .select("balance_cents")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const newBalance = (cfg?.balance_cents ?? 0) + amountCents;
  const { error: uErr } = await sb
    .from("tenant_sms_config")
    .upsert(
      { tenant_id: tenantId, balance_cents: newBalance },
      { onConflict: "tenant_id" },
    );
  if (uErr) return { ok: false, error: uErr.message };

  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin");
  return { ok: true };
}
