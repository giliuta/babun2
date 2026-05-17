"use client";

// F1.3 — Full-page CSV import wizard.
//
// Standalone counterpart to ImportClientsModal: same Upload → Mapping →
// Preview → Result state machine, but rendered as a full page instead
// of a centered overlay. Reached via /dashboard/clients/import (the
// modal is still wired to the import icon on /dashboard/clients).
//
// Logic mirrors ImportClientsModal so the modal stays untouched and
// keeps working from the clients list. If we ever consolidate, the
// modal can become `<Modal><ImportWizard onComplete={onClose}/></Modal>`.

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import {
  useClients,
  useTenantId,
} from "@/components/layout/DashboardClientLayout";
import { track } from "@/lib/analytics/track";
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

const STEP_SUBTITLES: Record<WizardStep, string> = {
  upload: "Шаг 1 из 4 — выберите CSV-файл",
  mapping: "Шаг 2 из 4 — сопоставьте колонки",
  preview: "Шаг 3 из 4 — проверьте перед импортом",
  result: "Шаг 4 из 4 — результат",
};

export function ImportWizard() {
  const router = useRouter();
  const tenantId = useTenantId();
  const { tags, reloadClients } = useClients();

  const [step, setStep] = useState<WizardStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<ImportableField[]>([]);
  const [countryCode, setCountryCode] = useState<CountryCode | string>(
    DEFAULT_COUNTRY,
  );
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [validation, setValidation] = useState<MapAndValidateResult | null>(
    null,
  );
  const [duplicateAction, setDuplicateAction] = useState<DuplicateAction>(
    "skip",
  );
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleParsed(f: File, p: ParsedFile) {
    setFile(f);
    setParsed(p);
    setMapping(autoMapHeaders(p.headers));
    track("clients.import_started", {
      fileName: f.name,
      rowCount: p.rows.length,
      encoding: p.encoding,
      source: "full_page",
    });
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
    track("clients.import_completed", {
      ok: r.inserted,
      skipped: r.skipped,
      errors: r.errors.length,
      source: "full_page",
    });
    void reloadClients();
  }

  function handleDone() {
    router.push("/dashboard/clients");
  }

  return (
    <>
      <PageHeader
        title="Импорт клиентов"
        subtitle={STEP_SUBTITLES[step]}
        backHref="/dashboard/clients"
      />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-lg mx-auto p-3 sm:p-5 pb-10 space-y-3">
          {step === "upload" && (
            <UploadStep
              onParsed={handleParsed}
              onCancel={() => router.push("/dashboard/clients")}
            />
          )}
          {step === "mapping" && parsed && file && (
            <MappingStep
              headers={parsed.headers}
              mapping={mapping}
              setMapping={setMapping}
              countryCode={countryCode}
              setCountryCode={setCountryCode}
              tags={tags.map((t) => ({
                id: t.id,
                name: t.name,
                color: t.color,
              }))}
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
              willImport={
                selectImportable(validation.mapped, duplicateAction).keep.length
              }
              willSkip={
                selectImportable(validation.mapped, duplicateAction).drop.length
              }
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
              onDone={handleDone}
            />
          )}
        </div>
      </div>
    </>
  );
}

export default ImportWizard;
