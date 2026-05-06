// STORY-046 — Batch INSERT for CSV-imported clients.
//
// Runs entirely client-side via the user-scoped Supabase client.
// RLS gates everything: the clients_insert_owner_or_dispatcher policy
// rejects Master callers with 42501; cross-tenant writes are blocked
// by the WITH CHECK clause on tenant_id.
//
// Batch size 500 — sweet spot per architect call: 5000 rows = 10
// round-trips at ~150ms each = ~1.5s total, comfortably within
// Supabase's 1MB request body limit (avg ~50KB/batch for our shape).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@babun/shared/db/database.types";
import type { DuplicateAction, MappedRow } from "./csv-validate";
import {
  clearResumeState,
  saveResumeState,
  type ImportResumeState,
} from "./csv-resume";
import { fetchRemainingQuota, QuotaExceededError } from "@/lib/quota/check";

type DbSupabase = SupabaseClient<Database>;
type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];

const BATCH_SIZE = 500;

export interface ImportProgress {
  batchIndex: number;
  totalBatches: number;
  insertedSoFar: number;
}

export interface ImportError {
  source: number;
  reason: string;
}

export interface ImportResult {
  inserted: number;
  skipped: number;
  errors: ImportError[];
}

export interface ImportClientsArgs {
  supabase: DbSupabase;
  tenantId: string;
  rows: MappedRow[];
  /** Optional client_tags.id to assign to every imported client. */
  tagId: string | null;
  duplicateAction: DuplicateAction;
  /** File-level metadata for the resume state. */
  fileHash: string;
  fileName: string;
  /** Resume from this batch index (inclusive). 0 = full run. */
  startBatchIndex?: number;
  onProgress?: (p: ImportProgress) => void;
}

function rowToInsert(tenantId: string, row: MappedRow): ClientInsert {
  return {
    tenant_id: tenantId,
    full_name: row.full_name,
    phone: row.phone,
    email: row.email,
    comment: row.comment,
    address: row.address,
  };
}

export async function importClients(
  args: ImportClientsArgs,
): Promise<ImportResult> {
  const {
    supabase,
    tenantId,
    rows,
    tagId,
    duplicateAction,
    fileHash,
    fileName,
    startBatchIndex = 0,
    onProgress,
  } = args;

  const errors: ImportError[] = [];
  let insertedTotal = 0;

  // STORY-079 — quota gate. Refuse the whole import if it would push
  // the tenant past their `clients` quota. Counts only NEW inserts
  // (overwrite-mode duplicates don't add to count). Conservative —
  // for `skip` / `overwrite` modes we still gate on the worst case
  // (all rows are new).
  if (rows.length > 0 && startBatchIndex === 0) {
    try {
      const remaining = await fetchRemainingQuota(supabase, tenantId, "clients");
      if (rows.length > remaining) {
        throw new QuotaExceededError(
          "clients",
          // current + (rows.length - remaining new rows)
          0,
          remaining + rows.length, // values not surfaced; message is what matters
        );
      }
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        throw err;
      }
      // Quota lookup failed — fail-open with a warning rather than
      // refusing the import for a transient blip. The per-row INSERTs
      // remain RLS-protected.
      // eslint-disable-next-line no-console
      console.warn("csv-import: quota check failed, continuing", err);
    }
  }

  // Slice into batches of BATCH_SIZE so we can save resume state
  // between batches.
  const batches: MappedRow[][] = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    batches.push(rows.slice(i, i + BATCH_SIZE));
  }
  const totalBatches = batches.length;

  for (let bi = startBatchIndex; bi < batches.length; bi++) {
    const batch = batches[bi];
    if (duplicateAction === "overwrite") {
      // For overwrite, find existing-by-phone and update; else insert.
      // Done per-batch to keep the round-trip story uniform.
      const phones = batch.map((r) => r.phone).filter(Boolean);
      const { data: existing } = await supabase
        .from("clients")
        .select("id, phone")
        .eq("tenant_id", tenantId)
        .in("phone", phones);
      const existingByPhone = new Map<string, string>();
      for (const c of existing ?? []) {
        if (c.phone) existingByPhone.set(c.phone, c.id);
      }
      const inserts: ClientInsert[] = [];
      const updateIds: { id: string; row: MappedRow }[] = [];
      for (const row of batch) {
        const exId = row.phone ? existingByPhone.get(row.phone) : undefined;
        if (exId) updateIds.push({ id: exId, row });
        else inserts.push(rowToInsert(tenantId, row));
      }
      if (inserts.length > 0) {
        const { data: inserted, error } = await supabase
          .from("clients")
          .insert(inserts)
          .select("id, phone");
        if (error) {
          for (const r of batch) {
            errors.push({ source: r.source, reason: error.message });
          }
        } else {
          insertedTotal += (inserted ?? []).length;
          if (tagId && inserted && inserted.length > 0) {
            await assignTag(supabase, tenantId, inserted.map((c) => c.id), tagId);
          }
        }
      }
      for (const upd of updateIds) {
        const { error } = await supabase
          .from("clients")
          .update({
            full_name: upd.row.full_name,
            email: upd.row.email,
            comment: upd.row.comment,
            address: upd.row.address,
          })
          .eq("id", upd.id)
          .eq("tenant_id", tenantId);
        if (error) errors.push({ source: upd.row.source, reason: error.message });
        else if (tagId) await assignTag(supabase, tenantId, [upd.id], tagId);
      }
    } else {
      // skip + import_as_dup both follow the same INSERT path. The
      // selectImportable() upstream already filtered out skip cases.
      const inserts = batch.map((r) => rowToInsert(tenantId, r));
      const { data, error } = await supabase
        .from("clients")
        .insert(inserts)
        .select("id");
      if (error) {
        for (const r of batch) {
          errors.push({ source: r.source, reason: error.message });
        }
      } else {
        insertedTotal += (data ?? []).length;
        if (tagId && data && data.length > 0) {
          await assignTag(supabase, tenantId, data.map((c) => c.id), tagId);
        }
      }
    }

    onProgress?.({
      batchIndex: bi + 1,
      totalBatches,
      insertedSoFar: insertedTotal,
    });

    // Persist resume state after each successful batch.
    const resumeState: ImportResumeState = {
      fileHash,
      fileName,
      totalRows: rows.length,
      importedRows: insertedTotal,
      totalBatches,
      lastBatchIndex: bi + 1,
      timestamp: Date.now(),
    };
    saveResumeState(resumeState);
  }

  // Done — clear resume state.
  clearResumeState();

  return {
    inserted: insertedTotal,
    skipped: rows.length - insertedTotal,
    errors,
  };
}

async function assignTag(
  supabase: DbSupabase,
  tenantId: string,
  clientIds: string[],
  tagId: string,
): Promise<void> {
  if (clientIds.length === 0) return;
  const rows = clientIds.map((id) => ({
    tenant_id: tenantId,
    client_id: id,
    tag_id: tagId,
  }));
  // Best-effort: don't fail the whole import if a tag link errors.
  await supabase.from("client_tag_assignments").insert(rows);
}

/** Pre-import: fetch all phones in this tenant so we can detect
 *  duplicates against the DB during the preview step. Chunked at 1000
 *  via PostgREST default range to avoid huge single requests. */
export async function fetchExistingPhones(
  supabase: DbSupabase,
  tenantId: string,
): Promise<Set<string>> {
  const phones = new Set<string>();
  let from = 0;
  const chunk = 1000;
  // Loop until we get fewer than `chunk` rows back.
  // Cap at 50k clients per tenant to be safe — no real tenant is near
  // that today.
  for (let safety = 0; safety < 50; safety++) {
    const { data, error } = await supabase
      .from("clients")
      .select("phone")
      .eq("tenant_id", tenantId)
      .range(from, from + chunk - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    for (const c of data) {
      if (c.phone) phones.add(c.phone);
    }
    if (data.length < chunk) break;
    from += chunk;
  }
  return phones;
}
