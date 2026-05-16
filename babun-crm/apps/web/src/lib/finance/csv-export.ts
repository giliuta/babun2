// v559 §3.12 — CSV export for /dashboard/finances.
//
// Implements the «Кнопки экспорта в Excel» clause of §3.12. Excel
// opens CSV files natively (and so do Google Sheets, Numbers, etc.),
// so we ship pure CSV instead of pulling in a 200-kB xlsx writer for
// what amounts to a five-column table.
//
// PDF export is a separate item — needs a layout template and a
// renderer (jspdf + autotable, ~300 kB). Deferred.
//
// Encoding notes:
//   - UTF-8 BOM prefix (`﻿`) so Excel on Windows opens Cyrillic
//     correctly without an encoding prompt.
//   - Field separator is `;` (not `,`) — that's what Russian-locale
//     Excel expects for CSV. Numbers stay decimal-dot to avoid
//     escaping the European comma.
//   - Every field is wrapped in double-quotes and embedded quotes
//     are doubled. Handles addresses with commas, multiline notes,
//     etc.

const BOM = "﻿";
const SEP = ";";

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "\"\"";
  const s = String(value);
  return `"${s.replace(/"/g, "\"\"")}"`;
}

export interface CsvColumn<Row> {
  header: string;
  accessor: (row: Row) => string | number | null | undefined;
}

/** Builds a CSV string. Caller passes column definitions + rows;
 *  ordering of rows is preserved. */
export function buildCsv<Row>(columns: CsvColumn<Row>[], rows: Row[]): string {
  const lines: string[] = [];
  lines.push(columns.map((c) => escapeCsv(c.header)).join(SEP));
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsv(c.accessor(row))).join(SEP));
  }
  // CRLF line endings — Excel on Windows reads these without a prompt;
  // Numbers / Sheets handle them too.
  return BOM + lines.join("\r\n") + "\r\n";
}

/** Triggers a browser download for the given CSV blob. No-op on the
 *  server. Filename is sanitised (Latin / digits / `_ -` only) so
 *  Windows / macOS file pickers don't bark on a Cyrillic filename. */
export function downloadCsv(csv: string, filename: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const safeName = filename
    .replace(/[^a-z0-9_\-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName || "export"}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a tick — Safari sometimes drops the download if the
  // URL is revoked synchronously.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Convenience presets for the finance page ──────────────────────

export interface FinanceCsvRow {
  dateKey: string;
  description: string;
  amount: number;
  teamName: string;
  type: "income" | "expense";
}

/** Default column set for the unified income+expense export. The
 *  finance page calls this with the rows already filtered by period
 *  + active team. */
export const FINANCE_CSV_COLUMNS: CsvColumn<FinanceCsvRow>[] = [
  { header: "Дата", accessor: (r) => r.dateKey },
  { header: "Тип", accessor: (r) => (r.type === "income" ? "Доход" : "Расход") },
  { header: "Команда", accessor: (r) => r.teamName },
  { header: "Описание", accessor: (r) => r.description },
  { header: "Сумма (€)", accessor: (r) => r.amount.toFixed(2) },
];
