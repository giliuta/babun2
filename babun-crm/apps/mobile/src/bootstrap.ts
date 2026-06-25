// Entry-time side effects. MUST be the FIRST import in app/_layout.tsx, before
// any @babun/shared store or supabase usage runs.
//
//   1. crypto.getRandomValues polyfill (uuid generation in repositories).
//   2. URL / URLSearchParams polyfill (required by @supabase/supabase-js).
//   3. Bind the synchronous KV backend (MMKV) for all shared local/* stores.
//      Until this runs, getStorage() THROWS on native (no silent data loss).
//   4. Sentry (no-op without a DSN).
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import { setStorage } from "@babun/shared/storage";
import { MMKVStorage } from "@/storage/mmkv";
import { initSentry } from "@/lib/sentry";

setStorage(new MMKVStorage());
initSentry();
