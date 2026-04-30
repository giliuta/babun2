// STORY-046 — CSV column → client field mapping.
//
// Pure logic. The MappingStep UI binds dropdowns to FIELD_OPTIONS;
// the auto-detect runs on first parse to suggest sensible defaults.

export type ImportableField =
  | "skip"
  | "full_name"
  | "phone"
  | "email"
  | "comment"
  | "address";

/** Display labels for the mapping dropdown — RU per the UI rule. */
export const FIELD_LABEL: Record<ImportableField, string> = {
  skip: "— не импортировать —",
  full_name: "ФИО *",
  phone: "Телефон",
  email: "Email",
  comment: "Заметки",
  address: "Адрес",
};

/** The order matters — first matched header wins for the auto-mapper. */
export const FIELD_OPTIONS: ImportableField[] = [
  "skip",
  "full_name",
  "phone",
  "email",
  "comment",
  "address",
];

/** Header substring → field. All comparisons are lowercased + trimmed. */
const AUTO_MAP_RULES: Array<{ field: ImportableField; patterns: string[] }> = [
  { field: "full_name", patterns: ["full name", "client name", "имя", "фио", "name", "клиент"] },
  { field: "phone", patterns: ["mobile", "телефон", "phone", "тел", "моб"] },
  { field: "email", patterns: ["e-mail", "email", "почта"] },
  { field: "comment", patterns: ["comment", "заметки", "заметка", "примечан", "notes", "note"] },
  { field: "address", patterns: ["address", "адрес"] },
];

/** Best-effort guess for one CSV header. Returns 'skip' when nothing
 *  matches — caller can override in the UI. */
export function autoMapHeader(header: string): ImportableField {
  const h = header.trim().toLowerCase();
  if (!h) return "skip";
  for (const rule of AUTO_MAP_RULES) {
    if (rule.patterns.some((p) => h === p || h.includes(p))) {
      return rule.field;
    }
  }
  return "skip";
}

/** First-pass mapping for an entire header row. Ensures full_name lands
 *  on at most one column even if multiple headers look like names. */
export function autoMapHeaders(headers: string[]): ImportableField[] {
  const mapped = headers.map(autoMapHeader);
  // Keep only the first occurrence of each non-skip field; later ones
  // demote to skip so the user has to pick deliberately.
  const seen = new Set<ImportableField>();
  return mapped.map((field) => {
    if (field === "skip") return field;
    if (seen.has(field)) return "skip";
    seen.add(field);
    return field;
  });
}

/** Country-code options for phone normalisation. Matches the radio in
 *  the MappingStep. */
export const COUNTRY_CODES = [
  { value: "+357", label: "+357 (Кипр)" },
  { value: "+7", label: "+7 (Россия / Казахстан)" },
  { value: "+30", label: "+30 (Греция)" },
  { value: "+44", label: "+44 (Великобритания)" },
  { value: "+1", label: "+1 (США / Канада)" },
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number]["value"];

/** Default tenant-wide country code. AirFix is Cyprus → +357. We don't
 *  read tenant.city to pick this dynamically — the user picks per-import. */
export const DEFAULT_COUNTRY: CountryCode = "+357";
