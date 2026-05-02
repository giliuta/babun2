// STORY-054 G7 — pure formatters for the SyncQueuePanel UI.
// Extracted so the RU pluralization rule + relative-time + op
// labelling can be tested in isolation without spinning up jsdom +
// IndexedDB. Adding a new table or op verb stays a single-file
// edit + a corresponding test case.

import type { QueuedOp } from "@babun/shared/db/cache";

export function labelForOp(op: Pick<QueuedOp, "table" | "op">): string {
  const noun =
    op.table === "clients"
      ? "Клиент"
      : op.table === "appointments"
        ? "Запись"
        : "Тег";
  const verb =
    op.op === "insert"
      ? "создание"
      : op.op === "update"
        ? "обновление"
        : "удаление";
  return `${noun} / ${verb}`;
}

export function relativeTime(ms: number, nowMs: number = Date.now()): string {
  const diff = Math.max(0, nowMs - ms);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ч назад`;
  const days = Math.floor(hrs / 24);
  return `${days} дн назад`;
}

export function pluralizeOps(n: number): string {
  // RU: 1 операция, 2-4 операции, 5+ операций. The mod-100 carve-out
  // covers 11-14 which are «-надцать» nouns and always use the
  // many-form regardless of the last digit.
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "операция";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return "операции";
  return "операций";
}
