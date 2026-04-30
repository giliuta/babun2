"use client";

import {
  COUNTRY_CODES,
  FIELD_LABEL,
  FIELD_OPTIONS,
  type CountryCode,
  type ImportableField,
} from "./csv-mapping";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface MappingStepProps {
  headers: string[];
  mapping: ImportableField[];
  setMapping: (next: ImportableField[]) => void;
  countryCode: CountryCode | string;
  setCountryCode: (next: CountryCode | string) => void;
  tags: Tag[];
  selectedTagId: string | null;
  setSelectedTagId: (id: string | null) => void;
  encoding: "utf-8" | "windows-1251";
  fileName: string;
  rowCount: number;
  onBack: () => void;
  onNext: () => void;
}

export default function MappingStep({
  headers,
  mapping,
  setMapping,
  countryCode,
  setCountryCode,
  tags,
  selectedTagId,
  setSelectedTagId,
  encoding,
  fileName,
  rowCount,
  onBack,
  onNext,
}: MappingStepProps) {
  const hasName = mapping.some((f) => f === "full_name");

  return (
    <div className="space-y-4">
      <div className="text-[12px] text-[var(--label-secondary)] leading-snug">
        Файл: <span className="font-medium text-[var(--label)]">{fileName}</span>
        {" · "}
        {rowCount} строк
        {encoding === "windows-1251" && (
          <span className="ml-1 text-[var(--system-orange)]">
            · кодировка Windows-1251
          </span>
        )}
      </div>

      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] divide-y divide-[var(--separator)]">
        {headers.map((header, idx) => (
          <div key={idx} className="flex items-center gap-3 px-4 py-3 min-h-[56px]">
            <div className="flex-1 min-w-0">
              <div className="text-[14px] text-[var(--label)] truncate">
                {header || `(колонка ${idx + 1})`}
              </div>
            </div>
            <select
              value={mapping[idx] ?? "skip"}
              onChange={(e) => {
                const next = [...mapping];
                next[idx] = e.target.value as ImportableField;
                setMapping(next);
              }}
              className="h-9 px-2 rounded-[8px] border border-[var(--separator)] text-[13px] bg-[var(--surface-card)]"
            >
              {FIELD_OPTIONS.map((field) => (
                <option key={field} value={field}>
                  {FIELD_LABEL[field]}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-3">
        <label className="block">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1">
            Код страны для телефонов без +
          </div>
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="w-full h-11 px-3 bg-[var(--fill-tertiary)] rounded-[10px] text-[15px] text-[var(--label)]"
          >
            {COUNTRY_CODES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1">
            Тег для всех импортированных
          </div>
          <select
            value={selectedTagId ?? ""}
            onChange={(e) => setSelectedTagId(e.target.value || null)}
            className="w-full h-11 px-3 bg-[var(--fill-tertiary)] rounded-[10px] text-[15px] text-[var(--label)]"
          >
            <option value="">— нет —</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!hasName && (
        <div className="text-[13px] text-[var(--system-orange)] leading-snug bg-[rgba(255,149,0,0.10)] border border-[rgba(255,149,0,0.30)] rounded-[10px] px-3 py-2">
          Колонка ФИО обязательна — выберите хотя бы одну.
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--label)] text-[15px] font-medium active:bg-[var(--fill-secondary)] transition"
        >
          ← Назад
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasName}
          className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold disabled:opacity-40 active:bg-[var(--accent-pressed)] transition"
        >
          Дальше
        </button>
      </div>
    </div>
  );
}
