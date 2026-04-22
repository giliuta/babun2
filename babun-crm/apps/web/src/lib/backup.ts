// Full-app backup / restore for localStorage-backed data.
//
// Sprint 033 — before the big Supabase migration lands, the user needs
// a way to carry data between devices and to roll back if anything
// goes sideways during the refactor. exportBackup() snapshots every
// key the app writes (both the legacy `babun-*` prefix and the
// settings-family `babun2:*` prefix) into one JSON payload.
// importBackup() restores it verbatim.
//
// The file is a plain JSON object — no compression, no transforms. A
// power user can open it in a text editor, tweak a field, and load it
// back if needed.

export interface BackupPayload {
  version: 1;
  exported_at: string;
  app_version?: string;
  data: Record<string, unknown>;
}

const KEY_PREFIXES = ["babun-", "babun2:"];

function isBackupKey(key: string): boolean {
  return KEY_PREFIXES.some((p) => key.startsWith(p));
}

/**
 * Collect every localStorage key belonging to the app into a single
 * payload. Values are parsed as JSON where possible; raw strings are
 * preserved untouched for forward compatibility.
 */
export function exportBackup(appVersion?: string): BackupPayload {
  if (typeof window === "undefined") {
    return { version: 1, exported_at: new Date().toISOString(), data: {} };
  }
  const data: Record<string, unknown> = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !isBackupKey(key)) continue;
    const raw = window.localStorage.getItem(key);
    if (raw === null) continue;
    try {
      data[key] = JSON.parse(raw);
    } catch {
      data[key] = raw;
    }
  }
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    app_version: appVersion,
    data,
  };
}

/**
 * Write a previously-exported backup back into localStorage. Existing
 * keys that aren't in the backup are left alone (so a partial export
 * merges rather than wipes). To wipe first, call `clearBackup()`.
 */
export function importBackup(payload: BackupPayload): {
  restored: number;
  skipped: number;
} {
  if (typeof window === "undefined") return { restored: 0, skipped: 0 };
  if (!payload || payload.version !== 1 || !payload.data) {
    throw new Error("Файл бэкапа повреждён или имеет неверный формат.");
  }
  let restored = 0;
  let skipped = 0;
  for (const [key, value] of Object.entries(payload.data)) {
    if (!isBackupKey(key)) {
      skipped++;
      continue;
    }
    try {
      const raw = typeof value === "string" ? value : JSON.stringify(value);
      window.localStorage.setItem(key, raw);
      restored++;
    } catch {
      skipped++;
    }
  }
  return { restored, skipped };
}

/**
 * Wipe every app-owned localStorage key. Destructive — always ask
 * the user to confirm before calling.
 */
export function clearBackup(): number {
  if (typeof window === "undefined") return 0;
  const toRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && isBackupKey(key)) toRemove.push(key);
  }
  for (const key of toRemove) window.localStorage.removeItem(key);
  return toRemove.length;
}

/** Download the backup as a .json file via anchor click. */
export function downloadBackup(payload: BackupPayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `babun-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Parse a File (from <input type="file">) into a BackupPayload. */
export async function readBackupFile(file: File): Promise<BackupPayload> {
  const text = await file.text();
  const parsed = JSON.parse(text) as BackupPayload;
  return parsed;
}
