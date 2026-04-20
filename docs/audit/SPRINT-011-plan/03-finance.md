# Finance Audit — 2026-04-20 prod

Scope: /dashboard/finances, /reports, /payroll, /expenses on babun2.vercel.app.
Grounded in `lib/finance/compute.ts`, `useFinanceData.ts`, the four page files,
`lib/money.ts`, `lib/reconciliations.ts`, `lib/finance/vat.ts` + company
settings, and the four prod screenshots.

## Correctness

### Verified working
- **Single-source totals (Sprint 007).** Both `/finances` and `/reports` go
  through `computeFinancials()` with the same filter helpers
  (`inFinanceRange`, `teamMatches`, material-cost inclusion). On the "all"
  brigade + "last 30 days" / "этот месяц" intersection they tally **€3 550
  доход, €0 расход, +€3 550 прибыль** on both screens — claim holds.
- **Completed/in-progress gating** — skips drafts, waitlist, cancelled.
  (`compute.ts:161`)
- **Cash/card split** is derived once (`compute.ts:178-188`) from
  `apt.payments[].method`; prepaid is assumed cash — documented inline.
- **VAT split function** is numerically right (inclusive = `net = round(gross/1+r)`,
  `vat = gross-net`; exclusive adds, round once). `splitVat` total
  preservation property verified by inspection.

### Suspected bugs (with what to grep / test)

1. **Cents passed into a euro formatter — /expenses and /payroll are 100×
   wrong the moment real money arrives.** `formatEUR` in `lib/money.ts:10`
   does `Math.round(amount)` and treats it as euros. But every call-site
   listed below feeds *cents*:
   - `expenses/page.tsx:343, 407, 456, 474` — total, per-category, per-row.
   - `payroll/page.tsx:104, 111, 195, 199, 203, 216, 222, 227, 392` — every
     payout line, weekly revenue, per-brigade totals.
   - `brigades/page.tsx:402, 442` — per-job cost, base monthly salary.
   Reason screens show €0 is that current seeds have no expenses / payroll
   payments. As soon as the owner creates one €40 fuel expense, it will
   render as €4 000. Grep: `grep -rn 'formatEUR(.*Cents' src`. Fix: either
   divide by 100 at call-site or introduce `formatEURFromCents(cents)` and
   replace mechanically.
2. **Cashbox salary ≠ Payroll-page salary.** `useFinanceData.ts:344` uses
   `team.payout_percentage ?? 30` against a *team*. Payroll page uses
   *BrigadeMember.percentRate* per member
   (`payroll/page.tsx:181`, `generateWeeklyPercent`). These two numbers
   drift whenever a brigade has helper %. Test: set lead 25 %, helper 10 %
   → finances.cashbox.salary = 30 % flat. Fix: one helper in
   `lib/finance/compute.ts` that resolves payroll by brigade composition.
3. **`percentDelta` returns 100 whenever prev = 0.** `useFinanceData.ts:71`
   hard-codes `return current === 0 ? 0 : 100`. Screen shows "+100 %" next
   to Доход/Прибыль with prev-period = 0 — mathematically meaningless, and
   misleading (see below).
4. **`filterPayments` by `paidAt` slice-prefix** in payroll week math uses
   `p.paidAt >= range.start && p.paidAt <= range.end + "T23:59:59"` while
   `FinancePayment.paidAt` is ISO. Timezone offset in CY can roll a 21:30
   Sunday payment into Monday. Test around DST flips.
5. **Debts tab (long tail).** `useFinanceData.ts:361` only counts
   `status === "completed"` with `getDebtAmount > 0`. But a prepaid-only
   appointment that is still `in_progress` is never shown as debt and
   never shown as full-income either — the intermediate state is invisible.

## Owner trust gaps

- **"+100 %"** on Доход and Прибыль vs €0 prior 30 days is false comfort.
  Owner reads "growing". Label should say `новая метрика` or `—` when
  prev = 0. Current copy does not disclose the base. UX auditor (see
  finance-expert checklist) already flagged this — still shipped.
- **Cashbox math can't be drilled into.** «В кассе должно быть» is a
  computed number with no "tap to see the three inputs" affordance. Only
  the label + total is shown. On screen:
  cash €3 550 − expenses €0 − salary €1 065 = **€2 485** — arithmetic
  checks out, but the owner has to redo the subtraction mentally.
- **Зарплата €1 065 chip** links to a tab, but the tab shows only
  per-brigade rows — there is no per-member breakdown on /finances (that
  only exists on /payroll). Switching screens = lost context.
- **Долги €0** is a placeholder, not a tracked feature. There is no
  outstanding-invoice flow, no reminder, no "списать как убыток" action;
  it is a derived view over `completed` + `total_amount > sum(paid)`.
  End-to-end wiring (client-detail page debt pill, dashboard badge, push)
  does not exist.
- **No audit trail on day rows.** /reports expands a day into income +
  expense lines but you cannot tap a single line to get to the appointment.

## Money typography / formatting drift

- `expenses/page.tsx:343` · `"€0"` literal next to formatted negative ·
  use `formatEUR(0)`.
- `app/dashboard/finances/FinanceTabs.tsx:203` · SMS body has raw `€${g.total}` ·
  wrap with `formatEUR` (g.total is already euros).
- `components/appointment/ServiceRow.tsx:131` · discount renders `−€${line.discount.value}`
  without thousands separator · call `formatEURSigned(-line.discount.value)`.
- `components/appointment/GlobalDiscountForm.tsx:39` · same pattern.
- `components/appointments/sheet/ServicePickerSheet.tsx:171` · `${totals.sum}€`
  (suffix € instead of prefix, wrong for EU).
- `lib/payroll.ts:176` · debug description string mixes `€` + decimal
  `.toFixed(2)` — fine for logs, ugly in UI if ever surfaced.
- `lib/finance/invoice.ts:197` · PDF draws `€${formatMoney(gross)}` — this
  one is OK (invoice uses locale-aware "1,234.56" without NB-space by
  design), but flag so `Money.tsx` doesn't accidentally replace it.

## Where `Money.tsx` typography should apply

A single `<Money amount={euros} tone="income|expense|neutral|muted" size="sm|lg|xl" signed>`
component would centralise:

1. `tabular-nums` class (currently repeated ~40×).
2. Colour tokens (`text-emerald-600 / rose-600 / indigo-600`).
3. `formatEUR` vs `formatEURSigned` switch.
4. Optional delta badge under it (the pattern in `SummaryCard`).

First targets, highest drift: `finances/page.tsx` `SummaryCard` /
`Row` / `KV`; `reports/page.tsx` `SummaryCard` + day table cells;
`payroll/page.tsx` per-member row; `expenses/page.tsx` category row +
row. Replace by top-down import, not a codemod — the input-unit
cents-vs-euros bug is too widespread to do blind search-replace.

## VAT surface

Today `splitVat` is only reached from invoice-PDF rendering. Neither
/finances totals, /reports day rows, nor cashbox expose net vs gross.
First visible surface should be a **company-level "VAT collected" row in
`/reports` summary** (three-card row), and on an invoice/приход drill-in
— `Gross €X · Net €Y · VAT €Z (19 %)`. Gating: only show if
`company.vat_mode !== "off"` and a `vat_number` is saved.

## Debt tracking status

Placeholder. Feature not wired end-to-end:
- `useFinanceData.debts` reads appointments but there is no `Debt` record
  type, no paid-off event, no reminder job, no client-detail "У клиента
  долг €N" pill. The /finances «Долги» tab only shows what
  `getDebtAmount()` derives. Sprint 012 should add a `Debt` store and
  wire the client page + dashboard badge.

---

## Sprint 012 money-bundle — specific spec

### A. `formatEURFromCents(cents)` + mechanical migration
- **Input:** integer cents.
- **Output:** string via `formatEUR(Math.round(cents / 100))`.
- **Files:** `lib/money.ts` (add fn), then replace `formatEUR(x.*Cents)` in
  `expenses/page.tsx`, `payroll/page.tsx`, `brigades/page.tsx`.
- **Math sketch:** `net_eur = round(cents/100)`; total equivalence checked
  by summing cents first, then formatting once at the end.

### B. `<Money amount tone size signed />` component
- **Input:** amount (euros by default; `cents` prop flips conversion),
  tone, size, `signed?`, `deltaPct?`.
- **Output:** `<span class="tabular-nums text-…">…</span>` + optional
  delta pill.
- **Files:** new `components/finance/Money.tsx`; replace inline spans in
  the four finance pages.

### C. Honest delta label
- **Input:** `(current, prev, periodLabel)`.
- **Output:** when `prev === 0` and `current > 0` → render pill
  **"нов."** in grey, not "+100 %".
- **File:** `useFinanceData.ts:percentDelta`, `SummaryCard` delta render.

### D. Cashbox «факт в кассе» (Sprint 012)
- Centered modal (per house rule) on tap «Сверить».
- Three inputs: date (default = today), brigade (auto = active tab),
  fact-cash euros. Shows expected on the right: `expected = cash − expenses − salary`.
- On save → create `DailyReconciliation` via existing
  `buildReconciliationForBrigadeDay` then `updateReconciliation`.
- Diff pill visible in /finances Cashbox block: `−€37 недостача` or
  `+€12 перебор` with tap → recent 7 recon diffs.
- Files: new `components/finance/CashboxReconcileDialog.tsx`,
  wire-in `finances/page.tsx` CashboxBlock.

### E. Cashbox–Payroll single source
- Move the cash-subtraction, salary-from-members, expected-cash trio into
  `lib/finance/cashbox.ts` — single pure function consumed by both
  finance cashbox and reconciliation builder. Output includes
  `{ cash, card, totalExpenses, salaryByMaster, expected }`.

### F. Per-brigade VAT row on /reports
- `computeFinancials` → add `vatCollected` to result (sum of
  `splitVat(line.amount, company.vat_mode, rate).vat` over income lines).
- Render fourth summary card on /reports + tooltip «собрано НДС 19 %».

### G. Debt feature wiring
- `lib/debts.ts` CRUD (status: open/paid/written-off).
- Event on payment: if paid ≥ total → close debt; else update remaining.
- UI: client-detail pill, dashboard red dot when sum > 0, /finances
  «Долги» shows action buttons (написать SMS, списать).
