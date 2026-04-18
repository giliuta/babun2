// 0003_client_salutation: add optional salutation field to existing clients.
// salutation defaults to sms_name if present, otherwise empty string.

import { loadClients, saveClients } from "@/lib/clients";

export function migration0003ClientSalutation(): void {
  const clients = loadClients();
  let changed = false;

  const patched = clients.map((c) => {
    const raw = c as unknown as Record<string, unknown>;
    if (raw["salutation"] === undefined) {
      changed = true;
      return { ...c, salutation: c.sms_name ?? "" };
    }
    return c;
  });

  if (changed) saveClients(patched);
}
