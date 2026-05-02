# STORY-054 — Offline-first

**Status:** `in-progress (G1 in review)` — G0 inventory + decisions locked 2026-05-02. G1 cache layer drafted, awaiting code review.
**Estimate:** 3–4 days.
**Dependencies:** STORY-053b autonomous portion shipped (v365). G5 iPhone push test still open but orthogonal.
**Blocks:** STORY-055+ (any feature relying on offline UX as a baseline).

## Why

Today every page in Babun is a thin server-rendered shell that falls over the moment connectivity drops. A master in a basement has nothing. With Supabase Realtime + the data already streaming through `useRealtimeTenantSync`, mirroring it into IndexedDB and queuing writes during disconnects gives us:

- Instant repeat-page loads (read from IDB while waiting on Supabase)
- Continued work in the field on flaky LTE
- A path toward "Babun feels native" without going actual native

## G0 — Inventory + decisions (done 2026-05-02)

### What exists today

| Concern | State | Verdict |
|---|---|---|
| `idb` ^8.0.3 | Already in `apps/web/package.json` deps | Use directly. **No Dexie.** |
| Existing IndexedDB usage | None in app code | Greenfield |
| Service worker | `babun-v365` with precache + network-first HTML + cache-first static. **No `sync` handler.** | Add `sync` event in G5 |
| Realtime sync | `useRealtimeTenantSync<TRow>` (STORY-048) — generic per-(tenant,table) channel with reconnect resync | Wedge cache writes into the existing handler closures; reuse `onResync()` to drain the queue |
| Repository pattern | `packages/shared/src/db/repositories/{clients,appointments,...}.ts` | Wrap these — they're the seam |
| `online`/`offline` event handling | None in codebase | Add `lib/network.ts` in G2 |
| Toast | `UndoToast.tsx` (delete-undo only) | Add a tiny generic `<Toast>` for conflict warnings |
| `services` table on Supabase | Doesn't exist — services are a JSONB column on `appointments` and a localStorage catalog | **Drop from v1 cache scope.** See decision #1 below. |
| `client_tags.updated_at` | Doesn't exist — table has `(id, tenant_id, name, color)` only | **Full re-pull on each sync** (cheap; <100 rows/tenant). See #2. |
| `version` column for conflict detection | Doesn't exist on any cached table | Use `updated_at` (server-set via trigger) for last-write-wins. **No schema migration.** See #3. |

### Locked decisions

1. **Cache scope v1: `clients`, `appointments`, `client_tags` only.** Services catalog migration to Supabase is parked under STORY-039b (or a future mini-story); until then services stay in localStorage and are NOT mirrored to IDB.
2. **`client_tags` syncs via full re-pull.** `syncFromRemote('tags')` ignores the `since` parameter — unconditional full fetch. Tags are <100 rows; sub-ms cost.
3. **Conflict detection uses `updated_at`, not a `version` column.** Replay does `UPDATE WHERE id=$1 AND updated_at=$2`. 0 rows affected → conflict → toast warning + retry without the `updated_at` clause (force last-write-wins). 1 row → success. `updated_at` is set server-side via existing triggers (no client clock skew). No DB migration.
4. **Reconnect handling reuses `useRealtimeTenantSync.onResync()`** — already fires on reconnect. We hook cache-freshness verification + queue drain there. Don't add a duplicate `online` listener.
5. **`appointments.master_id` is `text` legacy.** Cache as-is. IndexedDB schema-upgrade hook ready to migrate to UUID when STORY-039b lands.
6. **Pre-Supabase localStorage repos under `packages/shared/local/*` are NOT touched** in this story. Cache wrapping operates only on `packages/shared/db/repositories/*`. Existing dual-source is documented as tech debt for future cleanup.

## G1 — IndexedDB schema + cache layer

Lives at `packages/shared/src/db/cache/` (new directory).

### Schema (Dexie-style, on raw `idb`)

```ts
DB_NAME = 'babun-cache'
DB_VERSION = 1

stores:
  clients         { keyPath: 'id', indexes: [tenant_id, updated_at, [tenant_id, updated_at]] }
  appointments    { keyPath: 'id', indexes: [tenant_id, date, [tenant_id, date], [tenant_id, updated_at]] }
  tags            { keyPath: 'id', indexes: [tenant_id] }
  sync_queue      { keyPath: 'id', autoIncrement, indexes: [created_at] }
  sync_meta       { keyPath: 'key' }                 // { key: 'last_full_sync_clients', value: ts }
```

Compound indexes give us cheap "all clients for tenant X sorted by updated_at" without scan-and-filter.

### Public API (the only thing callers should import)

```ts
// Singleton — opens once, survives across the app.
getCache(): Promise<IDBPDatabase<BabunCacheDB>>

// READ
cacheRead<T>(table: 'clients' | 'appointments' | 'tags', tenantId: string): Promise<T[]>

// WRITE-THROUGH (one row at a time; bulk is for bootstraps below)
cacheUpsert<T extends { id: string }>(table, row): Promise<void>
cacheDelete(table, id: string): Promise<void>

// BULK (used by bootstrap + onResync)
cacheBulkUpsert<T extends { id: string }>(table, rows: T[]): Promise<void>
cacheClearTenant(table, tenantId: string): Promise<void>     // drop pre-resync
cacheClearAll(): Promise<void>                                 // drop on logout

// QUEUE (G2 will use these)
enqueueOp(op: Omit<QueuedOp, 'id' | 'created_at' | 'attempts'>): Promise<void>
dequeueAll(): Promise<QueuedOp[]>
removeOp(id: number): Promise<void>
bumpAttempt(id: number, error: string): Promise<void>

// META
readMeta(key: string): Promise<string | null>
writeMeta(key: string, value: string): Promise<void>
```

### `QueuedOp` shape

```ts
type QueuedOp = {
  id: number;                                  // autoIncrement
  created_at: number;                          // ms epoch (replay order)
  table: 'clients' | 'appointments' | 'tags';
  op: 'insert' | 'update' | 'delete';
  row_id: string;                              // client-generated UUID
  payload: Record<string, unknown>;            // full row for insert/update; minimal for delete
  expected_updated_at: string | null;          // for conflict detection on UPDATE; null on INSERT/DELETE
  attempts: number;
  last_error?: string;
};
```

### Cross-tenant safety

`cacheClearAll()` runs on `auth.signOut()` — every store dropped. `getCache()` is keyed by the IndexedDB DB name only (no tenant in DB name) so a single user with multiple tenants works without stomping; the per-row `tenant_id` index keeps reads filtered.

## G2 — Sync queue replay

`apps/web/src/lib/sync/replayer.ts` (new):

- Hooks into `lib/network.ts` (`useIsOnline`) — fires immediately on `onLine && queue.length > 0`
- Also hooks `useRealtimeTenantSync.onResync()` so a Supabase reconnect triggers verification + drain
- Replay loop:
  ```
  ops = dequeueAll() sorted by created_at ASC
  for op in ops:
    try: repository call (insert/update/delete) with expected_updated_at clause
    if 0 rows affected on UPDATE → conflict toast + retry without expected_updated_at
    on success → removeOp + emit 'babun:cache-changed'
    on retryable error (5xx, network) → bumpAttempt; if attempts < 3 → exponential backoff (1s, 5s, 30s)
    on attempts >= 3 → leave in queue with last_error; show "1 запись с ошибкой синхронизации"
  ```
- Mounted as a hook in `DashboardClientLayout`

## G3 — Conflict resolution

Per decision #3:
- Repository update path adds optional `expected_updated_at` parameter
- Generates `WHERE id = $1 AND updated_at = $2`
- Returns row count via `.select('id').single()` after update — 0 ⇒ conflict
- On conflict: replayer issues second UPDATE without the updated_at filter, fires `track('sync.conflict', { table })` (PostHog stub for STORY-044b later) and shows toast `Запись была обновлена на другом устройстве. Применены ваши изменения.`

## G4 — UI indicators

Three new components under `apps/web/src/components/offline/`:
- `OfflineIndicator.tsx` — fixed bottom strip, above `BottomTabBar`. Shows `Без сети — работаешь в локальном режиме` when `!navigator.onLine`. Auto-hides on reconnect.
- `SyncQueueBadge.tsx` — sidebar pill `↑ N` when queue has entries; `↑ N ⚠` when any have errors. Click → opens panel.
- `SyncQueuePanel.tsx` — modal listing queued ops with timestamps, retry button per op, and `Очистить очередь` (confirm) for emergency cleanup.
- Plus `lib/network.ts` (`useIsOnline()` hook + `subscribeNetwork(cb)` for non-React listeners).

## G5 — Background sync

`sw.js` adds `'sync'` event handler:
- On `event.tag === 'babun-sync-queue'` → `notifyClients('replay-queue')` to wake any open client; if no clients → optional fetch to `/api/noop` to keep the worker alive briefly (Android Chrome standard pattern)
- Client side: `registration.sync.register('babun-sync-queue')` after enqueueing
- iOS: BackgroundSync **not supported**. Documented + accept — only foreground replay for iOS users (already handled by the `online` event listener)

## G6 — Race conditions documented

- **Realtime payload during replay** — `useRealtimeTenantSync.onUpdate(row)` checks `sync_queue` for a pending op on the same `row_id`; if pending → skip the realtime apply (the queued local op wins; replayer will eventually overwrite the server then re-fetch).
- **2 tabs, both offline, edit same row** — last-write-wins by `created_at` of the queue op. Acceptable.
- **iOS PWA storage eviction (~7 days idle)** — IDB cleared by OS. Document. Reload triggers realtime → cache rebuild.

## G7 — Smoke (Playwright via MCP)

1. Disconnect network → create client → toast `Сохранено локально` → reconnect → row appears in Supabase
2. Disconnect → INSERT + UPDATE + DELETE on same client → reconnect → all 3 ops replay in order; final state matches expected
3. Conflict: open in 2 tabs, tab A offline-edit, tab B online-edit → A reconnects → toast warning, A's value wins
4. Cache survives reload (offline) — list still renders
5. Logout → all IDB stores cleared
6. New device login → realtime triggers `cacheBulkUpsert` populating IDB

Not testable in headless (deferred to user device):
- Real Service Worker background sync on Android Chrome (PWA closed → reconnect → SW fires `sync`)
- iOS PWA online/offline transitions with realistic LTE flap

## G8 — Bump v366-offline-first + push

- `BUILD_VERSION = "v366-offline-first"`
- `CACHE_VERSION = "babun-v366"`

## G9 — Production verify

After Vercel deploy:
- Offline mode works on prod
- Sync queue flushes after reconnect
- Conflict toast appears

## Out of scope (parked)

- Schedule / finances / day_cities / day_extras / recurring_reminders / tenant_members / invitations offline (desktop usage; revisit when masters report needing them)
- Conflict diff dialog `Save mine / Discard`
- Per-row offline preference UI
- Manual cache clear button in Settings (only logout cleanup in v1)
- Multi-device cache invalidation strategy beyond realtime (eventually consistent is enough)

## Tech debt acknowledged (not fixed in this story)

- Pre-Supabase localStorage repos under `packages/shared/local/*` still exist alongside `packages/shared/db/repositories/*`. Dual-source. Cleanup tracked separately — most likely as part of the masters subroute redesign.
- `services` is not a top-level Supabase table. Catalog migration parked.
- `client_tags` lacks `updated_at`. Acceptable given full-pull strategy.

## Lessons applied from STORY-053b

- Don't trust `WITH SCHEMA` clauses on extensions (pg_net, pg_cron, etc.) — schema is hardcoded.
- Service-role bypass on RLS tables needs explicit policy after the JWT-Signing-Keys migration.
- Edge Function Secrets ≠ Postgres Vault.
- Schema changes outside agreed scope require STOP + ask.

## Checkpoint flow

Same as STORY-053b:
- G0 → reported, decisions locked
- G1 cache layer code → review BEFORE applying
- G2 sync queue → review queue logic
- G3 conflict resolution → confirm `updated_at` round-trip
- G4–G6 UI + sw.js + race-condition guards → autonomous
- G7 smoke → review pass/fail
- G8 push v366 → my OK before production deploy
- G9 production verify → final report
