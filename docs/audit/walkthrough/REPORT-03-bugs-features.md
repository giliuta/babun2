# Audit Report 03 — Bugs round 2 + missing flows

**Source reviewed:** 26 screenshots `docs/audit/walkthrough/01-*.png` … `25-*.png` + source in `babun-crm/apps/web/src/`.
**Already known:** BUG #1 (FAB `?new=1` silent nav), BUG #2 (CityPicker bottom-sheet), BUG #3 (screenshot 03 proof of #1).

---

## 1. Confirmed new bugs

### BUG #4 — `/dashboard/schedule` shows "Сначала создайте бригаду" although brigades exist
Screenshot `20-schedule.png` contradicts `18-brigades.png` (3 active brigades). Source `src/app/dashboard/schedule/page.tsx:21`:
```tsx
const [teamId, setTeamId] = useState<string>(activeTeams[0]?.id ?? "");
```
The lazy init snapshots an empty array at first render (the outer `DashboardLayout` hydrates teams async from localStorage). `teamId` stays `""` forever → early-return at line 57–66 shows the empty state.

**Fix (3 lines):**
```tsx
const [teamId, setTeamId] = useState<string>("");
useEffect(() => {
  if (!teamId && activeTeams[0]) setTeamId(activeTeams[0].id);
}, [activeTeams, teamId]);
```

### BUG #5 — `Money` UI component is a 100×-too-big footgun waiting to ship
`src/components/ui/Money.tsx:45`:
```tsx
return <span className={classes}>{formatEUR(cents)}</span>;
```
Comment on line 9 says "Value is in cents" but the render calls `formatEUR(cents)` — exactly the `amountCents → €X·100` bug that `formatEURFromCents` exists to prevent. No current call sites, so nothing visibly broken, but the next developer who writes `<Money cents={amountCents} />` ships €45 000 instead of €450. **Fix:** `formatEURFromCents(cents)` on line 45 and in the `AnimatedNumber` wrapper on line 40.

### BUG #6 — 14 `window.confirm` / `alert` / `prompt` sites violate "every popup centred on screen"
Memory rule `feedback_center_modals.md` explicitly forbids these. Sites:
- `src/components/appointment/ServiceRow.tsx:177`, `IncomeBlock.tsx:160`, `AdminActions.tsx:21`
- `src/app/dashboard/teams/page.tsx:95` + `alert` on :439
- `src/app/dashboard/sms-templates/page.tsx:35`, `services/page.tsx:63`, `masters/page.tsx:82`, `recurring/page.tsx:80`
- `src/app/dashboard/expenses/page.tsx:144, 145, 305` (alerts + confirm)
- `src/app/dashboard/payroll/page.tsx:61, 67`
- `src/components/appointment/AppointmentSheet.tsx:948, 950, 953`

**Fix:** new `src/components/ui/ConfirmDialog.tsx` (centred modal with title/body/destructive/cancel) + `useConfirm()` hook; replace every call site. Inline errors via the pattern already in `ClientPickerSheet`.

### BUG #7 — Expense quick-add: validation is a native `alert`, no field highlight
`src/app/dashboard/expenses/page.tsx:142–156`. If amount is empty → `alert("Введите сумму")` → dismiss → nothing visibly changed → users think "Добавить" is broken.
**Fix:** `const [err, setErr] = useState<string|null>(null)`, render a 12-px red line beneath the amount input, drop lines 144–145.

### BUG #8 — Share-link flow inside AppointmentSheet falls back to `window.alert` + `window.prompt`
`src/components/appointment/AppointmentSheet.tsx:937–954`. After `navigator.share` fails, clipboard-write fallback fires `window.alert("Ссылка скопирована — отправьте клиенту")`; if `navigator.clipboard` is unavailable it drops into `window.prompt("Ссылка:", url)` — browser-chrome dialog inside a violet-branded sheet.
**Fix:** 2-s `<Toast>скопировано</Toast>` + fallback share-sheet (read-only input + "Скопировать" button).

### BUG #9 — Company-settings fields accept any string, no validation
Screenshot `16-settings-company.png`. Source `src/app/dashboard/settings/company/page.tsx`. VAT, email, phone, site fields write raw value on blur. No `type="email"`, no VAT regex, no phone format check. "abc" saves silently.
**Fix:** single `validateCompany(profile)` returning `{field, message}[]`; inline errors; disable Save when any error.

### BUG #10 — Settings sub-pages' back-arrow dumps user to calendar, not back to Settings menu
Default behavior in `src/components/layout/PageHeader.tsx:34` is `router.push("/dashboard")`. `calendar/page.tsx:41–54` opts out with custom `leftContent` link back to `/dashboard/settings`. `cities/page.tsx`, `company/page.tsx`, `booking/page.tsx` do NOT — so tapping back from those sub-pages wipes context and lands on the week view.
**Fix:** add a `backHref?: string` prop to `PageHeader`; pass `"/dashboard/settings"` from every sub-page.

### BUG #11 — Route-of-the-day silently hides `kind === "event"` appointments
`src/app/dashboard/route/page.tsx:69` filters `a.kind === "work"`, silently dropping lunch/break/personal events seeded by `event-presets.ts`. Dispatcher checks route on a day known to have activity, sees "На этот день записей нет" (screenshot `14-route.png`) and loses trust.
**Fix:** drop the kind filter (route already filters addresses) or add a subtle "+ N событий скрыто" chip with a toggle.

### BUG #12 — No mobile reschedule path; dnd-kit is desktop-only and the promised menu item is missing
`src/app/dashboard/page.tsx:650–652` enables only `MouseSensor`. Comment says "Users can still reorder records via the menu's «Перенести запись»" — grepping the codebase for `Перенести` returns zero matches. `ActionMenuModal.tsx` has no such entry. Mobile users cannot move an appointment short of delete + re-create.
**Fix:** add "Перенести" to `ActionMenuModal` that opens a time/date picker (centred, per rule) and calls the same update path as the desktop drag.

### BUG #13 — Schedule empty-state is a dead-end (no "Создать бригаду" CTA)
`src/app/dashboard/schedule/page.tsx:57–66`. When genuinely no brigades exist the user sees text only, no link/button. (Currently masked by BUG #4, but remains after that fix.)
**Fix:** add a `<Link href="/dashboard/teams">+ Создать бригаду</Link>` under the text.

---

## 2. Missing dispatcher flows

**M1 — Morning briefing.** No first-open-of-day summary screen. `src/components/layout/TodayGlance.tsx` is a strip above the grid, not a dedicated card, and it's not pinned. Missing: today's appt count + first departure + total expected revenue + debts ≥ 14 d.

**M2 — Close-the-day.** `EndOfDayBanner.tsx` imports `DaySummaryStrip` but there is no sheet to *confirm cashbox* and *lock the day*. Finances already computes `В кассе должно быть` (screenshot `08-finances.png`) but you cannot "sign off".

**M3 — Mobile reschedule.** Covered by BUG #12.

**M4 — Global search (⌘+K).** `src/lib/client-search.ts` only searches within `/dashboard/clients`. A phone number typed anywhere else has no entry point.

**M5 — Share-link visibility.** Shipped in Sprint 002 but entry only exists inside `⋯`. Dispatchers forget the feature exists.

---

## 3. Proposed Sprint 019 — "Polish + bugs-round-2"

### Bugs (10 picks)
| # | File:line | Fix sketch |
|---|---|---|
| 1 | `src/app/dashboard/page.tsx:599,627` | Replace `window.location.search` read with `useSearchParams()` dependency, or listen to a `babun:nav` event the BottomTabBar fires after its `router.push`. |
| 2 | `src/components/calendar/CityPickerModal.tsx:63,67` | `items-end` → `items-center`; drop `rounded-t-3xl`, grabber, bottom-pad. |
| 3 | `src/app/dashboard/schedule/page.tsx:21` | `useState("")` + sync effect on `activeTeams`. |
| 4 | `src/components/ui/Money.tsx:40,45` | `formatEURFromCents(cents)`. |
| 5 | `src/components/ui/ConfirmDialog.tsx` (new) + 14 replacements | Centred dialog + `useConfirm()` hook. |
| 6 | `src/app/dashboard/expenses/page.tsx:144,145` | Inline validation state. |
| 7 | `src/components/appointment/AppointmentSheet.tsx:948–954` | Toast + branded share-sheet. |
| 8 | `src/app/dashboard/route/page.tsx:69` | Drop `kind === "work"` filter or add "события" toggle. |
| 9 | `src/components/layout/PageHeader.tsx:34` + `settings/{cities,company,booking}/page.tsx` | `backHref` prop + pass it. |
| 10 | `src/app/dashboard/settings/company/page.tsx` | `validateCompany()` + inline errors. |

### Features (5)
- **F1 Morning briefing** — new `src/components/calendar/MorningBriefing.tsx`, auto-expands 06:00–10:00; per-day dismiss via localStorage. Addresses M1.
- **F2 Close-the-day sheet** — new `/dashboard/close-day` route; snapshot of today's scheduled/in-progress; single "Все выполнены"; cashbox confirmation; writes `dayExtras.closed_at`. Entry point in `EndOfDayBanner.tsx`. Addresses M2.
- **F3 Merge Recurring + Waitlist** into `/dashboard/inbox` — keeps the two `lib/` models separate, unifies them in one list with sub-tabs `Напоминания · Лист ожидания · Все`. Deprecates two sidebar entries. Addresses BUG #12 ambiguity (users confuse the two identical empty-state screens `12-recurring.png` and `13-waitlist.png`).
- **F4 Global search** — new `src/components/search/GlobalSearch.tsx`; reuses `client-search.ts`; searches clients + appointments (address/comment); triggered via long-press on "Календарь" tab (mobile) or `⌘K` (desktop). Addresses M4.
- **F5 Inline "Для клиента" share chip** — add a pill next to client phone at ~`AppointmentSheet.tsx:720` that calls the existing share flow (also cures BUG #8 surfacing). Addresses M5.

**Estimate:** bugs 2–3 d; F1/F2 ≈ 1 d each; F3/F4 ≈ 1.5 d each; F5 ≈ 0.5 d. ≈ 8 dev-days.
