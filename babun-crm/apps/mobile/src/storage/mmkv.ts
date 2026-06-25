import { MMKV } from "react-native-mmkv";
import type { KVStorage } from "@babun/shared/storage";

// Synchronous KV backed by react-native-mmkv — satisfies the shared
// KVStorage contract (packages/shared/src/storage/types.ts requires SYNC).
// Mirrors MemoryKVStorage's JSON round-trip so behaviour matches the web
// WebKVStorage byte-for-byte.
const mmkv = new MMKV({ id: "babun" });

export class MMKVStorage implements KVStorage {
  get<T>(key: string): T | null {
    const raw = mmkv.getString(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    mmkv.set(key, JSON.stringify(value));
  }

  getRaw(key: string): string | null {
    return mmkv.getString(key) ?? null;
  }

  setRaw(key: string, value: string): void {
    mmkv.set(key, value);
  }

  remove(key: string): void {
    mmkv.delete(key);
  }

  list(prefix = ""): string[] {
    const keys = mmkv.getAllKeys();
    return prefix === "" ? keys : keys.filter((k) => k.startsWith(prefix));
  }
}
