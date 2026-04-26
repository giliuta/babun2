// STORY-035 G0 — db namespace placeholder.
//
// G5 moves the existing Supabase-shape types here:
//   * types/ ← packages/shared/types/
//   * client/ ← packages/shared/lib/supabase.ts
//
// 9 known callers of `@babun/shared/types/finance` will be redirected
// to `@babun/shared/db/types/finance` in the same G5 commit.
export {};
