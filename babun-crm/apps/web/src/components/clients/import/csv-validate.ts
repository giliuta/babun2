// STORY-046 — Per-row validation for CSV imports.

import type { CountryCode, ImportableField } from "./csv-mapping";

export type RowReason =
  | "пустое имя"
  | "битый телефон"
  | "дубликат внутри файла"
  | "дубликат в БД";

export interface ParsedRow {
  /** 1-based source row index in the original file (header = row 1). */
  source: number;
  /** Cell values keyed by CSV column index. */
  cells: Record<number, string>;
}

export interface MappedRow {
  source: number;
  full_name: string;
  phone: string;
  email: string;
  comment: string;
  address: string;
  /** Empty when no validation issues. */
  reasons: RowReason[];
}

/** Strip everything except digits, preserving a single leading +. */
function digitsWithLeadingPlus(raw: string): { plus: boolean; digits: string } {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return { plus, digits };
}

/** Normalise a phone number into E.164 (+ followed by 8-15 digits) with
 *  the user-picked default country code applied to bare local numbers.
 *  Returns '' when the input is unparseable; '' is also returned for
 *  an empty input (a missing phone is fine — only full_name is required). */
export function normalisePhone(raw: string, defaultCountry: CountryCode | string): string {
  if (!raw || !raw.trim()) return "";
  const { plus, digits } = digitsWithLeadingPlus(raw);
  if (digits.length === 0) return "";
  if (plus) return "+" + digits;
  // Russia / Kazakhstan: leading 8 (legacy) or 7 (E.164 without plus).
  if (digits.length === 11 && digits.startsWith("7")) return "+" + digits;
  if (digits.length === 11 && digits.startsWith("8")) return "+7" + digits.slice(1);
  // Cyprus: 8 digits typical.
  if (digits.length === 8) return defaultCountry + digits;
  // 9 / 10 digits — assume the user-picked country code.
  if (digits.length === 9 || digits.length === 10) return defaultCountry + digits;
  return "";
}

const E164_RE = /^\+\d{8,15}$/;

export function isE164(s: string): boolean {
  return E164_RE.test(s);
}

export interface MapAndValidateOptions {
  rows: ParsedRow[];
  /** Mapping[colIndex] = field name; 'skip' means the column is ignored. */
  mapping: ImportableField[];
  defaultCountry: CountryCode | string;
  /** Phones that already exist in the DB (post-normalisation). */
  existingDbPhones: Set<string>;
}

export interface MapAndValidateResult {
  mapped: MappedRow[];
  /** Counts for the preview header. */
  totalParsed: number;
  emptyName: number;
  badPhone: number;
  duplicateInFile: number;
  duplicateInDb: number;
}

/** Walk every parsed row, apply the column mapping, normalise phones,
 *  flag missing names, and detect duplicates both within the CSV and
 *  against an existing-DB phone set. Returns rows in the same order as
 *  the input — no filtering at this stage; the caller decides what to
 *  drop based on the user's duplicate-handling choice. */
export function mapAndValidate(opts: MapAndValidateOptions): MapAndValidateResult {
  const { rows, mapping, defaultCountry, existingDbPhones } = opts;
  const seenInFile = new Map<string, number>();
  const mapped: MappedRow[] = [];
  let emptyName = 0;
  let badPhone = 0;
  let duplicateInFile = 0;
  let duplicateInDb = 0;

  // First pass: assign + count seen phones.
  for (const row of rows) {
    let full_name = "";
    let rawPhone = "";
    let email = "";
    let comment = "";
    let address = "";
    for (let col = 0; col < mapping.length; col++) {
      const field = mapping[col];
      const value = (row.cells[col] ?? "").toString().trim();
      if (field === "full_name") full_name = value;
      else if (field === "phone") rawPhone = value;
      else if (field === "email") email = value;
      else if (field === "comment") comment = value;
      else if (field === "address") address = value;
    }
    const phone = normalisePhone(rawPhone, defaultCountry);
    const reasons: RowReason[] = [];
    if (!full_name) {
      reasons.push("пустое имя");
      emptyName++;
    }
    if (rawPhone && !phone) {
      reasons.push("битый телефон");
      badPhone++;
    } else if (phone && !isE164(phone) && rawPhone) {
      reasons.push("битый телефон");
      badPhone++;
    }
    if (phone) {
      if (seenInFile.has(phone)) {
        reasons.push("дубликат внутри файла");
        duplicateInFile++;
      } else {
        seenInFile.set(phone, row.source);
      }
      if (existingDbPhones.has(phone)) {
        reasons.push("дубликат в БД");
        duplicateInDb++;
      }
    }
    mapped.push({
      source: row.source,
      full_name,
      phone,
      email,
      comment,
      address,
      reasons,
    });
  }
  return {
    mapped,
    totalParsed: rows.length,
    emptyName,
    badPhone,
    duplicateInFile,
    duplicateInDb,
  };
}

export type DuplicateAction = "skip" | "overwrite" | "import_as_dup";

/** Decide which rows actually go to the INSERT batch given the user's
 *  duplicate-handling choice + the validated rows. Always drops rows
 *  flagged with empty name or bad phone (those are non-recoverable). */
export function selectImportable(
  mapped: MappedRow[],
  action: DuplicateAction,
): { keep: MappedRow[]; drop: MappedRow[] } {
  const keep: MappedRow[] = [];
  const drop: MappedRow[] = [];
  for (const row of mapped) {
    const dropReasons = row.reasons;
    if (dropReasons.includes("пустое имя") || dropReasons.includes("битый телефон")) {
      drop.push(row);
      continue;
    }
    if (dropReasons.includes("дубликат внутри файла")) {
      drop.push(row);
      continue;
    }
    if (dropReasons.includes("дубликат в БД")) {
      if (action === "skip") {
        drop.push(row);
        continue;
      }
      // overwrite + import_as_dup both keep the row in the importable
      // set; the actual write logic differs (UPDATE-by-phone vs INSERT
      // a second row).
      keep.push(row);
      continue;
    }
    keep.push(row);
  }
  return { keep, drop };
}
