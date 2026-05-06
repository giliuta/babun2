"use client";

import { useRef, useState } from "react";
import { CloudUpload, AlertTriangle } from "@babun/shared/icons";
import { parseCsvFile } from "./csv-parse";
import type { ParsedFile } from "./csv-parse";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_ROWS = 5000;
const ALLOWED = [".csv", ".txt"];

interface UploadStepProps {
  onParsed: (file: File, parsed: ParsedFile) => void;
  onCancel: () => void;
}

export default function UploadStep({ onParsed, onCancel }: UploadStepProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(`Файл больше 10 МБ — пересохрани как CSV без лишних колонок.`);
      return;
    }
    const lower = file.name.toLowerCase();
    if (!ALLOWED.some((ext) => lower.endsWith(ext))) {
      setError("Только .csv или .txt файлы.");
      return;
    }
    setBusy(true);
    try {
      const parsed = await parseCsvFile(file);
      if (parsed.rows.length === 0) {
        setError("Файл пустой или нет строк данных (только заголовок).");
        return;
      }
      if (parsed.rows.length > MAX_ROWS) {
        setError(
          `Слишком много строк (${parsed.rows.length}). Максимум ${MAX_ROWS} за раз — раздели файл на части.`,
        );
        return;
      }
      onParsed(file, parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось прочитать файл.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-2xl p-6 text-center transition ${
          dragOver
            ? "border-[var(--accent)] bg-[var(--accent-tint)]"
            : "border-[var(--separator)] bg-[var(--surface-card)]"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
      >
        <CloudUpload size={36} className="mx-auto text-[var(--label-secondary)]" />
        <p className="mt-2 text-[14px] text-[var(--label)]">
          Перетащите CSV сюда или
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="mt-3 h-11 px-5 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] transition"
        >
          {busy ? "Читаем…" : "Выбрать файл"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <p className="mt-3 text-[12px] text-[var(--label-tertiary)]">
          До 10 МБ, до 5000 строк. Кириллица — UTF-8 или Windows-1251.
        </p>
      </div>

      {error && (
        <div className="flex gap-2 items-start text-[13px] text-[var(--system-red)] leading-snug bg-[rgba(255,59,48,0.10)] border border-[rgba(255,59,48,0.30)] rounded-[10px] px-3 py-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex-1 h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--label)] text-[15px] font-medium active:bg-[var(--fill-secondary)] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] transition"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
