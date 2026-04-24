// Avatar presets for master cards.
//
// 14 cartoon-style avatars generated on-demand by DiceBear's public
// `avataaars` style — the little flat-colour cartoon people. Seeds
// are fixed so the same preset renders identically across devices.
// Uploaded photos are stored as data URLs inside the Master record
// (localStorage today, Supabase Storage eventually).

const DICEBEAR_BASE = "https://api.dicebear.com/9.x/avataaars/svg";

// 14 hand-picked seeds that produce visually distinct faces (hair,
// skin, clothes, accessories). Replace with your own art later —
// the only contract is that getAvatarPreset(i) returns a stable URL.
const PRESET_SEEDS: readonly string[] = [
  "babun-1-felix",
  "babun-2-maya",
  "babun-3-leo",
  "babun-4-zoe",
  "babun-5-noah",
  "babun-6-aria",
  "babun-7-ivan",
  "babun-8-mira",
  "babun-9-omar",
  "babun-10-kira",
  "babun-11-sam",
  "babun-12-luna",
  "babun-13-theo",
  "babun-14-nora",
];

export const AVATAR_PRESET_COUNT = PRESET_SEEDS.length;

export function getAvatarPreset(index: number): string {
  const safe = ((index % PRESET_SEEDS.length) + PRESET_SEEDS.length) %
    PRESET_SEEDS.length;
  return `${DICEBEAR_BASE}?seed=${encodeURIComponent(PRESET_SEEDS[safe])}`;
}

export function getAvatarPresets(): string[] {
  return PRESET_SEEDS.map((_, i) => getAvatarPreset(i));
}

/** True for any recognised avatar value (preset URL or uploaded data URL). */
export function isAvatarSet(value: string | null | undefined): boolean {
  return typeof value === "string" && value.length > 0;
}
