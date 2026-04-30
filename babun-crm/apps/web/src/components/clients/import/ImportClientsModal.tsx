"use client";

import { useEffect, useState } from "react";
import { X } from "@babun/shared/icons";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useClients, useTenantId } from "@/components/layout/DashboardClientLayout";
import {
  autoMapHeaders,
  DEFAULT_COUNTRY,
  type CountryCode,
  type ImportableField,
} from "./csv-mapping";
import {
  mapAndValidate,
  selectImportable,
  type DuplicateAction,
  type MapAndValidateResult,
} from "./csv-validate";
import {
  fetchExistingPhones,
  importClients,
  type ImportProgress,
  type ImportResult,
} from "./csv-import";
import type { ParsedFile } from "./csv-parse";
import UploadStep from "./UploadStep";
import MappingStep from "./MappingStep";
import PreviewStep from "./PreviewStep";
import ResultStep from "./ResultStep";

type WizardStep = "upload" | "mapping" | "preview" | "result";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ImportClientsModal({ open, onClose }: Props) {
  const tenantId = useTenantId();
  const { tags, reloadClients } = useClients();
  const [step, setStep] = useState<WizardStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<ImportableField[]>([]);
  const [countryCode, setCountryCode] = useState<CountryCode | string>(DEFAULT_COUNTRY);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [validation, setValidation] = useState<MapAndValidateResult | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<DuplicateAction>("skip");
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  // Reset everything when the modal closes so the next open is clean.
  useEffect(() => {
    if (!open) {
      setStep("upload");
      setFile(null);
      setParsed(null);
      setMapping([]);
      setSelectedTagId(null);
      setValidation(null);
      setDuplicateAction("skip");
      setProgress(null);
      setResult(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleParsed(f: File, p: ParsedFile) {
    setFile(f);
    setParsed(p);
    setMapping(autoMapHeaders(p.headers));
    setStep("mapping");
  }

  async function handleMappingNext() {
    if (!parsed) return;
    const supabase = getSupabaseBrowser();
    const existing = await fetchExistingPhones(supabase, tenantId);
    const v = mapAndValidate({
      rows: parsed.rows,
      mapping,
      defaultCountry: countryCode,
      existingDbPhones: existing,
    });
    setValidation(v);
    setStep("preview");
  }

  async function handleConfirm() {
    if (!parsed || !validation || !file) return;
    const { keep } = selectImportable(validation.mapped, duplicateAction);
    setStep("result");
    setProgress(null);
    setResult(null);
    const supabase = getSupabaseBrowser();
    const r = await importClients({
      supabase,
      tenantId,
      rows: keep,
      tagId: selectedTagId,
      duplicateAction,
      fileHash: parsed.fileHash,
      fileName: file.name,
      onProgress: (p) => setProgress(p),
    });
    setResult(r);
    void reloadClients();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <header className="flex items-center justify-between px-5 py-4 border-b border-[var(--separator)]">
          <h2 className="text-[17px] font-semibold text-[var(--label)]">
            Импорт клиентов из CSV
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-[10px] text-[var(--label-tertiary)] active:bg-[var(--fill-quaternary)] flex items-center justify-center"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {step === "upload" && (
            <UploadStep onParsed={handleParsed} onCancel={onClose} />
          )}
          {step === "mapping" && parsed && file && (
            <MappingStep
              headers={parsed.headers}
              mapping={mapping}
              setMapping={setMapping}
              countryCode={countryCode}
              setCountryCode={setCountryCode}
              tags={tags.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
              selectedTagId={selectedTagId}
              setSelectedTagId={setSelectedTagId}
              encoding={parsed.encoding}
              fileName={file.name}
              rowCount={parsed.rows.length}
              onBack={() => setStep("upload")}
              onNext={() => void handleMappingNext()}
            />
          )}
          {step === "preview" && validation && (
            <PreviewStep
              validation={validation}
              duplicateAction={duplicateAction}
              setDuplicateAction={setDuplicateAction}
              willImport={selectImportable(validation.mapped, duplicateAction).keep.length}
              willSkip={selectImportable(validation.mapped, duplicateAction).drop.length}
              onBack={() => setStep("mapping")}
              onConfirm={() => void handleConfirm()}
            />
          )}
          {step === "result" && parsed && (
            <ResultStep
              progress={progress}
              result={result}
              rows={validation?.mapped ?? []}
              headers={parsed.headers}
              onDone={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
