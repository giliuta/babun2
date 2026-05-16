// v559 §3.12 — CSV export helpers.

import { describe, it, expect } from "vitest";
import { buildCsv, FINANCE_CSV_COLUMNS } from "@/lib/finance/csv-export";

describe("buildCsv", () => {
  it("emits BOM + CRLF + quoted fields", () => {
    const csv = buildCsv(
      [
        { header: "Имя", accessor: (r: { name: string }) => r.name },
        { header: "Цена", accessor: (r: { price: number }) => r.price },
      ],
      [{ name: "Иван", price: 100 }],
    );
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("\"Имя\";\"Цена\"");
    expect(csv).toContain("\"Иван\";\"100\"");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("escapes embedded quotes by doubling them", () => {
    const csv = buildCsv(
      [{ header: "Имя", accessor: (r: { name: string }) => r.name }],
      [{ name: "Иван \"Кузнец\"" }],
    );
    expect(csv).toContain("\"Иван \"\"Кузнец\"\"\"");
  });

  it("handles null / undefined as empty quoted field", () => {
    const csv = buildCsv(
      [{ header: "Сумма", accessor: () => null }],
      [{}],
    );
    expect(csv).toContain("\"\"");
  });

  it("finance preset columns are five and in canonical order", () => {
    expect(FINANCE_CSV_COLUMNS.map((c) => c.header)).toEqual([
      "Дата",
      "Тип",
      "Команда",
      "Описание",
      "Сумма (€)",
    ]);
  });
});
