# Design System Audit — 2026-04-20 prod

Scope: 13 iPhone 390×844 screenshots in `docs/audit/screens/prod-*.png`, cross-referenced with the Sprint 005 primitives in `babun-crm/apps/web/src/components/ui/` and the rules in `.claude/agents/babun-design-system-keeper.md`.

Headline: the codebase is split between a newer violet/slate/shadcn-style language and an older indigo/gray one. Brand rule says **violet-600 is primary and indigo-600 is never an alternative**, but indigo still ships in 20 files and 40+ files still use `text-gray-*`/`border-gray-*` instead of slate. None of the screens actually render `Money`, `PressableButton`, or `AnimatedNumber` — grep finds each in only one page besides their own definition.

## Inconsistencies found

- **Finances — summary cards** · "Прибыль" active state uses `ring-1 ring-indigo-500 border-indigo-500` but brand primary is violet; amount color `text-indigo-600` for profit, `text-violet-700` for payroll total three blocks below → same semantic ("profit/primary amount") rendered in two colors on one screen. `apps/web/src/app/dashboard/finances/page.tsx:304, 326, 332, 361` · Use `violet-600/700` everywhere, drop indigo.
- **Finances screen 06** · "+€3 550" rendered with ad-hoc `text-[13px] font-bold tabular-nums` per card. Sprint 005 `Money` component is never imported here. `apps/web/src/app/dashboard/finances/page.tsx:332` and same in `FinanceTabs.tsx:50, 78, 125, 262` · Replace with `<Money cents={...} size="md" />`.
- **Reports (prod-08)** · Totals row uses `bg-white rounded-xl border border-gray-200 shadow-sm` (gray, not slate); inside same file clients-list-style cards use `rounded-2xl border border-gray-100 shadow-sm`. Two card recipes co-exist. `apps/web/src/app/dashboard/reports/page.tsx:101, 249, 260` · Settle on one: `rounded-2xl ring-1 ring-slate-200 shadow-xs bg-white` per keeper doc.
- **Reports / Finances / Expenses / Payroll** · Money colour for profit flips between `text-indigo-600` and `text-violet-700`. Examples: `reports/page.tsx:288, 324`, `finances/page.tsx:361`, `payroll/page.tsx:103, 111` · One token: profit/primary = `text-violet-700`.
- **Clients (prod-04) + Install banner** · Banner says "Установить Babun CRM" with an **indigo** gradient avatar (`bg-gradient-to-br from-indigo-600 to-indigo-500`) and an **indigo** CTA button on a screen whose header is violet. Mixed brand on the very screen most new users see first. `apps/web/src/components/pwa/InstallPrompt.tsx:82, 105` · Swap to `violet-600`.
- **Waitlist (prod-12)** · Empty state built inline with `bg-indigo-50 text-indigo-500 border-indigo-600 active:bg-indigo-50` — not using `EmptyState`, not violet. `apps/web/src/app/dashboard/waitlist/page.tsx:215-236` · Replace with `<EmptyState>` + violet outlined button.
- **Waitlist header** · `+` icon hover `hover:bg-indigo-600` (indigo), but all other PageHeader `+` buttons hover `hover:bg-violet-500`. `waitlist/page.tsx:72` · violet-500.
- **Expenses (prod-11)** · Inline expense form panel `border-t border-indigo-100 bg-indigo-50/40` + primary button `bg-indigo-600`. Same screen's header is violet. `apps/web/src/app/dashboard/expenses/page.tsx:159, 251, 322, 345, 361, 369, 380, 393, 425, 439, 446, 455, 474` · Mass replace indigo → violet, gray-* → slate-*.
- **Clients (prod-04)** · Page is built with 11 inline `<svg>` blocks (phone, pencil, search, plus, sort, chat, etc.) while the rest of the tree uses lucide-react. Results in subtly different stroke weights (2.0 vs 2.2 vs 2.5 in one file). `apps/web/src/app/dashboard/clients/page.tsx` · Move to lucide icons at `strokeWidth={2}` to match `BottomTabBar.tsx`.
- **Chats (prod-13)** · Only screen without the standard `PageHeader` component — header is a bare `<div class="bg-violet-600 px-3 py-3">` with no back-button alignment with the other screens. `apps/web/src/app/dashboard/chats/page.tsx:244` · Use `PageHeader`.
- **Chats — unread dot** · green `bg-green-500` badge while `ClientStatusDot` defines "active = green-600" and all other counters in the app use red/violet (see calendar unread = 2 in red). `apps/web/src/app/dashboard/chats/page.tsx` counters · Pick one: rose for unread, or green-600 if intentional, but match `ClientStatusDot`.
- **Calendar — weekly header pills (prod-01)** · "ПАФОС ПН 20" caption is 9 px uppercase — below the 11 px keeper floor. `apps/web/src/app/dashboard/page.tsx` (DayColumn/Header) · Bump to 11 px tabular.
- **"+ Расход" FAB on calendar** · violet outlined pill floating over the grid but the pattern is used nowhere else. Mid-week overlays (+ Доход on day view in prod-02) disappears. Inconsistent entry point. `apps/web/src/app/dashboard/page.tsx` · either keep on both views or drop.
- **Settings (prod-09)** · Row icons are emoji (🗓 📍 👥 ⏰ 💬 🔧 🏢) while everywhere else in the app uses lucide. `apps/web/src/app/dashboard/settings/page.tsx:37-77` · Lucide per row (`Calendar`, `MapPin`, `Users`, `Clock`, `MessageCircle`, `Wrench`, `Building2`).
- **Payroll (prod-10)** · Destructive/approve confirms use `window.confirm()`. Keeper rule #5 is "no window.confirm". `apps/web/src/app/dashboard/payroll/page.tsx:61, 67` · Use `ConfirmDialog`. Also in `recurring, teams, expenses, services, masters, sms-templates, appointment/AdminActions, IncomeBlock, ServiceRow` — 10 files total.

## Primitives not adopted yet

- **Money** · Should render every € value. Adopt in: `finances/page.tsx`, `finances/FinanceTabs.tsx`, `reports/page.tsx`, `expenses/page.tsx`, `payroll/page.tsx`, `components/calendar/DayFinanceModal.tsx`, `components/finance/ExpenseSheet.tsx`, `PaymentSheet.tsx`, `appointments/sheet/FinanceSheet.tsx`, `components/appointment/IncomeBlock.tsx`, `PaymentBlock.tsx`, `PriceEditor.tsx`, `layout/DaySummaryStrip.tsx`, `TodayChip.tsx`, `NowPill.tsx`. (Currently only `invoice.ts`, `recurring/page.tsx`, `route/page.tsx` import it.)
- **EmptyState** · Adopt in: `waitlist/page.tsx:215`, `chats/page.tsx` (empty chat list), `clients/page.tsx` (empty filter result — currently no empty state at all), `reports/page.tsx:249`, `expenses/page.tsx:425`, `payroll/page.tsx:85`, `teams/page.tsx:295`, `sms-templates/page.tsx:92,246`. Currently only `recurring/page.tsx` and `route/page.tsx` use it.
- **PressableButton** · Every full-width primary / destructive CTA should wrap in it for uniform active-scale + haptic. Highest-leverage spots: `AppointmentSheet` footer buttons, `PaymentSheet`, `ExpenseSheet`, `CreateClientModal`, `ConfirmDialog` buttons, `clients/page.tsx` action row (Записать / Чат / Позвонить).
- **AnimatedNumber** · Wire into the "Заработано сегодня" / day total in `DaySummaryStrip.tsx` and `TodayChip.tsx`, and the 4-card top strip on Finances so the number visibly transitions when switching period.
- **ClientStatusDot** · Not rendered on the clients list (prod-04) yet — the avatar circles carry brigade colour but there's no status colour dot for debtor/new/lost. Add to `apps/web/src/app/dashboard/clients/page.tsx` row.

## Contrast + a11y

- **prod-01 weekday column captions** · `text-white/70` on mid-blue gradient city/day pill is ~3.1:1 — fails AA for text under 18 px. `apps/web/src/app/dashboard/page.tsx` DayColumn header · raise to `text-white` (full) or darken the gradient by one stop.
- **prod-07 Reminders subtitle** · "После выполненной записи… создаст карточку" uses `text-slate-500` (approved), but the teal/emerald fallback in `EmptyState.tsx:34` (`text-sm text-slate-500`) is right at the edge on the slate-50 background. OK at 14 px, fails at 12 px. Keep at `text-sm` min.
- **prod-08 reports table date column** · `text-[12px] text-gray-500` on white is 4.6:1 — passes, but the "—" dash for empty expense uses `text-rose-500` at 12 px against white — `text-rose-500` has contrast 3.4:1. `apps/web/src/app/dashboard/reports/page.tsx` dash cell · `text-slate-400` or larger weight.
- **prod-12 waitlist "Не актуал…"** · Chip text is cut off. Not a contrast issue but a horizontal-overflow clipping issue — should `truncate` or allow wrap.
- **prod-04 client list row phone number** · `text-gray-500` at 13 px on slate-50 card = 4.4:1 (barely AA). Safe, but the number is the secondary ID — bump to `text-slate-600`.
- **prod-06 Финансы "+100%" delta** · green `text-emerald-600` on white at 10 px is 3.0:1 — under AA. `finances/page.tsx:313, 315` · Minimum 12 px or bump to `emerald-700`.

## Proposed bundle for Sprint 011-design-cleanup

1. **S — Purge indigo** · Codemod `indigo-` → `violet-` (preserve info-sky). Affects 20 files. Manual check on ring/active states.
2. **S — Gray → slate sweep** · `text-gray-*`, `bg-gray-*`, `border-gray-*` → slate equivalents across the 40 offender files. Keeps keeper's neutral floor.
3. **S — Adopt `<Money>` in finance surfaces** · finances, FinanceTabs, reports, expenses, payroll, DayFinanceModal, DaySummaryStrip, TodayChip. Remove hand-rolled `text-*-*xx tabular-nums` money spans.
4. **S — Adopt `<EmptyState>` in 8 screens** · waitlist, chats, clients (no-result), reports, expenses (no-data), payroll, teams, sms-templates. Delete inline empty blocks.
5. **S — Kill `window.confirm`** · Replace 12 call-sites with `<ConfirmDialog>`. Keeper rule #5 (destructive actions).
6. **S — Unify card recipe** · One helper `<Card>` (or class constant `CARD = "bg-white rounded-2xl ring-1 ring-slate-200 shadow-xs"`). Replace `border border-gray-100 shadow-sm` / `border border-gray-200 shadow-sm` variants (43 hits).
7. **S — Inline SVG → lucide-react** · Clients page (11 icons), settings nav (7 emojis), chats search/send icons. Align `strokeWidth={2}` with the bottom tab bar.
8. **S — Install banner rebrand** · `InstallPrompt.tsx` gradient and CTA → violet. One-file, one-commit.

Optional stretch: add `src/lib/z-index.ts` now (three screens already have conflicting z-70/z-80/z-95 literals) — the keeper ladder is specced but not codified.
