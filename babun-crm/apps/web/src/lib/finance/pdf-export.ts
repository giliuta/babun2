// v588 §3.12 — PDF export for /dashboard/finances.
//
// Mirrors the csv-export module API (column defs + rows in, file
// out) but renders a typeset PDF table via jspdf + jspdf-autotable.
// Used for invoice-style reports the dispatcher can email to the
// owner or print at the office without going through Excel first.
//
// Bundle weight: ~250 kB gzipped. Worth it for the «I need to send
// this to the accountant by Wednesday» use case that CSV can't
// satisfy without recipient-side formatting.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface PdfColumn<Row> {
  header: string;
  accessor: (row: Row) => string | number | null | undefined;
  /** Optional column width hint in pt. */
  width?: number;
  /** "right" for money columns so digits line up. Default "left". */
  align?: "left" | "right" | "center";
}

export interface PdfTableOptions {
  /** Document title rendered above the table. */
  title?: string;
  /** Subtitle (period / filter label) below the title. */
  subtitle?: string;
  /** Page orientation. Defaults to "portrait"; switch to "landscape"
   *  for wide reports (6+ columns). */
  orientation?: "portrait" | "landscape";
  /** Trailing footer line — used for «Сформировано Babun N даты». */
  footer?: string;
}

/** Builds + downloads a typeset PDF table.
 *
 *  Caller passes column defs + rows, identical shape to the CSV
 *  exporter. Cyrillic renders via jspdf's built-in helvetica font;
 *  no need to bundle a TTF unless we ship Arabic/Greek glyphs later. */
export function downloadPdfTable<Row>(
  columns: PdfColumn<Row>[],
  rows: Row[],
  filename: string,
  options: PdfTableOptions = {},
): void {
  if (typeof window === "undefined") return;

  const doc = new jsPDF({
    orientation: options.orientation ?? "portrait",
    unit: "pt",
    format: "a4",
  });

  const marginLeft = 36;
  let cursorY = 48;

  if (options.title) {
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(options.title, marginLeft, cursorY);
    cursorY += 22;
  }
  if (options.subtitle) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(options.subtitle, marginLeft, cursorY);
    doc.setTextColor(0);
    cursorY += 16;
  }

  autoTable(doc, {
    startY: cursorY + 4,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) =>
      columns.map((c) => {
        const v = c.accessor(r);
        return v === null || v === undefined ? "" : String(v);
      }),
    ),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 4 },
    headStyles: {
      fillColor: [62, 136, 247], // Babun --accent
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [246, 246, 250] },
    columnStyles: columns.reduce<Record<number, Partial<{ halign: "left" | "right" | "center"; cellWidth: number }>>>(
      (acc, c, idx) => {
        const style: Partial<{ halign: "left" | "right" | "center"; cellWidth: number }> = {};
        if (c.align) style.halign = c.align;
        if (c.width !== undefined) style.cellWidth = c.width;
        if (Object.keys(style).length > 0) acc[idx] = style;
        return acc;
      },
      {},
    ),
    margin: { left: marginLeft, right: marginLeft },
  });

  if (options.footer) {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i += 1) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(160);
      doc.text(options.footer, marginLeft, doc.internal.pageSize.getHeight() - 24);
    }
  }

  const safeName = filename
    .replace(/[^a-z0-9_\-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  doc.save(`${safeName || "export"}.pdf`);
}

// ─── Finance preset ────────────────────────────────────────────────

export interface FinancePdfRow {
  dateKey: string;
  description: string;
  amount: number;
  teamName: string;
  type: "income" | "expense";
}

/** Default columns for the unified income+expense PDF — same five
 *  columns as the CSV preset so the two exports look identical
 *  when printed side by side. */
export const FINANCE_PDF_COLUMNS: PdfColumn<FinancePdfRow>[] = [
  { header: "Дата", accessor: (r) => r.dateKey, width: 70 },
  {
    header: "Тип",
    accessor: (r) => (r.type === "income" ? "Доход" : "Расход"),
    width: 55,
  },
  { header: "Команда", accessor: (r) => r.teamName, width: 100 },
  { header: "Описание", accessor: (r) => r.description },
  {
    header: "Сумма (€)",
    accessor: (r) => r.amount.toFixed(2),
    width: 70,
    align: "right",
  },
];
