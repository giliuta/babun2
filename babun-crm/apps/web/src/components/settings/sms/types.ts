// STORY-047 G5 — shared types for the SMS settings UI.
//
// `SmsConfigInitial` mirrors the shape returned by
// public.read_tenant_sms_config_safe(): every column of
// tenant_sms_config EXCEPT twilio_auth_token, which is replaced with
// the boolean `twilio_auth_token_configured`. The token never crosses
// the wire to the browser; the form prompts for a fresh value when
// the user wants to update it.

export type SmsMode = "platform" | "byok";

export interface SmsConfigInitial {
  tenant_id: string;
  mode: SmsMode;
  enabled: boolean;
  remind_24h_before: boolean;
  remind_2h_before: boolean;
  template_24h: string;
  template_2h: string;
  twilio_account_sid: string | null;
  twilio_phone_number: string | null;
  twilio_auth_token_configured: boolean;
  sent_this_month: number;
  free_quota_per_month: number;
  quota_period_start: string;
  created_at: string;
  updated_at: string;
}

export type SmsStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "undelivered";

export type SmsTrigger = "reminder_24h" | "reminder_2h" | "manual" | "test";

export interface SmsMessageRow {
  id: string;
  to_phone: string;
  message_body: string;
  status: SmsStatus;
  error_code: string | null;
  error_message: string | null;
  trigger_type: SmsTrigger;
  mode: SmsMode;
  created_at: string;
  delivered_at: string | null;
}
