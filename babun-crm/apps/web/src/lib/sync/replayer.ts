// STORY-054 G2 — sync queue replayer.
//
// Drains the IndexedDB sync_queue once we're online + idle. Each op
// is dispatched to the matching repository with the row's
// `expected_updated_at` for last-write-wins conflict detection. On
// 0-rows-affected (server moved on) we toast a warning and re-issue
// the UPDATE without the updated_at filter; the local edit wins.
//
// Retry policy: exponential backoff per op — 1s, 5s, 30s. After 3
// attempts the op stays in the queue with `last_error` set so the
// sidebar badge can surface "1 запись с ошибкой" + the user can
// manually retry from the SyncQueuePanel.
//
// Trigger sources (any of these starts a drain):
//   1. `online` event listener (network.ts)
//   2. `useRealtimeTenantSync.onResync()` callback — fires on
//      Supabase channel reconnect, which also indicates network
//      recovered. Reusing this avoids a duplicate listener.
//   3. Manual: user taps "Попробовать снова" in SyncQueuePanel
//   4. Programmatic: `kickReplayer()` after enqueueOp returns from
//      a write that thought it was online but got a 5xx mid-flight
//
// Single-flight: a drain in progress sets a module-level lock. New
// triggers arriving during the drain set `pendingFollowup` (boolean,
// not a counter) — meaning at most ONE additional pass is queued.
// Subsequent triggers during that follow-up are ignored; if they
// genuinely needed action, the next external event (online / onResync
// / manual retry / kickReplayer call) will re-trigger. Keeps us from
// ddosing Supabase on event storms.
//
// Cache freshness after a conflict-forced UPDATE: when the server
// "won" the conflict but our local copy still applied (force-update),
// we re-fetch the row via .select().single() and call cacheUpsert
// with the returned shape. Without this, IDB carries the
// pre-conflict updated_at and would falsely conflict again on the
// next edit.
//
// Stale-while-revalidate failure mode: if a drain partially fails
// (some ops moved on, some stuck on retry), the local cache may
// hold a row whose updated_at no longer matches the server. The
// next reconnect / onResync will re-pull, fixing the drift. Until
// then a stale view is acceptable. Pull-to-refresh (parked under
// STORY-053c) will become the explicit user-triggered recovery for
// clients/calendar list pages. Not a v1 blocker.
//
// `client_tag_assignments` is intentionally NOT cached. The junction
// table is tightly coupled to client + tag rows on the server; ON
// DELETE CASCADE keeps it consistent without our help. Realtime
// propagates assignment changes to subscribed clients; the cache
// layer never sees them, and the sync queue only carries
// clients / appointments / tags ops.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@babun/shared/db/database.types";
import {
  dequeueAll,
  cacheUpsert,
  cacheDelete,
  type QueuedOp,
  type CachedTable,
} from "@babun/shared/db/cache";
// G4 — go through the emit-wrappers so the OfflineIndicator badge
// updates the moment the replayer succeeds/fails an op, instead of
// waiting for the 5-s safety poll.
import {
  removeOpAndEmit as removeOp,
  bumpAttemptAndEmit as bumpAttempt,
  markOpPermanentlyFailedAndEmit,
} from "./queue-events";
// STORY-052 G4 — quota gate for offline replay. Prevents an offline
// burst from over-quota'ing the tenant when the queue drains. Path B
// in the story doc; Path C (Postgres BEFORE INSERT trigger) is logged
// for STORY-052b as the defense-in-depth covering any PostgREST
// writer (not just our app code).
import {
  assertQuotaAvailable,
  QuotaExceededError,
} from "@/lib/quota/check";

const QUOTA_TABLES = new Set<CachedTable>(["clients", "appointments"]);

// v452 — every cached table targets a Supabase relation whose `id`
// column is uuid. Ops carrying a non-uuid `row_id` are local orphans
// (insert never succeeded server-side — typically because the row
// included a column the migration hadn't reached yet). Replaying
// them spends three retry windows on guaranteed-failure ops and
// surfaces an unactionable error in SyncQueuePanel. Detect them up
// front and mark them permanently failed so the user can drop them
// from the panel.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s: string): boolean => UUID_RE.test(s);

function tableToQuotaKind(
  t: CachedTable,
): "clients" | "appointments_month" | null {
  if (t === "clients") return "clients";
  if (t === "appointments") return "appointments_month";
  return null;
}

type DbSupabase = SupabaseClient<Database>;

const MAX_ATTEMPTS = 3;
const BACKOFFS_MS = [1000, 5000, 30000]; // attempts 1, 2, 3

type Toast = (msg: string) => void;

interface ReplayerOptions {
  supabase: DbSupabase;
  /** Called after the drain completes (success or error) so the UI
   *  can refresh its in-memory state from the cache + Supabase. */
  onChanged?: () => void;
  /** Called on conflict detection (0 rows affected). UI surfaces:
   *  «Запись была обновлена на другом устройстве. Применены ваши
   *  изменения.» */
  onConflict?: Toast;
  /** Called when an op fails MAX_ATTEMPTS times. UI surfaces a
   *  retry-able warning in the sidebar / SyncQueuePanel. */
  onPermanentFailure?: (op: QueuedOp) => void;
}

let draining = false;
let pendingFollowup = false;

/** Public trigger — call from `online` listener, onResync, manual
 *  retry button, or after a write failed mid-flight. Idempotent
 *  and self-coalescing. */
export async function kickReplayer(opts: ReplayerOptions): Promise<void> {
  if (draining) {
    pendingFollowup = true;
    return;
  }
  draining = true;
  try {
    await drain(opts);
    if (pendingFollowup) {
      pendingFollowup = false;
      // Run one follow-up pass synchronously so coalesced triggers
      // get a chance to flush the queue without recursion explosion.
      await drain(opts);
    }
  } finally {
    draining = false;
  }
}

async function drain(opts: ReplayerOptions): Promise<void> {
  const ops = await dequeueAll(); // sorted by created_at ASC via index
  if (ops.length === 0) return;

  for (const op of ops) {
    if (op.attempts >= MAX_ATTEMPTS) {
      // Already failed permanently — leave in queue so the UI can
      // show the manual-retry button. Manual retry resets attempts.
      continue;
    }

    // v452 — fail-fast for non-UUID row_ids targeting uuid id
    // columns. These are unrecoverable: the row was never accepted
    // by Postgres in the first place, and replaying any op against
    // a synthetic local id (`apt-...`) returns the same 22P02
    // «invalid input syntax for type uuid» error. Mark perm-failed
    // immediately so the SyncQueuePanel's «Удалить» button is the
    // only action shown.
    if ((op.op === "delete" || op.op === "update") && !isUuid(op.row_id)) {
      const msg = `non-uuid row_id: "${op.row_id}" — local orphan, cannot replay`;
      await markOpPermanentlyFailedAndEmit(op.id, msg);
      opts.onPermanentFailure?.({
        ...op,
        attempts: MAX_ATTEMPTS,
        last_error: msg,
      });
      continue;
    }

    // Soft-throttle: if this op was recently attempted, wait its
    // backoff. We measure attempts->backoff naively; the queue
    // doesn't carry last_attempt_at to keep the schema small.
    if (op.attempts > 0) {
      const backoff = BACKOFFS_MS[Math.min(op.attempts - 1, BACKOFFS_MS.length - 1)] ?? 30000;
      await sleep(backoff);
    }

    // STORY-052 G4 — pre-gate offline INSERTs on the tier quota.
    // Quota failures are KNOWN-PERMANENT (waiting + retrying won't
    // free up tier headroom), so mark perm-failed immediately
    // instead of burning 3 retry windows. UI shows the row in
    // SyncQueuePanel with last_error so the user knows why + can
    // upgrade and manually retry from the panel.
    if (op.op === "insert" && QUOTA_TABLES.has(op.table)) {
      const kind = tableToQuotaKind(op.table);
      const tenantId = (op.payload as { tenant_id?: string }).tenant_id;
      if (kind && tenantId) {
        try {
          await assertQuotaAvailable(opts.supabase, tenantId, kind);
        } catch (err) {
          if (err instanceof QuotaExceededError) {
            const msg = `Quota exceeded: ${err.kind} (${err.current}/${err.limit})`;
            await markOpPermanentlyFailedAndEmit(op.id, msg);
            opts.onPermanentFailure?.({
              ...op,
              attempts: 999,
              last_error: msg,
            });
            continue;
          }
          // Non-quota error in the gate — fall through to normal
          // dispatch + bump-attempt path so a transient blip doesn't
          // permanently fail the op.
        }
      }
    }

    try {
      const conflict = await dispatch(opts.supabase, op);
      if (conflict) {
        opts.onConflict?.(
          "Запись была обновлена на другом устройстве. Применены ваши изменения.",
        );
      }
      await removeOp(op.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await bumpAttempt(op.id, msg);
      // If we just exceeded the cap, surface to UI once.
      if (op.attempts + 1 >= MAX_ATTEMPTS) {
        opts.onPermanentFailure?.({
          ...op,
          attempts: op.attempts + 1,
          last_error: msg,
        });
      }
      // Don't bail the entire drain on one failure — keep going so
      // ops behind a poisoned one still get their chance.
    }
  }

  opts.onChanged?.();
}

/** Returns `true` if the dispatch succeeded but a conflict was
 *  detected (UPDATE matched 0 rows on the first pass; we then
 *  retried without expected_updated_at and that one succeeded).
 *  Throws on unrecoverable errors so the caller bumps attempts. */
async function dispatch(
  supabase: DbSupabase,
  op: QueuedOp,
): Promise<boolean> {
  // The repositories accept the row shapes already; payloads are
  // pre-shaped at enqueue time so dispatch is mostly a relay. We
  // talk directly to PostgREST here (not through the typed repo
  // helpers) because:
  //   1. Each table has a different repo function signature; a
  //      generic relay keeps the replayer table-agnostic.
  //   2. The conflict-detection pattern (UPDATE WHERE updated_at)
  //      is uniform across tables.
  const tableName = tableForOp(op.table);

  if (op.op === "delete") {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq("id", op.row_id);
    if (error) throw new Error(`replay delete: ${error.message}`);
    return false;
  }

  if (op.op === "insert") {
    // v489 — defensive: pre-v489 queued inserts may carry a non-UUID
    // `id` (`apt-mp2we5l1-...`) inside the payload. Supabase's id
    // columns are uuid → INSERT 22P02 «invalid input syntax for type
    // uuid», stranding the row. Strip the id so the server allocates
    // a fresh UUID, then drop the local-id row from IDB cache so
    // the orphan optimistic row doesn't double up next list().
    let payload = op.payload as Record<string, unknown>;
    let stripped = false;
    if (!isUuid(op.row_id) && typeof payload === "object" && payload !== null) {
      const { id: _id, ...rest } = payload as { id?: string };
      void _id;
      payload = rest;
      stripped = true;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from(tableName).insert(payload as any);
    if (error) throw new Error(`replay insert: ${error.message}`);
    if (stripped) {
      try {
        await cacheDelete(op.table, op.row_id);
      } catch {
        /* ignore — cache may already be gone */
      }
    }
    return false;
  }

  // op.op === 'update' — last-write-wins via updated_at sentinel.
  // Table-agnostic dispatch: cast through `unknown` to a
  // PostgrestFilterBuilder so we can chain `.eq("updated_at", ...)`
  // without per-table type narrowing. The replayer is intentionally
  // generic across cached tables.
  if (op.expected_updated_at) {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const filter = (
      supabase.from(tableName).update(op.payload as any) as any
    )
      .eq("id", op.row_id)
      .eq("updated_at", op.expected_updated_at)
      .select("id");
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const { data, error } = await filter;
    if (error) throw new Error(`replay update: ${error.message}`);
    if (data && data.length > 0) return false; // matched cleanly

    // 0 rows → conflict. Retry without updated_at filter and re-fetch
    // the canonical server row (now carrying the new updated_at) so
    // the cache stays consistent. Without this re-fetch, IDB would
    // hold the pre-conflict updated_at and falsely conflict on the
    // next edit.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const forceFilter = (
      supabase.from(tableName).update(op.payload as any) as any
    )
      .eq("id", op.row_id)
      .select()
      .single();
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const { data: forced, error: forceErr } = await forceFilter;
    if (forceErr)
      throw new Error(`replay force-update: ${forceErr.message}`);
    if (forced) {
      // Cache write-through with the canonical row.
      await cacheUpsert(op.table as CachedTable, forced);
    }
    return true;
  }

  // No expected_updated_at — unconditional update (e.g. queued from
  // a context where we didn't have the cached row yet).
  const { error: plainErr } = await supabase
    .from(tableName)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(op.payload as any)
    .eq("id", op.row_id);
  if (plainErr) throw new Error(`replay update (plain): ${plainErr.message}`);
  return false;
}

function tableForOp(t: QueuedOp["table"]): "clients" | "appointments" | "client_tags" {
  // UI vocab → DB table. See cache layer header for rationale.
  return t === "tags" ? "client_tags" : t;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// G4: manual-retry now lives in `lib/sync/queue-events`
// (`resetOpAttemptsAndEmit`) so the IDB write fires the badge-refresh
// event in the same transaction. The SyncQueuePanel imports it
// directly; the replayer no longer needs a parallel API surface.
