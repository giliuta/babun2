// Deterministic avatar colour from a name — each client gets a unique
// hue so the list isn't a wall of the same colour. Mirrors the 12
// iOS system colours exposed via --tile-* tokens in globals.css so
// avatars share the palette with settings ListRow icons.

const COLORS = [
  "#FF3B30", // tile-red      systemRed
  "#FF9500", // tile-orange   systemOrange
  "#FFCC00", // tile-yellow   systemYellow
  "#34C759", // tile-green    systemGreen
  "#00C7BE", // tile-mint     systemMint
  "#30B0C7", // tile-teal     systemTeal
  "#32ADE6", // tile-cyan     systemCyan
  "#007AFF", // tile-blue     systemBlue
  "#5E5CE6", // tile-indigo   systemIndigo
  "#AF52DE", // tile-purple   systemPurple
  "#FF2D55", // tile-pink     systemPink
  "#A2845E", // tile-brown    systemBrown
];

export function getAvatarColor(name: string): string {
  // DJB2-ish hash with a prime mix step so names like «Анастасия П»,
  // «Анна», «Ангела М» (all starting with the same 2 code units) don't
  // collide onto the same tile colour. Walking code points keeps the
  // hash stable for surrogate-pair / Cyrillic input.
  let hash = 5381;
  const cps = Array.from(name.trim());
  for (let i = 0; i < cps.length; i++) {
    hash = ((hash << 5) + hash) ^ cps[i].codePointAt(0)!;
  }
  // Mix length back in so 4-letter and 10-letter names with the same
  // leading letters still land on different hues.
  hash = (hash ^ cps.length * 2654435761) >>> 0;
  return COLORS[hash % COLORS.length];
}

// Clients occasionally name their contacts with emoji prefixes
// ("⭐ Мария", "🔥 Дима") as ad-hoc VIP flags. `.slice(0, 2)` on the
// raw string then chops the emoji surrogate pair in half and the
// avatar shows a broken glyph. Strip emoji/symbols/punctuation first,
// then walk code points (not code units) so Cyrillic / accented
// letters still render their first grapheme correctly.
export function getInitials(name: string): string {
  const cleaned = name
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Component}\p{Symbol}\p{Punctuation}]/gu, " ")
    .trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/);
  const first = Array.from(parts[0] ?? "")[0] ?? "";
  const last =
    parts.length > 1 ? Array.from(parts[parts.length - 1])[0] ?? "" : "";
  if (parts.length === 1) {
    const cps = Array.from(parts[0]);
    return ((cps[0] ?? "?") + (cps[1] ?? "")).toUpperCase();
  }
  return (first + last).toUpperCase();
}
