"use client";

import type { DuplicateAction, MapAndValidateResult, MappedRow } from "./csv-validate";

interface PreviewStepProps {
  validation: MapAndValidateResult;
  duplicateAction: DuplicateAction;
  setDuplicateAction: (next: DuplicateAction) => void;
  willImport: number;
  willSkip: number;
  onBack: () => void;
  onConfirm: () => void;
}

const REASON_COLOR: Record<string, string> = {
  "пустое имя": "var(--system-red)",
  "битый телефон": "var(--system-red)",
  "дубликат внутри файла": "var(--system-orange)",
  "дубликат в БД": "var(--system-orange)",
};

export default function PreviewStep({
  validation,
  duplicateAction,
  setDuplicateAction,
  willImport,
  willSkip,
  onBack,
  onConfirm,
}: PreviewStepProps) {
  const sample: MappedRow[] = validation.mapped.slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-2">
        <div className="text-[15px] font-semibold text-[var(--label)]">
          Будет импортировано: {willImport}
        </div>
        <div className="text-[13px] text-[var(--label-secondary)] leading-snug">
          Пропущено: {willSkip}
          {validation.emptyName > 0 && (
            <span> · {validation.emptyName} пустое имя</span>
          )}
          {validation.badPhone > 0 && (
            <span> · {validation.badPhone} битый телефон</span>
          )}
          {validation.duplicateInFile > 0 && (
            <span> · {validation.duplicateInFile} дубликат внутри файла</span>
          )}
          {validation.duplicateInDb > 0 && (
            <span> · {validation.duplicateInDb} уже есть в БД</span>
          )}
        </div>
      </div>

      {validation.duplicateInDb > 0 && (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-2">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
            Что делать с дубликатами в БД
          </div>
          <div className="space-y-1">
            <DupRadio
              checked={duplicateAction === "skip"}
              onChange={() => setDuplicateAction("skip")}
              label="Пропустить (рекомендуется)"
            />
            <DupRadio
              checked={duplicateAction === "overwrite"}
              onChange={() => setDuplicateAction("overwrite")}
              label="Перезаписать существующих"
            />
            <DupRadio
              checked={duplicateAction === "import_as_dup"}
              onChange={() => setDuplicateAction("import_as_dup")}
              label="Импортировать дубликатом"
            />
          </div>
        </div>
      )}

      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-2">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
          Превью первых 10 строк
        </div>
        <div className="divide-y divide-[var(--separator)]">
          {sample.map((row) => (
            <div key={row.source} className="py-2">
              <div className="flex items-baseline gap-2">
                <span className="text-[12px] text-[var(--label-tertiary)] tabular-nums">
                  #{row.source}
                </span>
                <span className="text-[14px] font-medium text-[var(--label)] truncate">
                  {row.full_name || "—"}
                </span>
                {row.phone && (
                  <span className="text-[12px] text-[var(--label-secondary)] tabular-nums">
                    {row.phone}
                  </span>
                )}
              </div>
              {row.reasons.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {row.reasons.map((reason) => (
                    <span
                      key={reason}
                      className="text-[11px] font-medium px-2 py-0.5 rounded-[6px]"
                      style={{
                        color: REASON_COLOR[reason] ?? "var(--label-secondary)",
                        background: "rgba(0,0,0,0.04)",
                      }}
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

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
          onClick={onConfirm}
          disabled={willImport === 0}
          className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] active:bg-[var(--accent-pressed)] transition"
        >
          Импортировать {willImport}
        </button>
      </div>
    </div>
  );
}

function DupRadio({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 py-1 cursor-pointer">
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="accent-[var(--accent)]"
      />
      <span className="text-[14px] text-[var(--label)]">{label}</span>
    </label>
  );
}
