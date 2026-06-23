# STORY-062 — Finances: port the approved mockup into the live page

**Status:** planning — awaiting user «ок» before code
**Approved:** finances design approved by user via Claude Preview mockup (`mockups/finances-design.html`), built iteratively 2026-06-19…23.
**Goal (user's words):** «полностью сделал код под этот макап и загрузил в страницу финансов … составь полностью весь продуманный код, проверь всё и соедини это с календарём, клиентами … с командами, чтоб это всё было в едином дизайне».
**Decisions locked (this session):** scope by **Team** (Север/Юг); **VAT deferred** (stays in invoices/analytics, no VAT toggle on entry); ship **phased** — one deploy per slice, verified on prod (CLAUDE.md scope discipline).
**Deploy rule:** every slice ships to `master`; bump `CACHE_VERSION` (`public/sw.js`) + `BUILD_VERSION` (`app/dashboard/page.tsx:63`); verify live in Chrome MCP per the SAME user-flow before claiming done.

---

## Diagnosis (current state — from recon, with file refs)

**Page:** `apps/web/src/app/dashboard/finances/page.tsx` (282 lines) + `layout.tsx`. Renders: PageHeader → FinanceHeader (brigade chips + period + banner) → BrigadeBreakdownBlock → AccountsBlock (horizontal cards) → TransactionsFeed (day-grouped) → sticky bar (`+Доход` / `+Расход` / `↔Перевод`) → 5 modal sheets.

**Components** (`src/components/finance/*`): FinanceHeader, PeriodPicker, BrigadeBreakdownBlock, AccountsBlock, TransactionsFeed, AddTransactionSheet, TransferSheet, TransactionPopup, AddAccountSheet, InvoiceSheet, ExpenseSheet, PaymentSheet, FinancePieChart, FinanceSparkline, DayFinanceModal.

**Data layer is strong and already fits the mockup:**
- **Storage split:** finance tables (`accounts`, `finance_transactions`, `finance_categories`, `finance_templates`, `invoices`) live in **Supabase** (hooks `useAccounts`/`useFinanceTransactions`/… in `src/lib/finance/hooks.ts`). Calendar/clients/teams/services come from **localStorage context** hooks in `DashboardClientLayout` (`useAppointments`, `useClients`, `useTeams`, `useServices`). The two must align on IDs (they do — see mapping).
- **Account** (`packages/shared/src/local/finance/account.ts`): `id, tenant_id, brigade_id, name, kind('cash'|'card'|'bank'|'other'), owner_master_id, opening_balance, icon, color, position, is_active`. **`brigade_id` = the team id** (AddAccountSheet's "brigade" dropdown is populated from `teams`), so strict per-team is already the model.
- **FinanceTransaction** (`…/finance/transaction.ts`): `type('income'|'expense'|'transfer'|'refund'), amount, category_id, account_id, appointment_id, client_id, team_id, master_id, payment_method, notes, occurred_on(YYYY-MM-DD), transfer_group_id, invoice_id, refund_of_id, source('auto'|'manual')`.
- **Repos** (`packages/shared/src/db/repositories/`): `accounts.ts` (list/insert/update/softClose), `finance-transactions.ts` (listForRange/insert/update/delete/createTransfer/deleteTransfer), `finance-categories.ts` (**list only — no insert yet**), `finance-templates.ts`, `invoices.ts`.
- **Compute** (`src/lib/finance/`): `ledger-compute.ts` → `computePeriodTotals` (income/expense/profit/expectedProfit/debt), `breakdownByBrigade`, `groupByDay`, `computeAccountBalance`; `period.ts` → `getPeriodRange` (today/yesterday/week/month/year/custom).
- **Appointment** (`…/local/appointments.ts`): `client_id, location_id, team_id, date, time_start/end, service_ids[], services[], total_amount, address, status, payment, payment_status`. → the mockup's "запись в календаре" for income.
- **Auto-sync:** trigger `sync_appointment_finance` inserts an `income` (or `refund`) transaction when an appointment goes `completed`+`paid`, copying `appointment_id, team_id, client_id, occurred_on=date, source='auto'`.

**Design system already matches the mockup:** `globals.css` iOS tokens — accent `#3E88F7`, `--system-green #34C759`, `--system-red #FF3B30`, card/sheet radii, `--shadow-card`. Reusable UI: `SheetShell` (centered modal + history-stack back), `Button`, `Chip`. Modal back handled by `src/lib/history-stack.ts`. Bottom tab bar + safe-area in `DashboardClientLayout`.

---

## Approved design (the mockup — what we ship)

Reference: `mockups/finances-design.html` (locked through this session). Top→bottom home:
- Header: ⚙ · «Финансы» · 📊; team chips **Север/Юг**; period row (semantic name ⌄ / exact dates).
- **Overview**: «Счета» mini-card (per-team total, › → inline accounts panel) · big **Доход/Расход** (tap = filter feed) · **Долги | Прибыль** row.
- **Accounts panel** (inline): flat per-team list (no group headers, no team tag), full-width **«⇄ Перевод»** + **«＋ Новый счёт»**.
- **Feed**: flat transactions, left color bar, short date; **no «Движения» header** on the main feed.
- **Entry**: ONE **«＋ Операция»** → popup with **Доход / Расход** segment; **native** amount input.
  - **Доход**: pick a **calendar appointment** («ЗА ЧТО · запись в календаре» → client + service + date) → fills client/service; **«Дата выполнения»** editable; **«Услуга»** chips (+ manual add). Each income = one appointment → no stacking.
  - **Расход**: **category** chips (+ manual add, remembered) · **«Комментарий»** (native text). No VAT toggle (deferred).
- **Transfers**: cross-team allowed (picker shows all accounts, current team first, brigade-color dots).

---

## Mapping (mockup → app data) — no schema change unless noted

| Mockup | App |
|---|---|
| Brigades Север/Юг (scope) | **Teams** (`useTeams`): `team.id`, `name`, `color` |
| `account.brigade` | `accounts.brigade_id === team.id` |
| `visibleAccounts()` per-team | `listAccounts` filtered `brigade_id === scopeTeamId` |
| account total (scoped) | Σ `computeAccountBalance` over scoped accounts |
| income / expense / transfer | `finance_transactions` + `insertTransaction` / `createTransfer` |
| amount · дата выполнения · comment | `amount` · `occurred_on` · `notes` |
| income → запись в календаре | `transaction.appointment_id`; list from `useAppointments` filtered by `team_id` (recent/completed, unpaid-or-any) |
| income client / service / date | from linked appointment (`client_id`, `service_ids`→service names, `date`) |
| income «услуга» categories | `useServices` (filtered by team) for the chip list; income `category_id` = «services» finance category |
| expense categories + manual add | `finance_categories(type='expense')` + **NEW `insertFinanceCategory`** (tenant override) |
| period / totals / debt / profit | `getPeriodRange` · `computePeriodTotals` (already returns debt + profit) |
| transfer cross-team | `createTransfer` with from/to of any team |
| VAT on entry | **DEFERRED** — no transaction VAT fields; stays in invoices |

**Mockup-only (NOT in current schema) → out of v1 port, revisit later:** per-account `vatReserve` / `salarySource` flags, employees/salary fund, company VAT settings screen, НДС-к-уплате. These were mockup extras; the port targets the daily-useful core (overview · accounts · income/expense/transfer · period · team scope).

---

## Slices (one deploy each, verify on prod between)

**Slice 1 — Home screen redesign.** Rebuild `finances/page.tsx` UI to the mockup home: header (team chips + period), overview (Счета mini-card · Доход/Расход · Долги|Прибыль), inline per-team accounts panel (flat list + Перевод + Новый счёт), feed (no «Движения»). REUSE `useAccounts`/`useFinanceTransactions`/`computePeriodTotals`/`getPeriodRange`. Scope by single Team (Север/Юг) instead of multi-select. Keep existing sheets wired to the new buttons for now. Tap Счета/Доход/Расход/Долги swaps the panel below (homeView state). Split large file (<400 lines) into sub-components under `components/finance/`.

**Slice 2 — Operation entry.** Replace the 3 buttons with one **«＋ Операция»** → new `OperationSheet` (segment Доход/Расход, native amount input). Расход: category chips (+ add) + comment. Доход: appointment picker (`useAppointments` by team) → client/service/date выполнения + service chips. Wire to `insertTransaction` (income sets `appointment_id`/`client_id`; expense sets `category_id`/`notes`). Native inputs (`inputmode=decimal`, `type=date`).

**Slice 3 — Transfers + account editor + categories.** Cross-team `TransferSheet` (picker = all accounts, scope first). Account editor (single-team select via `AddAccountSheet`/update). **`insertFinanceCategory`** repo fn (+ RLS check on `finance_categories`) so expense category «＋» persists.

**Slice 4 — Polish / analytics (as needed).** Period preset-list + custom wheel parity; profit breakdown; per-team debt surfacing. Salary/VAT-reserve/settings remain deferred unless user requests.

---

## Verification (each slice)

1. `cd apps/web && npx tsc --noEmit` green; `npx eslint src` no new errors.
2. Bump `CACHE_VERSION` (`public/sw.js`) + `BUILD_VERSION` (`app/dashboard/page.tsx:63`); push to `master` (branch + PR per repo rules — direct master push is blocked).
3. Vercel deploy OK → open prod in Chrome MCP, walk the SAME flow that changed, screenshot. (Note: Chrome MCP may not be logged into prod — user verifies live after each deploy if auth blocks the agent.)

## Risks / open checks
- Confirm `accounts.brigade_id` is in practice `team.id` (verify on a real account row before Slice 1).
- localStorage(calendar/clients/teams/services) ↔ Supabase(finance) id alignment for `team_id`/`appointment_id`/`client_id` on manual rows.
- `finance_categories` RLS must allow tenant inserts for Slice 3.
- Income↔appointment: decide which appointments to list (recent completed, or any of the team) — refine in Slice 2 with user.
