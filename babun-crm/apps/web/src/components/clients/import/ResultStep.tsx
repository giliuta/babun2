"use client";

import { Check, AlertTriangle } from "@babun/shared/icons";
import type { ImportError, ImportProgress, ImportResult } from "./csv-import";
import type { MappedRow } from "./csv-validate";

interface ResultStepProps {
  progress: ImportProgress | null;
  result: ImportResult | null;
  /** Original validated rows so we can build the errors-CSV download. */
  rows: MappedRow[];
  /** Original parsed-file headers, for the errors-CSV header line. */
  headers: string[];
  onDone: () => void;
}

export default function ResultStep({
  progress,
  result,
  rows,
  headers,
  onDone,
}: ResultStepProps) {
  if (!result) {
    const pct = progress
      ? Math.round((progress.batchIndex / progress.totalBatches) * 100)
      : 0;
    return (
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-5 space-y-3">
        <div className="text-[15px] font-semibold text-[var(--label)]">
          Импортируем…
        </div>
        <div className="h-2 rounded-full bg-[var(--fill-tertiary)] overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-[12px] text-[var(--label-tertiary)] tabular-nums">
          {progress
            ? `${progress.insertedSoFar} / ${rows.length} клиентов`
            : "Подготавливаем данные…"}
        </div>
      </div>
    );
  }

  const hasErrors = result.errors.length > 0;

  return (
    <div className="space-y-4">
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-5 space-y-3">
        <div className="flex items-center gap-2 text-[var(--system-green)]">
          <Check size={20} />
          <h2 className="text-[17px] font-semibold">Импорт завершён</h2>
        </div>
        <p className="text-[14px] text-[var(--label-secondary)] leading-snug">
          Импортировано: <span className="font-semibold text-[var(--label)]">{result.inserted}</span>
          {result.skipped > 0 && (
            <>
              {" · "}
              Пропущено:{" "}
              <span className="font-semibold text-[var(--label)]">{result.skipped}</span>
            </>
          )}
        </p>
        {hasErrors && (
          <div className="flex gap-2 items-start text-[13px] text-[var(--system-orange)] leading-snug">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>
              {result.errors.length} строк не прошли. Скачайте список ошибок ниже.
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {hasErrors && (
          <button
            type="button"
            onClick={() => downloadErrorsCsv(headers, rows, result.errors)}
            className="flex-1 h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--label)] text-[15px] font-medium active:bg-[var(--fill-secondary)] transition"
          >
            Скачать ошибки CSV
          </button>
        )}
        <button
          type="button"
          onClick={onDone}
          className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] transition"
        >
          Готово
        </button>
      </div>
    </div>
  );
}

function downloadErrorsCsv(
  headers: string[],
  rows: MappedRow[],
  errors: ImportError[],
): void {
  const errorBySource = new Map<number, string>();
  for (const e of errors) errorBySource.set(e.source, e.reason);

  const out: string[][] = [];
  out.push([...headers, "_error"]);
  for (const row of rows) {
    const reason = errorBySource.get(row.source);
    if (!reason) continue;
    out.push([
      row.full_name,
      row.phone,
      row.email,
      row.comment,
      row.address,
      reason,
    ]);
  }
  const csv = out
    .map((line) =>
      line
        .map((cell) => {
          const s = (cell ?? "").toString();
          // Escape quotes and wrap with quotes if needed.
          if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(","),
    )
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "import-errors.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
