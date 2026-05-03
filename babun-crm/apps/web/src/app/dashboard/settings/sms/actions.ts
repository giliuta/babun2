"use server";

// STORY-047 G5 — save action for /dashboard/settings/sms.
//
// The form ALWAYS posts here. The action:
//   1. Verifies the caller's session + Owner role server-side (RLS
//      backstops it but we want to fail loud + early on the API).
//   2. Builds the row to upsert. If the form's `twilio_auth_token`
//      field is empty, we DO NOT overwrite the existing token —
//      the safe-read RPC tells the form whether one is configured
//      and the form posts an empty string when the user didn't
//      retype it.
//   3. UPSERTs `tenant_sms_config` keyed on `tenant_id`. Uses
//      `Prefer: return=minimal` semantics via supabase-js so
//      PostgREST doesn't try to read the row back through the
//      missing SELECT policy (G1 design — owner reads via the safe
//      RPC, not direct SELECT).
//
// On success: revalidates the page so the next render reflects the
// new state. On failure: returns a typed error object the client
// shows in the form footer.

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseService } from "@/lib/supabase/service";
import type { SmsMode } from "@/components/settings/sms/types";

export interface SaveSmsConfigInput {
  mode: SmsMode;
  enabled: boolean;
  remind_24h_before: boolean;
  remind_2h_before: boolean;
  template_24h: string;
  template_2h: string;
  twilio_account_sid: string;     // empty string allowed if mode='platform'
  twilio_phone_number: string;    // empty string allowed if mode='platform'
  /** Empty string = "don't update the token" (keep existing). */
  twilio_auth_token: string;
}

export type SaveSmsConfigResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveSmsConfig(
  input: SaveSmsConfigInput,
): Promise<SaveSmsConfigResult> {
  // ── Identity + role check ──────────────────────────────────────
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const jwtTenantId = (user.app_metadata as { tenant_id?: string } | undefined)
    ?.tenant_id;
  let activeTenantId = jwtTenantId ?? null;
  if (!activeTenantId) {
    const { data: membership } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    activeTenantId = membership?.tenant_id ?? null;
  }
  if (!activeTenantId) return { ok: false, error: "tenant_missing" };

  const { data: roleRow } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", activeTenantId)
    .maybeSingle();
  if (!roleRow || roleRow.role !== "owner") {
    return { ok: false, error: "owner_only" };
  }

  // ── Validate BYOK completeness BEFORE upsert. The CHECK
  //    constraint on the table would also fire, but a typed error
  //    here gives the form a useful message.
  if (input.mode === "byok") {
    const sidOk = input.twilio_account_sid.trim().length > 0;
    const phoneOk = input.twilio_phone_number.trim().length > 0;
    // Token: required if there isn't one already configured (the
    // page would have known). To avoid threading a flag through, we
    // re-read the safe RPC right here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data: cfgRows } = await sb.rpc("read_tenant_sms_config_safe");
    const cfg = (cfgRows?.[0] as { twilio_auth_token_configured?: boolean }) ?? null;
    const tokenAlreadyConfigured = !!cfg?.twilio_auth_token_configured;
    const tokenOk =
      input.twilio_auth_token.trim().length > 0 || tokenAlreadyConfigured;
    if (!sidOk || !phoneOk || !tokenOk) {
      return { ok: false, error: "byok_incomplete" };
    }
  }

  // ── Build the upsert payload. Service role for bypass — the safe
  //    RPC pattern (no SELECT policy on the table for authenticated)
  //    means a `Prefer: return=minimal` upsert via the user's JWT
  //    works in theory, but supabase-js still tries to read back the
  //    row by default. Using service-role here is cleaner and lets
  //    us conditionally skip the auth_token field.
  const service = getSupabaseService();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbs = service as any;

  // Build the upsert payload. Cleanup contract: when mode='platform',
  // ALL three BYOK columns (sid, phone, auth_token) reset to null
  // unconditionally — even if the user typed values into the BYOK
  // fields before switching modes. This guarantees a future
  // platform→byok switch starts with a clean slate AND respects the
  // CHECK constraint, which only requires the trio to be non-null
  // when mode='byok' but doesn't forbid leftover values in platform
  // mode (we forbid them ourselves, defense-in-depth).
  const tokenIsBeingUpdated = input.twilio_auth_token.trim().length > 0;
  const payload: Record<string, unknown> = {
    tenant_id: activeTenantId,
    mode: input.mode,
    enabled: input.enabled,
    remind_24h_before: input.remind_24h_before,
    remind_2h_before: input.remind_2h_before,
    template_24h: input.template_24h,
    template_2h: input.template_2h,
    twilio_account_sid:
      input.mode === "byok" ? input.twilio_account_sid.trim() : null,
    twilio_phone_number:
      input.mode === "byok" ? input.twilio_phone_number.trim() : null,
  };
  // Token rules — order matters:
  //   * platform mode → ALWAYS null, even if the user typed
  //     something. They can't see the field anyway, but a stale
  //     state from a previous BYOK session shouldn't survive.
  //   * byok mode + retyped → write the new value.
  //   * byok mode + not retyped → omit the column entirely so the
  //     upsert preserves whatever's already stored.
  if (input.mode === "platform") {
    payload.twilio_auth_token = null;
  } else if (tokenIsBeingUpdated) {
    payload.twilio_auth_token = input.twilio_auth_token;
  }

  const { error: upsertErr } = await sbs
    .from("tenant_sms_config")
    .upsert(payload, { onConflict: "tenant_id" });

  if (upsertErr) {
    return {
      ok: false,
      error:
        typeof upsertErr.message === "string"
          ? upsertErr.message
          : "upsert_failed",
    };
  }

  revalidatePath("/dashboard/settings/sms");
  return { ok: true };
}
