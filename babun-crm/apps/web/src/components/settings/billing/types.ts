// STORY-052 G5 — shared types for the billing settings UI.

export type Plan = "free" | "pro" | "business";
export type EffectivePlan = Plan | "lifetime" | "beta_unlimited";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | null;

export interface BillingState {
  plan: Plan;
  effective_plan: EffectivePlan;
  /** Truthy when plan_override is set (lifetime / beta_unlimited). */
  is_overridden: boolean;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  has_stripe_subscription: boolean;
}

export interface QuotaSummary {
  clients: number;
  appointments_month: number;
  team_members: number;
  sms_month: number;
}

export interface UsageCounts {
  clients: number;
  appointments_month: number;
  team_members: number;
  sms_month: number;
}

export interface BillingEventRow {
  id: string;
  stripe_event_id: string;
  event_type: string;
  processed_at: string;
  /** Hosted invoice URL pulled from the Stripe payload, when present. */
  invoice_url: string | null;
  /** Amount in EUR cents, when present. */
  amount_cents: number | null;
}

/** UI-side helpers — keep in sync with the 999_999_999 sentinel from
 *  the SQL helpers (STORY-052 G1). */
export function isUnlimited(n: number): boolean {
  return n >= 1_000_000_000;
}

export function planNameRu(p: EffectivePlan): string {
  switch (p) {
    case "free":
      return "Бесплатный";
    case "pro":
      return "Pro";
    case "business":
      return "Business";
    case "lifetime":
      return "Lifetime";
    case "beta_unlimited":
      return "Beta";
  }
}

export function statusNameRu(s: SubscriptionStatus): string | null {
  switch (s) {
    case "active":
      return "Активна";
    case "trialing":
      return "Пробный период";
    case "past_due":
      return "Просрочена оплата";
    case "canceled":
      return "Отменена";
    case "incomplete":
      return "Не завершена";
    case null:
      return null;
  }
}
