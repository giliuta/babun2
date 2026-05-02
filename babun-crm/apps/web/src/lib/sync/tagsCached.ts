// STORY-054 G3b — offline-aware tag repository wrappers.
//
// Wraps the existing `listClientTags / createClientTag /
// updateClientTag / deleteClientTag` from `repositories/clients`.
//
// IMPORTANT — tag conflict detection is SKIPPED:
//   public.client_tags does not have an `updated_at` column. We
//   therefore can't issue UPDATE WHERE updated_at = $2 for last-
//   write-wins detection. All tag operations queue with
//   expected_updated_at: null → unconditional last-write-wins on
//   replay → no warning toast on tag conflicts.
//   Acceptable: tags are <100 rows per tenant and rarely change;
//   conflicts in practice are vanishingly rare. If we ever care,
//   add an updated_at column + trigger in a future migration.
//
// `client_tag_assignments` (the junction) is NOT cached either, see
// the cache layer header. Tag membership for a client therefore
// requires online connectivity to mutate.
//
// Decision #2 from G0: full re-pull on each sync (no `since`
// filter). Tags are <100 rows; the cost is sub-millisecond.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@babun/shared/db/database.types";
import {
  listClientTags as repoListClientTags,
  createClientTag as repoCreateClientTag,
  updateClientTag as repoUpdateClientTag,
  deleteClientTag as repoDeleteClientTag,
} from "@babun/shared/db/repositories/clients";
import type { ClientTag } from "@babun/shared/local/clients";
import {
  cacheRead,
  cacheUpsert,
  cacheDelete,
  cacheBulkUpsert,
  type CachedTag,
} from "@babun/shared/db/cache";
import { isOnline } from "./network";
import { kickReplayer } from "./replayer";
import { enqueueOpAndEmit as enqueueOp } from "./queue-events";

type DbSupabase = SupabaseClient<Database>;

// ─── Read ─────────────────────────────────────────────────────────

export async function listClientTags(
  supabase: DbSupabase,
  tenantId: string,
): Promise<ClientTag[]> {
  const cached = await safeCacheReadTags(tenantId);
  if (cached.length > 0) {
    void revalidateTags(supabase, tenantId);
    return cached.map(rowToTag);
  }
  // Cold cache. If offline, repoListClientTags will throw — we
  // catch and return empty. UI shows no tag chips until reconnect.
  try {
    const fresh = await repoListClientTags(supabase, tenantId);
    await refreshCacheFromSupabase(supabase, tenantId).catch(() => {});
    return fresh;
  } catch {
    return [];
  }
}

async function revalidateTags(
  supabase: DbSupabase,
  tenantId: string,
): Promise<void> {
  try {
    await refreshCacheFromSupabase(supabase, tenantId);
  } catch {
    /* ignore */
  }
}

async function refreshCacheFromSupabase(
  supabase: DbSupabase,
  tenantId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("client_tags")
    .select("*")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(`refreshTags: ${error.message}`);
  await cacheBulkUpsert("tags", (data ?? []) as CachedTag[]);
}

function rowToTag(r: CachedTag): ClientTag {
  return { id: r.id, name: r.name, color: r.color };
}

// ─── Write ────────────────────────────────────────────────────────

export async function createClientTag(
  supabase: DbSupabase,
  input: { name: string; color: string },
  tenantId: string,
): Promise<ClientTag> {
  const id =
    typeof crypto !== "undefined" ? crypto.randomUUID() : `tmp_${Date.now()}`;
  const optimisticRow: CachedTag = {
    id,
    tenant_id: tenantId,
    name: input.name,
    color: input.color,
  };
  await cacheUpsert("tags", optimisticRow);

  if (isOnline()) {
    try {
      const created = await repoCreateClientTag(supabase, input, tenantId);
      // Server-generated id wins. Replace the optimistic row with
      // the canonical one (delete the temp + insert the real).
      if (created.id !== id) {
        await cacheDelete("tags", id);
      }
      await cacheUpsert("tags", {
        id: created.id,
        tenant_id: tenantId,
        name: created.name,
        color: created.color,
      });
      return created;
    } catch (err) {
      void err;
      await enqueueOp({
        table: "tags",
        op: "insert",
        row_id: id,
        payload: optimisticRow as unknown as Record<string, unknown>,
        expected_updated_at: null,
      });
      void kickReplayer({ supabase });
      return { id, name: input.name, color: input.color };
    }
  }

  await enqueueOp({
    table: "tags",
    op: "insert",
    row_id: id,
    payload: optimisticRow as unknown as Record<string, unknown>,
    expected_updated_at: null,
  });
  return { id, name: input.name, color: input.color };
}

export async function updateClientTag(
  supabase: DbSupabase,
  id: string,
  patch: { name?: string; color?: string },
  tenantId: string,
): Promise<ClientTag> {
  const existing = await readCachedTag(id);
  if (existing) {
    await cacheUpsert("tags", { ...existing, ...patch });
  }

  if (isOnline()) {
    try {
      const updated = await repoUpdateClientTag(supabase, id, patch, tenantId);
      await cacheUpsert("tags", {
        id: updated.id,
        tenant_id: tenantId,
        name: updated.name,
        color: updated.color,
      });
      return updated;
    } catch (err) {
      void err;
      await enqueueOp({
        table: "tags",
        op: "update",
        row_id: id,
        payload: patch as Record<string, unknown>,
        expected_updated_at: null, // no updated_at column → no detection
      });
      void kickReplayer({ supabase });
      return {
        id,
        name: patch.name ?? existing?.name ?? "",
        color: patch.color ?? existing?.color ?? "",
      };
    }
  }

  await enqueueOp({
    table: "tags",
    op: "update",
    row_id: id,
    payload: patch as Record<string, unknown>,
    expected_updated_at: null,
  });
  return {
    id,
    name: patch.name ?? existing?.name ?? "",
    color: patch.color ?? existing?.color ?? "",
  };
}

export async function deleteClientTag(
  supabase: DbSupabase,
  id: string,
  tenantId: string,
): Promise<void> {
  await cacheDelete("tags", id);

  if (isOnline()) {
    try {
      await repoDeleteClientTag(supabase, id, tenantId);
      return;
    } catch {
      // fall through to queue
    }
  }
  await enqueueOp({
    table: "tags",
    op: "delete",
    row_id: id,
    payload: { id, tenant_id: tenantId },
    expected_updated_at: null,
  });
  if (isOnline()) void kickReplayer({ supabase });
}

// ─── Helpers ──────────────────────────────────────────────────────

async function safeCacheReadTags(tenantId: string): Promise<CachedTag[]> {
  try {
    return await cacheRead<CachedTag>("tags", tenantId);
  } catch {
    return [];
  }
}

async function readCachedTag(id: string): Promise<CachedTag | null> {
  try {
    const { getCache } = await import("@babun/shared/db/cache");
    const db = await getCache();
    const row = await db.get("tags", id);
    return row ?? null;
  } catch {
    return null;
  }
}
