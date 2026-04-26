// STORY-035 G0 — storage namespace placeholder.
//
// G1 fills this with the synchronous KVStorage abstraction:
//   * types.ts    — interface KVStorage<T>
//   * web.ts      — WebKVStorage (localStorage-backed)
//   * memory.ts   — MemoryKVStorage (Map-backed, for tests / RN dev)
//   * provider.ts — getStorage() / setStorage()
export {};
