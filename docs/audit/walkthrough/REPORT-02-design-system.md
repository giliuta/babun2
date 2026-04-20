# REPORT-02 — Design-system audit (mobile 390×844)

Material: `docs/audit/walkthrough/01-..25-*.png` (26 screens) plus source scan across `babun-crm/apps/web/src`.

## 1. Typography — no scale exists

There is no shared type primitive. Grep for arbitrary pixel literals (`text-[11px]`, `text-[13px]`, `text-[18px]`, `text-[20px]`, `text-[40px]`…) returns **732 hits across 84 files**. The same "page title" appears at `text-[17px] font-semibold` in `PageHeader.tsx`, at `text-[20px] font-bold` in calendar `Header.tsx` (`01-dashboard-week.png`, `25-day-with-apt.png`), and at `text-[18px] font-semibold` in `CityPickerModal.tsx:83`. Numeric columns in Reports (`09-reports.png`) use `text-emerald-600` while the identical concept on Finances (`08-finances.png`) uses `text-green-600` — two greens for one semantic.

Money is the worst. `<Money>` at `src/components/ui/Money.tsx` defines sizes `sm|md|lg|xl|hero` but is **imported nowhere** (`grep "from.*Money"` → 1 file, itself). `formatEUR` is called directly in **22 files** — each picks its own weight and size. On `08-finances.png` the income tiles are `text-lg font-semibold`; the same summary tiles on `09-reports.png` use a different rhythm. `tabular-nums` only ships via `<Money>` — so in the Reports table (`09-reports.png`), "+€690" and "+€120" don't line up glyph-to-glyph. Debt pill vs VAT pill (`09` "€567 к уплате") use unrelated type recipes (`text-[11px]` vs `text-sm`).

The new compact day header 52px (`01-dashboard-week.png`) reads fine. "ПН **20**" numeral has strong contrast in white on cyan. No issue here.

## 2. Colour — violet clean, gray/slate leakage

Indigo codemod landed: zero `indigo-*` classes remain. Violet is the brand in FAB (`01`), tab-active (`01 Календарь`), progress bars (`11-payroll`), and primary CTA (`22-settings-calendar`).

But `text-gray-*` (**597 uses in 50 files**) and `text-slate-*` (**256 in 37 files**) are both alive. `EmptyState.tsx` uses slate; every dashboard page uses gray. `<ClientStatusDot>` defines amber = `#d97706`, but the "Без ответа" pill (`07-chats.png`) is `bg-orange-100/text-orange-700` — yet another warning tone. Rose is used for destructive (`19-teams.png` trash) and negatives (`08 "-€1 065"`) — consistent.

**Stale "indigo" union literal** in `reports/page.tsx:95` — `color: "emerald" | "rose" | "indigo"` with class `text-violet-600`. Just rename.

## 3. Card recipe — Sprint 012 never finished

Old recipe `rounded-2xl border border-gray-100 shadow-sm` is still in **9 pages**: `clients`, `reports`, `settings`, `settings/cities`, `settings/calendar`, `settings/booking`, `payroll`, `expenses`, `brigades`. New recipe `ring-1 ring-slate-200` is in 3: `settings/company`, `recurring`, `b/[token]`. Two recipes side by side = every screen has a different edge. Compare `20-schedule.png` (no card at all), `21-sms-templates.png` (border-gray-100), `17-services.png` (tinted-header cards with accent bar).

Card padding varies: services `p-3`, brigade `p-4`, reports `px-4 py-3`, waitlist empty `py-10` without a card. Inter-card rhythm drifts between `space-y-3` and `space-y-4`.

## 4. Icons — lucide adopted in 3 files total

`from "lucide-react"` appears in **3 files only**: `BottomTabBar`, `CreateMenu`, `Sidebar`. Elsewhere: **159 inline `<svg>`** across 57 files. `settings/page.tsx:38-65` uses emoji icons (🗓 📍 👥 ⏰) — visible in `15-settings.png`. `expenses/page.tsx:20-27` uses emoji for every category (🍽 🚗 ⛽ 🔧 💰 📋) — visible in `10-expenses.png`. Messengers in `06-client-profile.png` use filled brand glyphs, breaking the line-icon language of the rest of the app. Stroke widths drift.

## 5. Empty states — `<EmptyState>` is a ghost

Used in exactly 3 files: `EmptyState.tsx`, `route/page.tsx`, `recurring/page.tsx`. Every other empty scene hand-rolls one:
- `13-waitlist.png` — inline div, violet-50 circle, custom CTA (`waitlist/page.tsx:215-234`)
- `10-expenses.png` — card wrapper + 📊 emoji (`expenses/page.tsx:425`)
- `20-schedule.png` — bare centred grey paragraph, no icon, no card
- `11-payroll.png` — no empty affordance when week is zero; "€0" with disabled CTA feels broken

## 6. Modals and sheets — CityPicker violates the rule

`CityPickerModal.tsx:63` sets `flex items-end` → bottom sheet. `04-city-picker.png` confirms. Memory `feedback_center_modals.md` and the comment in `CreateMenu.tsx:22` say every popup is centred. `ActionMenuModal.tsx` is also a bottom sheet. `ConfirmDialog`, `CreateMenu`, `ReportsDialog`, `ColorPickerModal` centre correctly. Backdrop alternates between `bg-black/40` and `bg-black/50`. No backdrop-blur anywhere.

## Proposed Sprint 019 — Design-Polish-2

1. **Type scale primitive** — add `src/components/ui/Text.tsx` with variants `display|title|h1|h2|body|label|caption`. Codemod 17 worst-offender files (PageHeader, Header, CreateMenu, all `reports`/`finances`/`payroll`/`expenses` pages, ClientProfileView, settings/page). Kill 400+ of the 732 arbitrary `text-[Xpx]`.
2. **Adopt `<Money>` everywhere** — codemod the 22 `formatEUR` call sites to `<Money cents={…} size="md|lg|xl" />` (Reports table, Finances cards, Payroll rows, AppointmentSheet IncomeBlock, TodayGlance).
3. **Finish card-recipe migration** — replace `rounded-2xl border border-gray-100 shadow-sm` with `rounded-2xl bg-white ring-1 ring-slate-200 shadow-xs` in the 9 listed pages. Add a tiny `<Card>` wrapper.
4. **Unify gray → slate** — mechanical codemod `text-gray-*` → `text-slate-*` across 50 dashboard files.
5. **Lucide-ify settings & expenses** — migrate `settings/page.tsx` emoji nav and `expenses/page.tsx` category emoji to lucide (`CalendarDays`, `MapPin`, `Users`, `Clock3`, `MessageSquare`, `Wrench`, `Building2`, `Utensils`, `Car`, `Fuel`). Stroke width 2, size 20/22.
6. **Centre CityPickerModal + ActionMenuModal** — in `CityPickerModal.tsx:63` change `items-end`→`items-center`, drop `rounded-t-3xl`→`rounded-2xl`, remove grabber. Same for `ActionMenuModal.tsx`.
7. **Universal empty state** — rewrite `waitlist`, `expenses`, `payroll`, `schedule` inline empty blocks to use `<EmptyState>` with lucide icons.
8. **Consolidate status tones** — `orange-*` usages in `chats/page.tsx` (pending-reply pill) → `amber-*` to match `ClientStatusDot`. Add `src/lib/tokens.ts` with `STATUS_TONES`.
9. **Fix stale "indigo" union** — `reports/page.tsx:95` rename union literal to `violet`.
10. **Tabular-nums default** — add `font-variant-numeric: tabular-nums` to `<body>` in `globals.css`. Cheap, fixes Reports table alignment, AppointmentSheet totals, brigade payroll rows without codemod.

Scope: ~8–10 codemod-shaped PRs, no new features. Bump `BUILD_TAG` → `v{N+1}-design-polish-2` and `CACHE_VERSION` once at end.
