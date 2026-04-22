// Deterministic avatar colour from a name — each client gets a unique
// hue so the list isn't a wall of the same colour. Old Money tile
// palette (Sprint 032): muted, warm, nothing neon. Mirrors the 12
// --tile-* tokens in globals.css so avatars sit in the same palette
// as settings ListRow icons.

const COLORS = [
  "#A55A50", // tile-red      muted terracotta
  "#B0814E", // tile-orange   burnt sienna
  "#C9A860", // tile-yellow   antique gold
  "#6C8A68", // tile-green    olive
  "#7CA08A", // tile-mint     sage
  "#6C8B89", // tile-teal     muted teal
  "#6B87A0", // tile-cyan     steel blue
  "#5D7A94", // tile-blue     dusty navy
  "#6A6E8D", // tile-indigo   slate blue
  "#87688B", // tile-purple   plum
  "#A47888", // tile-pink     dusty rose
  "#948A7C", // tile-gray     warm taupe
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
