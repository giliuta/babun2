// P1 #29 (CRM Core brief) — CSV export for /clients (and reusable for
// /finances + /masters later via the same helpers).
//
// Excel-compatible:
//   • BOM prefix (﻿) so Excel auto-detects UTF-8 and Cyrillic
//     renders correctly. Without it, opening the file in EU-locale
//     Excel mangles the headers and any non-ASCII names.
//   • `;` as the field separator — Excel's regional default in CY/RU
//     locales. Google Sheets and Numbers also handle it fine.
//   • CRLF line endings — Excel-friendly.
//
// XLSX / PDF are deferred: XLSX needs sheetjs (~700 KB gzipped) and PDF
// needs a layout engine. CSV covers the «just give me a spreadsheet»
// case the user actually asks for; the heavier formats can land in
// their own story when there's a concrete need.

import type { Client } from "@babun/shared/local/clients";

/** Quote a single cell per RFC 4180 — wrap in double-quotes if the
 *  value contains the delimiter, a quote, or a newline; escape inner
 *  quotes by doubling them. We always quote strings that contain a
 *  semicolon (our delimiter) or `,` (in case a downstream reopens
 *  with a comma delimiter). */
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s === "") return "";
  if (/[";,\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV body (no BOM) from a list of rows.
 *  `header` is rendered first; rows are joined with CRLF. */
export function toCsv(header: readonly string[], rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  const lines: string[] = [];
  lines.push(header.map(csvCell).join(";"));
  for (const row of rows) {
    lines.push(row.map(csvCell).join(";"));
  }
  return lines.join("\r\n");
}

/** Trigger a browser download for the given CSV string. Filename
 *  carries a sortable date so consecutive exports don't collide.
 *  BOM is prepended here so the helper can be reused without callers
 *  remembering. */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** YYYY-MM-DD for filename stamps. */
export function todayStamp(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ─── Clients ─────────────────────────────────────────────────────────────

const CLIENT_HEADER: readonly string[] = [
  "ID",
  "Имя",
  "Телефон",
  "WhatsApp",
  "Telegram",
  "Instagram",
  "Email",
  "Город",
  "Адрес",
  "День рождения",
  "Источник",
  "Теги",
  "Чёрный список",
  "Заметка",
  "Создан",
];

export function clientsToCsv(clients: readonly Client[]): string {
  const rows = clients.map((c) => [
    c.id,
    c.full_name,
    c.phone,
    c.whatsapp_phone,
    c.telegram_username ? `@${c.telegram_username}` : "",
    c.instagram_username ? `@${c.instagram_username}` : "",
    c.email,
    c.city,
    c.address || c.locations?.[0]?.address || "",
    c.birthday,
    c.acquisition_source ?? "",
    (c.tag_ids ?? []).join(", "),
    c.blacklisted ? "да" : "",
    c.comment,
    c.created_at?.slice(0, 10) ?? "",
  ]);
  return toCsv(CLIENT_HEADER, rows);
}

export function exportClientsCsv(clients: readonly Client[]): void {
  downloadCsv(`babun-clients-${todayStamp()}.csv`, clientsToCsv(clients));
}
