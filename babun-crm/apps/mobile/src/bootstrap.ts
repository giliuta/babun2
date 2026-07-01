// Entry-time side effects. MUST be the FIRST import in app/_layout.tsx, before
// any @babun/shared store or supabase usage runs.
//
//   1. crypto.getRandomValues polyfill (uuid generation in repositories).
//   2. URL / URLSearchParams polyfill (required by @supabase/supabase-js).
//   3. Bind the synchronous KV backend for all shared local/* stores.
//      Until this runs, getStorage() THROWS on native (no silent data loss).
//   4. Sentry (no-op without a DSN).
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import { setStorage, WebKVStorage } from "@babun/shared/storage";
import { initSentry } from "@/lib/sentry";

// Storage backend is platform-split. The `@/` alias goes through tsconfig
// paths, which Expo's Metro resolver does NOT widen with platform extensions
// (`.web.ts`), so we branch explicitly here instead of relying on file
// resolution. react-native-mmkv v3 is JSI/native-only and its `new MMKV()`
// runs at module-eval — requiring it lazily keeps that off the web code path
// (Expo web / Preview), where we back the same sync KVStorage with
// localStorage via WebKVStorage.
if (Platform.OS === "web") {
  setStorage(new WebKVStorage());
} else {
  const { MMKVStorage } = require("@/storage/mmkv") as typeof import("@/storage/mmkv");
  setStorage(new MMKVStorage());
}

initSentry();
