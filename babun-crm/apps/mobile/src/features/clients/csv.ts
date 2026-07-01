import type { Client } from "@babun/shared/local/clients";

// Map common RU/EN header names → Client fields. Lower-cased, trimmed.
const FIELD_MAP: Record<string, keyof Client> = {
  name: "full_name",
  "full name": "full_name",
  full_name: "full_name",
  "имя": "full_name",
  "фио": "full_name",
  "имя клиента": "full_name",
  "клиент": "full_name",
  "название": "full_name",
  phone: "phone",
  "phone number": "phone",
  mobile: "phone",
  tel: "phone",
  "телефон": "phone",
  "тел": "phone",
  "номер": "phone",
  "номер телефона": "phone",
  email: "email",
  "e-mail": "email",
  mail: "email",
  "почта": "email",
  "емейл": "email",
  city: "city",
  "город": "city",
  address: "address",
  "адрес": "address",
  comment: "comment",
  comments: "comment",
  note: "comment",
  notes: "comment",
  "заметка": "comment",
  "заметки": "comment",
  "комментарий": "comment",
  "примечание": "comment",
};

function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === delim) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export interface ParsedClientsCsv {
  drafts: Partial<Client>[];
  mappedFields: string[]; // distinct Client fields recognized in the header
  total: number; // data rows seen
  skipped: number; // rows dropped (no name AND no phone)
}

/**
 * Parse a clients CSV (RU/EN headers, `,` or `;` delimiter, quoted fields,
 * BOM-tolerant). Rows need at least a name or a phone; a phone-only row uses
 * the phone as the display name.
 */
export function parseClientsCsv(input: string): ParsedClientsCsv {
  const text = input.replace(/^﻿/, "");
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { drafts: [], mappedFields: [], total: 0, skipped: 0 };
  }

  const header = lines[0];
  const delim =
    header.split(";").length > header.split(",").length ? ";" : ",";
  const cols = splitLine(header, delim).map(
    (h) => FIELD_MAP[h.toLowerCase()] ?? null,
  );
  const mappedFields = [...new Set(cols.filter(Boolean) as string[])];

  const drafts: Partial<Client>[] = [];
  let skipped = 0;
  for (let r = 1; r < lines.length; r++) {
    const cells = splitLine(lines[r], delim);
    const draft: Partial<Client> = {};
    cols.forEach((field, i) => {
      if (!field) return;
      const v = (cells[i] ?? "").trim();
      if (v) (draft as Record<string, unknown>)[field] = v;
    });
    if (!draft.full_name && !draft.phone) {
      skipped++;
      continue;
    }
    if (!draft.full_name) draft.full_name = draft.phone as string;
    drafts.push(draft);
  }

  return { drafts, mappedFields, total: lines.length - 1, skipped };
}
