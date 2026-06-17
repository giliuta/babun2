// v811 — which fields show on a client list card.
//
// Mirrors the «Что показывать на карточке» screen (gear → Настройки
// клиентов). The client NAME is always shown and is not part of this
// toggle set. Persisted to localStorage so the choice survives reloads;
// SSR-safe (returns defaults on the server, hydrated after mount).
//
// Follows the project's small-pref convention (see business-blocks.ts):
// a single `babun-…` key, JSON value, default-merged on read so adding
// a future field can't break an older stored object.

export type CardField = "exp" | "inc" | "debt" | "last" | "meta";

export type CardFieldPrefs = Record<CardField, boolean>;

export const CARD_FIELDS: CardField[] = ["exp", "inc", "debt", "last", "meta"];

/** Everything visible by default — matches the pre-toggle card. */
export const DEFAULT_CARD_FIELDS: CardFieldPrefs = {
  exp: true,
  inc: true,
  debt: true,
  last: true,
  meta: true,
};

const KEY = "babun-client-card-fields";

/** SSR-safe read. Unknown/legacy keys fall back to the default so a
 *  stored object written by an older build never hides a new field. */
export function getCardFields(): CardFieldPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_CARD_FIELDS };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_CARD_FIELDS };
    const parsed = JSON.parse(raw) as Partial<CardFieldPrefs>;
    const out = { ...DEFAULT_CARD_FIELDS };
    for (const f of CARD_FIELDS) {
      if (typeof parsed[f] === "boolean") out[f] = parsed[f] as boolean;
    }
    return out;
  } catch {
    return { ...DEFAULT_CARD_FIELDS };
  }
}

export function setCardFields(prefs: CardFieldPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota / privacy-mode write failures
  }
}
