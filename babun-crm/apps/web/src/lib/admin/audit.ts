// STORY-080 — Admin action audit log helper.
//
// Inserts one row per admin action into public.admin_actions_log.
// Called at the top of every action in /admin/actions.ts BEFORE the
// mutation runs, so failed attempts also leave a record (auditors
// want this — "tried to do X" is a useful forensic signal).
//
// The helper swallows errors deliberately — failing to log shouldn't
// block the action. Production errors get console.error'd for the
// observability pipeline to pick up.

import { getSupabaseService } from "@/lib/supabase/service";

export interface LogAdminActionInput {
  adminUserId: string;
  action:
    | "set_plan_override"
    | "approve_sender"
    | "reject_sender"
    | "grant_sms_balance"
    | "impersonate_owner";
  targetTenantId?: string | null;
  targetUserId?: string | null;
  details?: Record<string, unknown>;
}

export async function logAdminAction(input: LogAdminActionInput): Promise<void> {
  try {
    const svc = getSupabaseService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc as any).from("admin_actions_log").insert({
      admin_user_id: input.adminUserId,
      action: input.action,
      target_tenant_id: input.targetTenantId ?? null,
      target_user_id: input.targetUserId ?? null,
      details: input.details ?? {},
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("logAdminAction failed", error.message, input);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("logAdminAction threw", err, input);
  }
}
