// Phone number normalization — Sprint clients-99 (F1.4).
//
// One source of truth for turning whatever the user typed (spaces,
// brackets, leading zeros, missing country code) into a canonical
// E.164 string we can dedupe / index on. Default country comes from
// the tenant — Cyprus today, Greece / Russia / Ukraine / UK / Germany
// tomorrow when those tenants land — never hardcoded to "CY".

import {
  parsePhoneNumberFromString,
  isValidPhoneNumber,
  AsYouType,
  type CountryCode,
} from "libphonenumber-js";

/** ISO-2 country codes we currently support as tenant defaults. */
export const SUPPORTED_COUNTRIES: readonly CountryCode[] = [
  "CY", "GR", "RU", "UA", "GB", "DE", "FR", "IT", "ES", "PT",
  "PL", "RO", "BG", "TR", "IL", "CZ", "SK", "HU", "NL", "BE",
  "AT", "CH", "DK", "SE", "NO", "FI", "LV", "LT", "EE",
] as const;

/** UI-friendly flag emoji for a country code (used by the picker). */
export function countryFlag(code: CountryCode): string {
  // Each ASCII letter → regional indicator symbol (offset +0x1F1E6 - 'A').
  const base = 0x1f1e6 - "A".charCodeAt(0);
  return [...code].map((c) => String.fromCodePoint(base + c.charCodeAt(0))).join("");
}

/** Human-readable country name (RU). Falls back to the ISO code. */
export const COUNTRY_NAMES_RU: Partial<Record<CountryCode, string>> = {
  CY: "Кипр",
  GR: "Греция",
  RU: "Россия",
  UA: "Украина",
  GB: "Великобритания",
  DE: "Германия",
  FR: "Франция",
  IT: "Италия",
  ES: "Испания",
  PT: "Португалия",
  PL: "Польша",
  RO: "Румыния",
  BG: "Болгария",
  TR: "Турция",
  IL: "Израиль",
  CZ: "Чехия",
  SK: "Словакия",
  HU: "Венгрия",
  NL: "Нидерланды",
  BE: "Бельгия",
  AT: "Австрия",
  CH: "Швейцария",
  DK: "Дания",
  SE: "Швеция",
  NO: "Норвегия",
  FI: "Финляндия",
  LV: "Латвия",
  LT: "Литва",
  EE: "Эстония",
};

/**
 * Returns the canonical E.164 form of `raw` or `null` if the number
 * couldn't be parsed into something valid. Empty / whitespace input
 * always returns `null` (not an error — the form should treat phone
 * as optional during draft mode).
 *
 * `defaultCountry` is the tenant's country. When the user types a
 * local-format number ("99 555 111" on a CY tenant) we attach the
 * country prefix; when the user starts with `+`, the country code in
 * the string wins.
 */
export function toE164(raw: string, defaultCountry: CountryCode = "CY"): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  try {
    const p = parsePhoneNumberFromString(trimmed, defaultCountry);
    if (!p || !p.isValid()) return null;
    return p.number; // already E.164
  } catch {
    return null;
  }
}

/**
 * Soft version of {@link toE164} — returns `null` when invalid but
 * never throws, and also strips obviously bogus inputs (single digit,
 * letters-only) before calling libphonenumber.
 */
export function tryToE164(raw: string, defaultCountry: CountryCode = "CY"): string | null {
  const trimmed = (raw ?? "").replace(/\s+/g, "");
  if (!trimmed) return null;
  // Need at least 3 digits to be plausible.
  if ((trimmed.match(/\d/g) ?? []).length < 3) return null;
  return toE164(trimmed, defaultCountry);
}

/**
 * Returns true when two raw phone strings normalize to the same E.164
 * value under the same default country. Used by the duplicate-on-create
 * guard.
 */
export function phonesEqual(a: string, b: string, country: CountryCode = "CY"): boolean {
  const ea = tryToE164(a, country);
  const eb = tryToE164(b, country);
  return ea !== null && eb !== null && ea === eb;
}

/**
 * Detects the country a string starts with (e.g. "+357" → "CY"). Used
 * by the country selector to auto-switch the dropdown when the user
 * types `+` prefix manually.
 */
export function guessCountry(raw: string): CountryCode | null {
  try {
    const p = parsePhoneNumberFromString(raw);
    return (p?.country as CountryCode | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * Format a phone number for display: when valid, returns the
 * international form ("+357 99 555 111"); otherwise returns the input
 * unchanged so we don't lose what the user typed.
 */
export function formatDisplay(raw: string, defaultCountry: CountryCode = "CY"): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  try {
    const p = parsePhoneNumberFromString(trimmed, defaultCountry);
    if (p && p.isValid()) return p.formatInternational();
    // Fall back to the "as you type" formatter so partial input still
    // looks tidy ("+357 99 5...").
    const aty = new AsYouType(defaultCountry);
    return aty.input(trimmed);
  } catch {
    return trimmed;
  }
}

/** Quick boolean — is this string a parseable phone for the given country? */
export function isPhoneValid(raw: string, defaultCountry: CountryCode = "CY"): boolean {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return false;
  try {
    return isValidPhoneNumber(trimmed, defaultCountry);
  } catch {
    return false;
  }
}

/** Re-export the CountryCode type so callers don't need to know about libphonenumber-js. */
export type { CountryCode };
