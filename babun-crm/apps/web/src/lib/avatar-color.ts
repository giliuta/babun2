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
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
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
