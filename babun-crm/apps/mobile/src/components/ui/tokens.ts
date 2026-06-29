// Centralized design tokens — «Halo Cobalt» (apps/mobile/docs/DESIGN-SYSTEM.md).
// Hex values mirror global.css @theme so the JS side (lucide icon colors,
// inline styles, svg gradients) stays in sync with the className utilities
// (bg-brand / text-ink / bg-canvas / ...). One source of truth.
export const COLORS = {
  brand: "#2c5be0", // accent — primary actions, links, brand
  accentFrom: "#3e84ff", // the only gradient (logo · CTA · FAB)
  accentTo: "#1f4fcc",
  brandAccent: "#34aadc", // finance / profit accent
  success: "#1fb47a", // money in / profit
  danger: "#f0473c", // money out / debt / destructive
  warning: "#f5a623", // caution
  ink: "#0b1220", // text primary
  body: "#39414e", // strong icons / body
  sub: "#5b6678", // text secondary
  faint: "#97a0ae", // text tertiary
  chevron: "#c4c4c4", // chevrons
  hair: "#e7ebf0", // separator — a color, never a 1px border
  canvas: "#f4f6f9", // app ground
  white: "#ffffff",
} as const;

// Lucide icon sizes — use these instead of scattered literals.
export const ICON = { lg: 24, md: 22, sm: 18, xs: 14 } as const;
