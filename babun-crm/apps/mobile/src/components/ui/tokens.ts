// Centralized design tokens. Hex values mirror global.css @theme so the JS
// side (lucide icon colors, inline styles) stays in sync with the className
// utilities (bg-brand / text-success / ...). One source of truth.
export const COLORS = {
  brand: "#4338ca", // indigo-700 — primary actions, links
  brandAccent: "#34aadc", // finance / profit accent
  success: "#10b981", // emerald-500
  danger: "#ef4444", // red-500
  warning: "#fbbf24", // amber-400
  ink: "#171717", // neutral-900 — primary text
  body: "#404040", // neutral-700 — strong icons / body
  sub: "#737373", // neutral-500 — secondary text
  faint: "#a3a3a3", // neutral-400 — tertiary text
  chevron: "#c4c4c4", // neutral-300 — chevrons
  hair: "#f5f5f5", // neutral-100 — separators / hairlines
  white: "#ffffff",
} as const;

// Lucide icon sizes — use these instead of scattered literals.
export const ICON = { lg: 24, md: 22, sm: 18, xs: 14 } as const;
