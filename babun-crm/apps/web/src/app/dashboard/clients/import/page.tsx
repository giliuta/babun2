"use client";

// clients-99 F1.3 — full-page CSV import wizard.
//
// Replaces the STORY-059 stub with a wizard that wraps the same
// state machine ImportClientsModal uses (Upload → Mapping → Preview
// → Result). Reuses PapaParse, dedup by phone, supabase bulk insert,
// resume-state in localStorage.

import { ImportWizard } from "@/components/clients/import/ImportWizard";

export default function ClientsImportPage() {
  return <ImportWizard />;
}
