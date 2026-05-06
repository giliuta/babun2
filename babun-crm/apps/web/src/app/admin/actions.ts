"use server";

// STORY-070 — server actions for the admin surface.
//
// All actions assert is_platform_admin() server-side via the helper
// SQL function. The service-role client bypasses RLS for the writes
// since admin work crosses tenant boundaries.

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseService } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/admin/audit";

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

  await logAdminAction({
    adminUserId: auth.userId,
    action: "set_plan_override",
    targetTenantId: tenantId,
    details: { override },
  });

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

  await logAdminAction({
    adminUserId: auth.userId,
    action: "approve_sender",
    targetTenantId: tenantId,
  });

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

  await logAdminAction({
    adminUserId: auth.userId,
    action: "reject_sender",
    targetTenantId: tenantId,
    details: { reason: trimmed },
  });

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

  await logAdminAction({
    adminUserId: auth.userId,
    action: "grant_sms_balance",
    targetTenantId: tenantId,
    details: { credits, reason: trimmed },
  });

  const svc = getSupabaseService();
  // STORY-080 — replaced legacy read-then-update with the atomic
  // bump_sms_balance RPC (introduced in migration 005 for the Stripe
  // webhook). Two simultaneous admin grants no longer race.
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

  // Atomic balance bump — see migration 20260506_005.
  const { data: rpcData, error: rpcErr } = await sb.rpc("bump_sms_balance", {
    p_tenant_id: tenantId,
    p_amount_cents: amountCents,
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };
  if (rpcData && typeof rpcData === "object" && "error" in rpcData) {
    return { ok: false, error: String((rpcData as { error: string }).error) };
  }

  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin");
  return { ok: true };
}

// ── Tenant impersonation via magic link ──────────────────────────
//
// Generates a one-time login link for the tenant's owner. Admin
// opens it in a new tab and lands signed-in as that owner — useful
// for debugging "this is broken" reports without asking for the
// customer's password. The auth admin generateLink under the
// service-role client is the cleanest path. We don't email the link —
// we return it to the UI which opens it directly in a new window.
export async function impersonateTenantOwner(
  tenantId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const auth = await assertAdmin();
  if (!auth) return { ok: false, error: "Доступ только для администратора" };

  // STORY-080 — log impersonation BEFORE generating the link, so
  // even a failed attempt leaves a forensic record. This is the
  // most-sensitive admin action by a wide margin.
  await logAdminAction({
    adminUserId: auth.userId,
    action: "impersonate_owner",
    targetTenantId: tenantId,
  });

  const sb = await getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: email, error: rpcErr } = await (sb as any).rpc(
    "admin_resolve_tenant_owner_email",
    { p_tenant_id: tenantId },
  );
  if (rpcErr) return { ok: false, error: rpcErr.message };
  if (!email) return { ok: false, error: "У тенанта не найден владелец" };

  const svc = getSupabaseService();
  const { data, error } = await svc.auth.admin.generateLink({
    type: "magiclink",
    email: email as string,
    options: {
      redirectTo: "https://babun.app/dashboard",
    },
  });
  if (error) return { ok: false, error: error.message };
  const link =
    (data as { properties?: { action_link?: string } } | null)?.properties
      ?.action_link;
  if (!link) return { ok: false, error: "Не удалось сгенерировать magic link" };

  return { ok: true, url: link };
}
