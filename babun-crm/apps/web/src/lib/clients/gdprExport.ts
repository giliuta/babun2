// GDPR data-export — Sprint clients-99 (F3.4).
//
// EU customers can demand a copy of everything we store about them.
// This helper bundles a Client + their appointments into a single
// JSON blob and triggers a download. Includes a manifest header so a
// regulator can see exactly what fields were exported.

import type { Client } from "@babun/shared/local/clients";
import type { Appointment } from "@babun/shared/local/appointments";

interface ExportPayload {
  manifest: {
    schema_version: 1;
    exported_at: string;
    note: string;
  };
  client: Client;
  appointments: Appointment[];
}

function safeFilename(name: string): string {
  return (name || "client").replace(/[^A-Za-zА-Яа-я0-9_-]+/g, "_").slice(0, 60);
}

export function buildGdprPayload(
  client: Client,
  appointments: Appointment[],
): ExportPayload {
  return {
    manifest: {
      schema_version: 1,
      exported_at: new Date().toISOString(),
      note: "Personal-data export per GDPR art. 15. Contains every field stored in Babun CRM for this client + their appointment history. Tenant-scoped; no other clients leak.",
    },
    client,
    appointments: appointments.filter((a) => a.client_id === client.id),
  };
}

export function downloadGdprExport(
  client: Client,
  appointments: Appointment[],
): void {
  if (typeof window === "undefined") return;
  const payload = buildGdprPayload(client, appointments);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const today = new Date().toISOString().slice(0, 10);
  a.download = `gdpr-${safeFilename(client.full_name)}-${today}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Browsers keep the URL alive until garbage-collection; revoke
  // eagerly so memory doesn't pile up on bulk exports.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
