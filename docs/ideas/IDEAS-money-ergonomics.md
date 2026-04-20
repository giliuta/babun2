# IDEAS — Money Ergonomics

Owner-focused calculation, discount, payment, and cashflow-visibility ideas for Babun2 (AirFix, Cyprus).
Anchor context: `lib/finance/appointment-calc.ts`, `lib/money.ts`, `IncomeBlock.tsx`, `/dashboard/finances`, `/dashboard/reports`, audit blocker #11 (`finances` vs `reports` diverge).

## Pre-requisite blocker (must land first)

**P0. One source of truth for profit.**
Extract `lib/finance/compute.ts` so `finances` and `reports` both read the same `computeProfit(range, scope)`. Every idea below **depends on this** — otherwise any new calculation surface multiplies the math-trust problem.
Risk if skipped: catastrophic. Owner stops trusting the app within a week.

---

## Idea catalogue

### 1. Inline discount/adjust calculator in IncomeBlock
- **What:** inside the IncomeBlock popup, allow natural tokens `+10% нагрев`, `-5€ поставщик`, `+20€ вызов`. Parser appends a labeled line or adjustment, not a free-form memo.
- **Who:** dispatcher, brigade
- **Complexity:** M (tokenizer + UI)
- **Math:** trivial — arithmetic on existing `subtotal`/`applyDiscount` helpers
- **Risk:** MEDIUM. Free-text parsing can mis-apply. Mitigate with preview chip before commit.

### 2. Split payment presets
- **What:** saved templates — `50/50 cash+card`, `30/70 trusted client`, `full card` — tap to apply on Payment step. Owner can edit the preset list in Settings.
- **Who:** dispatcher, owner
- **Complexity:** S
- **Math:** trivial — ratio split of `total`
- **Risk:** LOW. Presets are suggestions; user still confirms.

### 3. Round-up to clean total
- **What:** near the grand-total in IncomeBlock, two chips: `→ €47` (floor to nearest €) and `→ €50` (next multiple of 5). One tap writes a global discount/surcharge labeled "округление".
- **Who:** dispatcher, brigade (on-site)
- **Complexity:** S
- **Math:** trivial
- **Risk:** LOW — but **the rounding line must be a first-class `Discount` record**, not invisible, or reports/payroll will drift.

### 4. Monthly target widget
- **What:** header of `/dashboard/finances`: "Цель €10 000 · сделано €6 200 · осталось 12 дней". Target editable per-brigade and global.
- **Who:** owner
- **Complexity:** M (target storage + progress calc)
- **Math:** sum of paid appointments in `[monthStart, today]` vs target; pacing = target × days_elapsed / days_in_month
- **Risk:** LOW if reading through unified `computeProfit`. HIGH if it shows a fourth "truth".

### 5. VAT 19% toggle (Cyprus)
- **What:** settings flag `vatMode: "inclusive" | "exclusive" | "off"`. On Payment and on Finances KPI cards: "Клиент заплатил €119 · из них VAT €19 · чистое €100". Per-appointment override for cash-off-the-books.
- **Who:** owner
- **Complexity:** L — touches Payment, IncomeBlock, Reports, payroll base, and future receipts
- **Math:** moderate — `net = gross / 1.19` with cents-safe rounding (`lib/money` must expose `splitVat`)
- **Risk:** HIGH. VAT errors = tax-audit pain. Ship behind a beta flag, unit-tested, with daily reconcile report.

### 6. Expense quick-add from calendar
- **What:** swipe-down on any day-cell or the dashboard topbar opens a 2-field sheet: `сумма · категория · (бригада auto)`. Saves to expenses and closes. No page navigation.
- **Who:** brigade, dispatcher
- **Complexity:** M (gesture + sheet; category autocomplete from `expense-categories.ts`)
- **Math:** trivial — insert row
- **Risk:** MEDIUM. Accidental swipes during calendar scroll. Require a 2nd tap confirmation chip.

### 7. Brigade salary preview in AppointmentSheet
- **What:** on the Payment step, tiny row: "Y&D получит €34 (22% от €150 − расходники)". Live-updates with discount/services edits.
- **Who:** brigade (transparency), owner (sanity check)
- **Complexity:** S (read-only projection)
- **Math:** moderate — applies brigade percentage rule + per-line material deductions
- **Risk:** MEDIUM. If preview ≠ eventual payroll row, trust gone. Must be the same function payroll uses.

### 8. Commission / daily-norm alert
- **What:** when a brigade's pending commission today > configurable norm (e.g. €120), show a soft amber bar on their row in `/dashboard/finances`. Owner-only.
- **Who:** owner
- **Complexity:** S once #7 exists
- **Math:** sum of today's projected commissions per brigade vs norm
- **Risk:** LOW — informational only, no auto-action.

### 9. Profit-per-visit tag (quiet)
- **What:** in AppointmentSheet view mode, under the total: small gray "Чистая прибыль €28". Owner sees it; brigade view hides it via role flag.
- **Who:** owner
- **Complexity:** M (role-gated render + net calc including materials, commission, proportional overhead)
- **Math:** non-trivial — `net = paid − commission − line_materials − allocated_overhead`
- **Risk:** MEDIUM. Net profit definition is political; document the formula in `docs/finance-model.md` first, then surface.

### 10. Currency picker on Payment (€ / ₺ / $)
- **What:** dropdown next to amount, live conversion using a daily-refreshed ECB rate cached locally. Stored record is always cents in €, plus `paid_in_currency` and `rate_snapshot`.
- **Who:** dispatcher, owner (tourist / Turkish lira edge cases)
- **Complexity:** M (rate fetch + storage shape)
- **Math:** multiplication + rounding; the storage shape is the hard part
- **Risk:** HIGH if rates silently drift. Ship with a visible "курс от 19 апр 2026" label.

### 11. Receipt QR after payment
- **What:** on successful Payment, generate a PDF receipt (services, VAT, brigade, date, signature placeholder) and display a QR. Client scans → downloads. No email required.
- **Who:** client, dispatcher (gives legitimacy)
- **Complexity:** L (PDF lib + short-link table)
- **Math:** none beyond #5
- **Risk:** MEDIUM — tax-doc territory. MVP as "internal receipt", add legal VAT number/company block in Settings before marking as tax receipt.

### 12. Cashbox reconciliation
- **What:** on `/dashboard/finances` Cashbox card, a single input: "Факт в кассе сейчас: €___". Saving stores `expected`, `actual`, `delta`, `counted_at`. Running list of deltas highlights recurring shortages.
- **Who:** owner
- **Complexity:** M (new table + trend line)
- **Math:** `expected = opening + cashIncoming − cashExpenses − payouts`. Depends on P0.
- **Risk:** HIGH. This is literally what owner will pressure-test the CRM with. Must be bullet-proof — full audit trail, no silent edits.

### 13. Debt tracking on client profile
- **What:** if `paid < total`, diff is stored as a `ClientDebt` and the client card gets a red badge "Должен €20". Finances KPI: total receivables.
- **Who:** owner, dispatcher
- **Complexity:** M (debt lifecycle: created, partially repaid, closed)
- **Math:** moderate — depends on Payment model supporting partial payments (check `lib/payments.ts` first)
- **Risk:** MEDIUM. A stale debt badge on a paying client = awkward field call. Offer a "mark as written off" action.

### 14. Weekly financial email / PWA push
- **What:** Monday 08:00 CY time, owner-only digest: "Неделя 13–19 апр: доход €2 345 · расход €680 · ЗП бригад €412 · чистая €1 253 · топ-клиент · топ-услуга". Starts as in-app card; email once Supabase + auth are in.
- **Who:** owner
- **Complexity:** M (scheduler + templated report)
- **Math:** depends entirely on P0 — this IS the trust moment
- **Risk:** LOW functionally, HIGH reputationally — the first wrong digest breaks confidence.

### 15. "Сколько заработали сегодня" 3-second glance
- **What:** at top of dashboard, one line, big number: `Сегодня: +€340 · в кассе €180 · в карте €160`. Tap → breakdown. Replaces the need to enter `/finances` for the morning-coffee question.
- **Who:** owner
- **Complexity:** S (if P0 done)
- **Math:** reuses `computeProfit({range: 'today'})`
- **Risk:** LOW — it's the hero widget. Delay until P0 lands.

---

## Prioritisation (suggested)

| Order | Idea | Why |
|---|---|---|
| 0 | **P0 unify profit calc** | All downstream trust |
| 1 | #15 Today glance | Owner's daily ritual, cheap after P0 |
| 2 | #3 Round-up + #2 Split presets | On-site friction killers for brigade |
| 3 | #7 Brigade salary preview | Transparency with brigade = retention |
| 4 | #12 Cashbox reconciliation | Owner's #1 trust test |
| 5 | #5 VAT toggle | Blocks future receipts & legal mode |
| 6 | #4 Monthly target + #14 weekly digest | Owner engagement loop |
| 7 | #1 Inline calculator · #6 Expense quick-add | Power-user efficiency |
| 8 | #9 Profit-per-visit · #8 Commission alert | Deeper analytics |
| 9 | #10 Currency · #11 Receipt QR · #13 Debts | Platformization / SaaS features |

## Cross-cutting rules (must observe before any idea ships)

1. **All math through `lib/finance/*`.** No page-level arithmetic. (Agent rule `babun-finance-expert.md`.)
2. **Money in cents internally**, render via `formatEUR`. Never inline `€${amount}` (audit rule).
3. **Every adjustment is a first-class record** (discount, surcharge, rounding, write-off). Never a silent mutation — payroll and reports must be able to explain every cent.
4. **Owner must be able to audit** any number by tapping it → shows contributing rows. A non-auditable KPI is a bug.
5. **Cyprus VAT 19%** and lira/euro duality are not edge cases — they are the base configuration.
