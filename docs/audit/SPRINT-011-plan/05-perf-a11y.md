# Perf + A11y Audit — 2026-04-20 prod

Source: `docs/audit/lighthouse/report.json` (mobile, 412×823, prod `/dashboard`). Scores: A11y 87, BP 96, SEO 100.

## Ship-blocker

### React #418 hydration mismatch (fires twice on /dashboard)
Error #418 = "text content did not match". Both stack traces point to the same minified frame, which means **two hydration boundaries** on `/dashboard` render different text on server vs client.

Prime suspects in `src/app/dashboard/page.tsx`:
- **Line 115** — `useState(() => getMonday(new Date()))`. `new Date()` at module/render time on the server is the deploy time; on client it's now. If SSR runs (it shouldn't for `"use client"` at line 1, but Next 16 still prerenders client components unless opted out), weekday-dependent markup will differ.
- **Line 545, 593** — `new Date().toISOString().slice(0, 10)` inside handlers is fine; initial-state calls are not.
- **Lines 133–136** — `window.innerWidth < 1024 ? "day" : "week"` in `useState` initializer is guarded by `typeof window === "undefined"` returning `"week"`, which is correct, but **prerender emits view-mode-dependent markup with `"week"` while client may hydrate with `"day"`**. This is almost certainly the second #418.

**Debug path:** run `NEXT_PUBLIC_HYDRATION_DEBUG=1 next build && next start` locally with React dev build; the non-minified error names the element. **Fix:** initialize view-dependent state to a stable server value, then set the real value in `useEffect` (after mount). For the date, store `null` initially and populate in `useEffect` — don't render date-dependent UI until hydrated, or wrap in `<ClientOnly>`.

## A11y fixes

| Audit | Element | Source | Fix |
|---|---|---|---|
| color-contrast 4.24:1 | Team tab text `text-violet-200` on `bg-violet-600` | `src/components/layout/Header.tsx:273` | Change inactive tab to `text-violet-100` (≈5.3:1) or add `font-medium` (still off at 13px normal). Cleanest: `text-white/80` with `font-medium`. |
| color-contrast 2.6:1 (3x) | Bottom-nav inactive labels `text-gray-400` (#99a1af) on white | `src/components/layout/BottomTabBar.tsx:134` | Replace `text-gray-400` with `text-gray-500` (#6a7282, 4.69:1). Affects Клиенты / Чаты / Финансы labels + icons. |
| label-content-name-mismatch | `aria-label="Сегодня"` but visible text is current day number "20" | `src/components/layout/Header.tsx:121-136` | Include visible text in accessible name: `aria-label={\`Сегодня, ${todayNumber}\`}` or drop aria-label and add `<span className="sr-only">Сегодня, {todayNumber}</span>`. |
| label-content-name-mismatch | `role="button"` div with `aria-label="Сменить город этого дня"` but visible text is "ПАФОС ПН 20" | `src/components/calendar/DayColumn.tsx:200-203` | Append visible text: `aria-label={\`Сменить город: ${cityShort || 'не задан'}, ${dayName} ${date.getDate()}\`}`. |
| landmark-one-main | No `<main>` in document | `src/app/dashboard/layout.tsx:717` | Change `<div className="flex-1 lg:ml-[240px] flex flex-col min-h-0 min-w-0 pb-[72px] lg:pb-0">` to `<main …>`. Single one-line fix covers all dashboard sub-pages. |
| meta-viewport `user-scalable=no` | `src/app/layout.tsx:37-44` | **Keep as-is.** Intentional per CLAUDE.md "iOS Safari pinch-zoom on calendar works only with `userScalable: false`". Suppress via Lighthouse config, not code. Add note to report; don't fight WCAG 1.4.4 trade-off until we split calendar pinch-zoom from the rest. |

After fixes 1–5 land, A11y score should clear 98+; #6 stays documented as a deliberate deviation.

## Dependency hygiene

- **`lucide-react ^1.8.0`** — verified against `node_modules/lucide-react/package.json`: it IS the canonical package (author "Eric Fennis", repo `lucide-icons/lucide`). v1.0 shipped late 2025 with React 19 peer support. Not a fork — false alarm. `sideEffects: false` is set, Turbopack tree-shakes per-icon imports correctly. Only 2 consumers (`BottomTabBar.tsx`, `Sidebar.tsx`) — surface minimal.
- **Other watchouts:**
  - `jspdf ^4.2.1` — 350 KB gzipped. Only used in `components/reports/ReportsDialog.tsx`. Dynamic-import it: `const { jsPDF } = await import("jspdf")` inside the "Скачать PDF" handler. Saves ~350 KB off initial bundle.
  - `@supabase/ssr` + `@supabase/supabase-js` — loaded but we're still on localStorage (STORY-001 not merged). If the client is instantiated at module scope anywhere, it adds ~80 KB dead weight. Verify lazy init.

## Performance wins

1. **Lazy-load jspdf** (see above) — single biggest initial-bundle win, ~350 KB.
2. **`next/font` Inter subset** — `layout.tsx:6-9` subsets `["latin", "cyrillic"]` but loads all weights implicitly. Pin to `weight: ["400","500","600","700"]` — Inter VF is ~300 KB; a static subset is ~60 KB.
3. **`MiniCalendar`, `ReportsDialog`, `ExpensesDialog`, `IncomeDialog`** — all conditionally rendered but statically imported. Wrap in `next/dynamic` with `ssr: false` — defers parsing until user opens each sheet.
4. **Add `<link rel="preconnect">`** for `fonts.googleapis.com` + `fonts.gstatic.com` in `layout.tsx` head via `<head>` segment (Next 16 supports it in metadata) — saves ~150 ms TTFB on font fetch.
5. **Service-worker precache too broad?** `public/sw.js` (`babun-v181`) — if it precaches route chunks, calendar drag-drop chunks sit in precache forever. Audit `sw.js` precache list; keep only shell (HTML, fonts, manifest, icons), let runtime cache handle chunks with stale-while-revalidate.

Bonus: bump `BUILD_TAG` + `CACHE_VERSION` to `v182-a11y` when shipping the a11y fixes above (per Golden Rule 3).
