"use server";

// STORY-069 — server actions for the managed-SMS settings flow.
//
// Three actions exposed:
//   * requestSenderName(name)  — submit Sender ID for owner approval
//   * cancelSenderRequest()    — withdraw a pending request
//   * createTopupCheckout(pack)— Stripe Checkout for balance top-up
//                                (wave 2; stub returns "soon" for now)
//
// All actions assert owner role + tenant ownership server-side. The
// service-role bypass on tenant_sms_config means the UPDATE itself
// runs without touching RLS, but we still scope to the requesting
// tenant via the auth.users session — never trust a tenant_id from
// the client payload.

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseService } from "@/lib/supabase/service";

type ActionResult = { ok: true } | { ok: false; error: string };

async function resolveOwnerTenantId(): Promise<{
  tenantId: string;
  userId: string;
} | null> {
  const sb = await getSupabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const jwt = (user.app_metadata as { tenant_id?: string } | undefined)
    ?.tenant_id;
  let tenantId = jwt ?? null;
  if (!tenantId) {
    const { data: m } = await sb
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    tenantId = m?.tenant_id ?? null;
  }
  if (!tenantId) return null;

  const { data: membership } = await sb
    .from("tenant_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!membership || membership.role !== "owner") return null;

  return { tenantId, userId: user.id };
}

// ── Sender ID request ────────────────────────────────────────────
//
// Twilio Alphanumeric Sender ID rules (Cyprus + general EU):
//   * 1–11 chars, A-Z / a-z / 0-9 / spaces
//   * Must contain at least one letter (purely-numeric IDs reject)
//   * No special chars (operators strip them and delivery fails)
const SENDER_PATTERN = /^[A-Za-z0-9 ]{1,11}$/;
const SENDER_MUST_HAVE_LETTER = /[A-Za-z]/;

export async function requestSenderName(
  name: string,
): Promise<ActionResult> {
  const auth = await resolveOwnerTenantId();
  if (!auth) {
    return { ok: false, error: "Только владелец может настраивать SMS" };
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Введите имя отправителя" };
  }
  if (trimmed.length > 11) {
    return { ok: false, error: "Максимум 11 символов" };
  }
  if (!SENDER_PATTERN.test(trimmed)) {
    return {
      ok: false,
      error: "Только латинские буквы, цифры и пробел",
    };
  }
  if (!SENDER_MUST_HAVE_LETTER.test(trimmed)) {
    return { ok: false, error: "Должна быть хотя бы одна буква" };
  }

  const svc = getSupabaseService();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any).from("tenant_sms_config").upsert(
    {
      tenant_id: auth.tenantId,
      sender_name: trimmed,
      sender_status: "pending",
      sender_requested_at: new Date().toISOString(),
      sender_approved_at: null,
      sender_rejection_reason: null,
    },
    { onConflict: "tenant_id" },
  );

  if (error) {
    return { ok: false, error: `Не удалось сохранить: ${error.message}` };
  }

  revalidatePath("/dashboard/settings/sms");
  return { ok: true };
}

export async function cancelSenderRequest(): Promise<ActionResult> {
  const auth = await resolveOwnerTenantId();
  if (!auth) {
    return { ok: false, error: "Только владелец может настраивать SMS" };
  }

  const svc = getSupabaseService();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc as any)
    .from("tenant_sms_config")
    .update({
      sender_name: null,
      sender_status: null,
      sender_requested_at: null,
      sender_approved_at: null,
      sender_rejection_reason: null,
    })
    .eq("tenant_id", auth.tenantId)
    .eq("sender_status", "pending");

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/sms");
  return { ok: true };
}

// ── Stripe top-up Checkout (G3 stub for wave 1) ──────────────────
//
// Wave 2 of STORY-069 wires this to Stripe. For wave 1 we return
// ok: false with a clear "coming soon" error so the UI button can
// disable with explanatory copy.
export async function createTopupCheckout(packId: string): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  const auth = await resolveOwnerTenantId();
  if (!auth) {
    return { ok: false, error: "Только владелец может пополнять баланс" };
  }
  void packId;
  return {
    ok: false,
    error:
      "Пополнение баланса станет доступно в ближайшем обновлении (волна 2 STORY-069 — после подключения Stripe)",
  };
}

// Pricing constants moved to ./sms-constants.ts — Next 16 forbids
// non-async exports from a "use server" module. Import from the
// constants module directly where needed.
