// STORY-035 G1 — Singleton accessor for the active KVStorage.
//
// The web app boots with WebKVStorage by default.  Tests and the
// future RN bootstrap call setStorage() to swap in a different impl
// before any store function runs.
//
// We deliberately do NOT support per-namespace storages — one-impl-
// per-process keeps the API simple and matches Babun's actual
// product shape (single tenant, single device, single user).

import type { KVStorage } from "./types";
import { WebKVStorage } from "./web";

let _impl: KVStorage = new WebKVStorage();

/** Read the active storage backend.  Stores call this on every load/save. */
export function getStorage(): KVStorage {
  return _impl;
}

/** Replace the storage backend.  Tests / RN bootstrap call this once before
 *  any store function fires.  No teardown required — the new impl owns its
 *  own state. */
export function setStorage(impl: KVStorage): void {
  _impl = impl;
}
