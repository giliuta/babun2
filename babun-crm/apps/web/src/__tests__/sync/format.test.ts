import { describe, it, expect } from "vitest";
import {
  labelForOp,
  relativeTime,
  pluralizeOps,
} from "@/lib/sync/format";

describe("sync/format — labelForOp", () => {
  it("maps every (table, op) tuple to a human RU label", () => {
    expect(labelForOp({ table: "clients", op: "insert" })).toBe(
      "Клиент / создание",
    );
    expect(labelForOp({ table: "clients", op: "update" })).toBe(
      "Клиент / обновление",
    );
    expect(labelForOp({ table: "clients", op: "delete" })).toBe(
      "Клиент / удаление",
    );
    expect(labelForOp({ table: "appointments", op: "insert" })).toBe(
      "Запись / создание",
    );
    expect(labelForOp({ table: "appointments", op: "update" })).toBe(
      "Запись / обновление",
    );
    expect(labelForOp({ table: "appointments", op: "delete" })).toBe(
      "Запись / удаление",
    );
    expect(labelForOp({ table: "tags", op: "insert" })).toBe("Тег / создание");
    expect(labelForOp({ table: "tags", op: "update" })).toBe("Тег / обновление");
    expect(labelForOp({ table: "tags", op: "delete" })).toBe("Тег / удаление");
  });
});

describe("sync/format — relativeTime", () => {
  const NOW = 1_000_000_000_000;

  it("returns «только что» for sub-minute diffs", () => {
    expect(relativeTime(NOW, NOW)).toBe("только что");
    expect(relativeTime(NOW - 30_000, NOW)).toBe("только что");
    expect(relativeTime(NOW - 59_999, NOW)).toBe("только что");
  });

  it("returns «N мин назад» for 1–59 minute diffs", () => {
    expect(relativeTime(NOW - 60_000, NOW)).toBe("1 мин назад");
    expect(relativeTime(NOW - 30 * 60_000, NOW)).toBe("30 мин назад");
    expect(relativeTime(NOW - 59 * 60_000, NOW)).toBe("59 мин назад");
  });

  it("returns «N ч назад» for 1–23 hour diffs", () => {
    expect(relativeTime(NOW - 60 * 60_000, NOW)).toBe("1 ч назад");
    expect(relativeTime(NOW - 23 * 60 * 60_000, NOW)).toBe("23 ч назад");
  });

  it("returns «N дн назад» for >=24 hour diffs", () => {
    expect(relativeTime(NOW - 24 * 60 * 60_000, NOW)).toBe("1 дн назад");
    expect(relativeTime(NOW - 7 * 24 * 60 * 60_000, NOW)).toBe("7 дн назад");
  });

  it("clamps negative diffs to «только что»", () => {
    // Clock skew between client + server can produce future timestamps;
    // the UI shouldn't show negative durations.
    expect(relativeTime(NOW + 60_000, NOW)).toBe("только что");
  });
});

describe("sync/format — pluralizeOps (RU)", () => {
  it("singular form for 1, 21, 31… (mod10=1, mod100!=11)", () => {
    expect(pluralizeOps(1)).toBe("операция");
    expect(pluralizeOps(21)).toBe("операция");
    expect(pluralizeOps(101)).toBe("операция");
    expect(pluralizeOps(1001)).toBe("операция");
  });

  it("few-form for 2–4, 22–24, 32–34…", () => {
    expect(pluralizeOps(2)).toBe("операции");
    expect(pluralizeOps(3)).toBe("операции");
    expect(pluralizeOps(4)).toBe("операции");
    expect(pluralizeOps(22)).toBe("операции");
    expect(pluralizeOps(103)).toBe("операции");
  });

  it("many-form for 0, 5–20, 25, 100", () => {
    expect(pluralizeOps(0)).toBe("операций");
    expect(pluralizeOps(5)).toBe("операций");
    expect(pluralizeOps(7)).toBe("операций");
    expect(pluralizeOps(11)).toBe("операций");
    expect(pluralizeOps(12)).toBe("операций");
    expect(pluralizeOps(13)).toBe("операций");
    expect(pluralizeOps(14)).toBe("операций");
    expect(pluralizeOps(20)).toBe("операций");
    expect(pluralizeOps(25)).toBe("операций");
    expect(pluralizeOps(100)).toBe("операций");
  });
});
