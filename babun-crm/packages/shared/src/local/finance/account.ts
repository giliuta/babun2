// A money bucket — strictly per-brigade. Lives in the `accounts`
// table. «Наличка», «Карта Юры», «Карта компании» are separate rows;
// the same physical bank card on two brigades = two account rows.

export type AccountKind = "cash" | "card" | "bank" | "other";

export interface Account {
  id: string;
  tenant_id: string;
  brigade_id: string;
  name: string;
  kind: AccountKind;
  owner_master_id: string | null;
  opening_balance: number;
  icon: string | null;
  color: string | null;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function accountDisplayName(a: Account, brigadeName?: string): string {
  if (brigadeName) return `${a.name} · ${brigadeName}`;
  return a.name;
}
