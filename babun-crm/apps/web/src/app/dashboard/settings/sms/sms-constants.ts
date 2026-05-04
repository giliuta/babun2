// STORY-069 — pure constants for the managed SMS flow.
//
// Lives in its own file (not "use server") because Next 16 forbids
// non-async exports from a "use server" module. Settings UI imports
// these directly; managed-actions.ts also re-uses them server-side.

export interface TopupPack {
  id: "starter" | "standard" | "business";
  amountCents: number;
  credits: number;
  label: string;
  bonusLabel?: string;
}

export const TOPUP_PACKS: TopupPack[] = [
  {
    id: "starter",
    amountCents: 1000,
    credits: 100,
    label: "Стартовый",
  },
  {
    id: "standard",
    amountCents: 2500,
    credits: 280,
    label: "Стандарт",
    bonusLabel: "+10%",
  },
  {
    id: "business",
    amountCents: 5000,
    credits: 600,
    label: "Бизнес",
    bonusLabel: "+20%",
  },
];

export const DEFAULT_FREE_SMS = 10;
export const PER_SMS_COST_CENTS = 10;
export const PLATFORM_DEFAULT_SENDER = "Babun";
