# STORY-054 — Offline-first

**Status:** `todo` — planning + G0 inventory done, awaiting `ok` and **STORY-053b close** before G1.
**Estimate:** 3–4 days.
**Dependencies:** STORY-053b must be fully shipped + closed first per user order.
**Blocks:** STORY-055+ (any feature relying on offline UX as a baseline).

## Why

Today every page in Babun is a thin server-rendered shell that falls over the moment connectivity drops. A master in a basement has nothing. With Supabase Realtime + the data already streaming through `useRealtimeTenantSync`, mirroring it into IndexedDB and queuing writes during disconnects gives us:
- Instant repeat-page loads (read from IDB while waiting on Supabase).
- Continued work in the field on flaky LTE.
- A path toward "Babun feels native" without going actual native.

## G0 — Inventory (done 2026-04-30)

| Concern | State | Verdict |
|---|---|---|
| IndexedDB wrapper | `idb` (^8.0.3) **already in `apps/web/package.json` deps** | Use it. **No Dexie** — drop original brief on this point. |
| Existing IndexedDB usage in app code | None | Greenfield |
| Service worker cache | Network-first for HTML, cache-first for static. Already in `sw.js`. No background sync. | Keep, add background sync handler |
| Repository pattern | `apps/web/src/lib/clients.ts`, `appointments.ts`, etc. — all hit Supabase directly via `getSupabaseBrowser()` | These are the seam: every write goes through them; that's where we wedge in the cache + queue layer |
| `online`/`offline` events handled? | No | Add in `DashboardClientLayout` |
| Realtime sync | `useRealtimeTenantSync` exists (STORY-048), 10 tables already streaming | Becomes the cache invalidator: realtime row → write to IDB cache |

## G1 — IndexedDB schema + helpers

Build on the already-installed `idb` (no Dexie, no new dep).

New module: `babun-crm/packages/shared/src/db/cache/index.ts`.

```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface BabunCacheDB extends DBSchema {
  clients: { key: string; value: ClientRow; indexes: { tenant_id: string } };
  appointments: { key: string; value: AppointmentRow; indexes: { tenant_id: string; date: string } };
  tags: { key: string; value: TagRow; indexes: { tenant_id: string } };
  services: { key: string; value: ServiceRow; indexes: { tenant_id: string } };
  sync_queue: { key: number; value: QueuedOp; indexes: { ts: number } };  // autoIncrement key
  meta: { key: string; value: { value: string; updated_at: number } };    // last_sync_ts per table
}

const DB_NAME = 'babun-cache';
const DB_VERSION = 1;
```

**Schema scope (v1):** `clients`, `appointments`, `tags`, `services`, `sync_queue`, `meta`. Not all 10 realtime tables — start with the heavy-read ones the master actually opens in the field. Schedule, finances, etc. stay online-only in v1.

**`QueuedOp` shape:**
```ts
type QueuedOp = {
  id: number;             // autoIncrement
  ts: number;             // ms epoch
  table: 'clients' | 'appointments' | 'tags' | 'services';
  op: 'insert' | 'update' | 'delete';
  row_id: string;         // local UUID (we generate UUIDs client-side)
  payload: Record<string, unknown>;  // what to write
  attempts: number;       // retry count for backoff
  last_error?: string;    // last failure message
};
```

**Public surface (`packages/shared/src/db/cache/index.ts`):**
- `getCache(): Promise<IDBPDatabase<BabunCacheDB>>` — singleton, opens once.
- `cacheRead<T>(table, filter): Promise<T[]>` — reads from IDB, returns `[]` if empty.
- `cacheWrite<T>(table, row): Promise<void>` — upsert one row.
- `cacheDelete(table, id): Promise<void>` — remove by primary key.
- `enqueueOp(op: Omit<QueuedOp, 'id' | 'ts' | 'attempts'>): Promise<void>` — push to `sync_queue`.
- `dequeueAll(): Promise<QueuedOp[]>` — drain in `ts ASC` order.
- `removeOp(id: number): Promise<void>` — drop one op after success.
- `bumpAttempt(id: number, error: string): Promise<void>` — update on failure.

## G2 — Write-through cache layer

Wrap existing repository calls with a thin adapter.

### Strategy
- **Read path**: Repositories optionally accept `{ preferCache?: boolean }`. Lists default to `preferCache: true` — read from IDB first, kick off a background revalidate from Supabase, swap on completion (SWR pattern).
- **Write path**: Every `createX/updateX/deleteX` in `lib/clients.ts` etc. becomes:
  ```
  if (online) { write to Supabase; on success → cacheWrite } else { cacheWrite + enqueueOp }
  ```
  Always cacheWrite first (optimistic UI) + always set the row's `id` client-side via `crypto.randomUUID()` so writes don't depend on server-generated PKs.
- **Realtime sync** (already in place via `useRealtimeTenantSync`): on each `INSERT`/`UPDATE`/`DELETE` payload from Postgres, call `cacheWrite`/`cacheDelete`. This keeps IDB warm for offline reads automatically while the user is online.

### Files touched
- `apps/web/src/lib/clients.ts` — add cache wrapping in `createClient`, `updateClient`, `deleteClient`, `listClients`.
- `apps/web/src/lib/appointments.ts` — same.
- `apps/web/src/lib/tags.ts` — same.
- `apps/web/src/lib/services.ts` — same.
- `apps/web/src/lib/realtime/useRealtimeTenantSync.ts` — write through to cache on realtime payloads.

## G3 — Sync queue replay

New module `apps/web/src/lib/sync/replayer.ts`:
- `useSyncReplayer()` hook mounted in `DashboardClientLayout`.
- Effect:
  ```
  online ? immediate replay : wait for online event
  on online → dequeueAll → for each op (in ts ASC order):
    try repository call
      success → removeOp + emit 'babun:cache-changed'
      4xx (client error / RLS) → bumpAttempt; if attempts >= 3 → removeOp + log + show toast
      5xx / network → break loop, retry on next online tick
  ```
- Backoff: between batches, 200ms jitter. Don't drown Supabase.

## G4 — Conflict resolution

Server-side approach: add `version` column (int) to `clients`, `appointments`, `tags`, `services`. Default `1`. UPDATE statement includes `WHERE id = $1 AND version = $2 RETURNING version + 1`. If 0 rows updated → conflict.

Migration: `supabase/migrations/20260502_001_row_version.sql`.

Client behavior on conflict:
- `last-write-wins` is **the default** (per user brief). Replayer overwrites server with our version, bumps `version` to server-current+1.
- Toast: `Запись была обновлена на другом устройстве. Применены ваши изменения.`
- **No diff dialog in v1** (user marked it "optionally"). Defer.
- Log conflict via PostHog if STORY-044b lands first: `track('sync.conflict', { table, op })`. If 044b not landed yet — `console.warn` + structured log only.

## G5 — UI indicators

- **Bottom banner offline**: `apps/web/src/components/sync/OfflineBanner.tsx` — fixed bottom, above `BottomTabBar`, `bg-[#3C3C43]/95 text-white text-[13px]` strip showing `Без сети — изменения сохраняются локально и отправятся при подключении.`. Mounted in `DashboardClientLayout`. Listens to `online`/`offline` window events + initial `navigator.onLine`.
- **Sidebar pending badge**: small chip on the avatar / bottom-tab "Ещё" button: `↑ N` when `sync_queue` has entries. Updates on `babun:cache-changed` event from G3.
- **Sync spinner**: when replayer is actively flushing, the chip swaps to a spinner icon for the duration. Two seconds minimum visibility so it's not a flash.

## G6 — Background sync (Service Worker)

Add to `sw.js`:
```js
self.addEventListener('sync', (event) => {
  if (event.tag === 'babun-sync-queue') {
    event.waitUntil(notifyClients('replay-queue'));
  }
});
```
- `notifyClients` iterates `clients.matchAll()` and posts a message; if no clients → fall back to `fetch('/api/sync/replay-trigger')` which simply hits a no-op endpoint to wake a server route (Vercel cold starts on demand otherwise can't get write to DB without a client).
- Client side: when online → `registration.sync.register('babun-sync-queue')`. On Android Chrome this fires after reconnect even if Babun is closed.
- iOS: Background Sync **not supported**. Document and accept — replay only on next foreground open. iOS users get the same experience as today, just with cache survival.

## G7 — Smoke (7/7)

1. **Disconnect → create client** → toast `Сохранено локально`. IDB has the row. `sync_queue` has one INSERT op.
2. **Reconnect → automatic replay** → row appears in Supabase via Network panel. Sidebar badge clears. Toast `Изменения отправлены`.
3. **Disconnect → create + edit + delete sequence** → Reconnect → replay in correct order; final state in Supabase = deleted (op 3 wins). Queue is empty.
4. **Conflict scenario** — Open device A, go offline, edit client. On device B (online), edit same client. Reconnect A → A's version overwrites; A sees toast `Запись была обновлена на другом устройстве. Применены ваши изменения.`
5. **IDB cache survives reload** — disconnect, reload page → clients list still renders from IDB. Add a row offline → reload still offline → row persists.
6. **New device login → bulk sync** — log in on a fresh browser → `useRealtimeTenantSync` performs initial fetch from Supabase, populates IDB, lists render.
7. **Background sync (Android only)** — close PWA, kill network, reopen → background sync fires queue replay on next reconnect even before user opens the app. Verify via Supabase Logs.

## G8 — Bump v365-offline-first + push

- `BUILD_VERSION = "v365-offline-first"`
- `CACHE_VERSION = "babun-v365"`

## G9 — Production verify

Repeat smoke 1, 2, 3, 5 against prod (the core offline → online round-trip). 4 (conflict) needs two devices — defer to manual verification when convenient.

## Acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| 1 | Reads from IDB when offline | G7 step 5 |
| 2 | Writes queued + replayed on reconnect | G7 steps 1, 2, 3 |
| 3 | Last-write-wins conflict + toast | G7 step 4 |
| 4 | UI indicators for offline state + pending count | manual visual + G7 |
| 5 | Background sync on Android Chrome | G7 step 7 |
| 6 | iOS graceful (no errors, just no background sync) | manual UA test |
| 7 | Existing online flows unchanged | typecheck + STORY-045/048 smoke regression |

## Out of scope

- E2E encryption of local data (CRM, not a vault — overkill)
- WebSocket realtime in offline mode (impossible by definition)
- Sync between devices that haven't been online together (no architecture)
- Schedule + finances tables in cache (online-only in v1; revisit when masters report needing them)
- Conflict diff dialog (deferred from G4 per brief — last-write-wins is enough for v1)

## Risks

- **IDB quota exhaustion**: Chrome typically gives ~60% of disk. With 10k clients + 50k appointments per tenant, comfortably fits. Add a `cache.evictOldest(table, keepN)` helper for paranoia, run nightly via SW alarm.
- **Schema migrations vs DB_VERSION**: every change to the `BabunCacheDB` interface bumps `DB_VERSION`. Forgetting → silent breakage. Mitigate with a `cache:version` constant in `packages/shared/src/db/cache/index.ts` and a unit test that fails if the interface hash changes without a version bump.
- **Race with Supabase Realtime**: realtime payload arrives during replay → potential duplicate writes. Mitigate by checking `version` before applying realtime payload to IDB if a queued op for the same row exists.
- **`navigator.onLine` lies**: returns `true` even when DNS is broken. Mitigate by treating any 5xx/network error in repository call as "offline" and falling back to queue, regardless of `navigator.onLine`.
- **iOS PWA storage eviction**: iOS evicts IDB after 7 days of non-use. Document. We can't prevent. Reload triggers Realtime → IDB rebuild.
- **Optimistic UI showing un-replayed deletes**: a deleted-locally row is gone from IDB; if the queue op fails permanently we've lost the row from view. Mitigate with `dropped_ops` log table in IDB so failed ops surface in a "Не удалось отправить" admin view (defer the UI; just keep the log).

## Migration sequence (ordered)

1. `20260502_001_row_version.sql` — add `version int default 1` to 4 tables + create the conflict-detection function.
2. Code changes (no breaking SQL).
3. Bump versions, push.
4. Backfill: existing rows get `version = 1` automatically via the default.

## Owner one-shots

None for STORY-054. All keys/secrets done as part of normal Supabase access.

## Sequencing reminder

**Do NOT start STORY-054 until STORY-053b is closed and verified on prod.** Two large concurrent migrations + cache layer + push pipeline = compounded debug surface area.
