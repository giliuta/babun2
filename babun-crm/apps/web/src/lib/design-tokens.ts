// iOS + Telegram design tokens (Sprint 029 Phase 0).
//
// Typed mirror of the CSS variables declared in src/app/globals.css.
// Import these when a component needs a value outside of Tailwind's
// utility classes (inline styles, SVG fills, framer-motion props,
// Chart.js colours, etc.). For everyday styling prefer Tailwind
// classes — they read from the same `@theme` block so they stay
// consistent by construction.
//
// See docs/design-language.md for the narrative version.

export const color = {
  surface: {
    grouped: "var(--surface-grouped)",
    card: "var(--surface-card)",
    cardSecondary: "var(--surface-card-secondary)",
    overlay: "var(--surface-overlay)",
    navBlur: "var(--surface-nav-blur)",
  },
  separator: {
    default: "var(--separator)",
    opaque: "var(--separator-opaque)",
  },
  label: {
    primary: "var(--label)",
    secondary: "var(--label-secondary)",
    tertiary: "var(--label-tertiary)",
    quaternary: "var(--label-quaternary)",
    onAccent: "var(--label-on-accent)",
  },
  fill: {
    primary: "var(--fill-primary)",
    secondary: "var(--fill-secondary)",
    tertiary: "var(--fill-tertiary)",
    quaternary: "var(--fill-quaternary)",
  },
  accent: {
    default: "var(--accent)",
    pressed: "var(--accent-pressed)",
    tint: "var(--accent-tint)",
  },
  system: {
    red: "var(--system-red)",
    orange: "var(--system-orange)",
    yellow: "var(--system-yellow)",
    green: "var(--system-green)",
    mint: "var(--system-mint)",
    teal: "var(--system-teal)",
    cyan: "var(--system-cyan)",
    blue: "var(--system-blue)",
    indigo: "var(--system-indigo)",
    purple: "var(--system-purple)",
    pink: "var(--system-pink)",
  },
} as const;

// Type scale — Apple HIG pixel values, used when Tailwind's
// `text-[15px]` isn't granular enough or we want to keep a single
// source of truth across the codebase.
export const typography = {
  largeTitle: { size: 34, lineHeight: 41, weight: 700, tracking: "-0.02em" },
  title1: { size: 28, lineHeight: 34, weight: 700, tracking: "-0.02em" },
  title2: { size: 22, lineHeight: 28, weight: 600, tracking: "-0.02em" },
  title3: { size: 20, lineHeight: 25, weight: 600, tracking: "-0.015em" },
  headline: { size: 17, lineHeight: 22, weight: 600, tracking: "-0.01em" },
  body: { size: 17, lineHeight: 22, weight: 400, tracking: "-0.01em" },
  callout: { size: 16, lineHeight: 21, weight: 400, tracking: "-0.01em" },
  subhead: { size: 15, lineHeight: 20, weight: 400, tracking: "-0.005em" },
  footnote: { size: 13, lineHeight: 18, weight: 400, tracking: "0" },
  caption1: { size: 12, lineHeight: 16, weight: 500, tracking: "0.01em" },
  caption2: { size: 11, lineHeight: 13, weight: 600, tracking: "0.05em" },
} as const;

// Apple's 8-pt grid (we scale it 1:1 on web). Use these for consistent
// spacing between groups, inside rows, and around sheets.
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  massive: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 16,
  xxl: 20,
} as const;

export const duration = {
  fast: 120,
  normal: 200,
  slow: 320,
} as const;

// Colour "tones" used by the Settings-style icon tiles. Paired with a
// lucide icon they produce the iOS-System-Settings look (rounded-lg,
// white icon, coloured background).
export type IconTone =
  | "violet"
  | "blue"
  | "sky"
  | "emerald"
  | "mint"
  | "amber"
  | "orange"
  | "rose"
  | "pink"
  | "slate"
  | "indigo";

export const ICON_TONE_BG: Record<IconTone, string> = {
  violet: "bg-violet-500",
  blue: "bg-blue-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  mint: "bg-teal-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  rose: "bg-rose-500",
  pink: "bg-pink-500",
  slate: "bg-slate-500",
  indigo: "bg-indigo-500",
};
