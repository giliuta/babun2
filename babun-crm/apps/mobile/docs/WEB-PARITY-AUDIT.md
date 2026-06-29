# Babun CRM — Web→Mobile Parity Audit

> Generated 2026-06-29 by a 16-area source-level audit (web `apps/web` vs mobile `apps/mobile`, data layer `packages/shared`). Each area was read from real source, not assumptions. Status: `done` / `partial` / `missing` / `out-of-scope`. Effort: S<½day · M~1day · L~2-3days · XL>3days (sliceable).

## TL;DR
The mobile app is a **functional MVP across every core operator workflow** — calendar, finances, clients, chats, close-day all exist and work for daily use. The gaps are mostly **UI depth** (the shared data layer already supports ~90% of what's missing), plus a handful of **genuinely missing screens** and a few **real correctness bugs** worth fixing first.

## Real bugs (not just missing depth) — fix first
1. **Close-day cash math is wrong** — mobile computes expected cash as `sum(completed.total_amount)` (income), but web uses `computeFinancials().cash` = actual cash-method payments + prepaid. Any card/transfer/unpaid job makes the касса delta meaningless. *(close-day-unclosed)*
2. **Close-day flag persisted as bare `'1'`** — loses `{closedAt, expectedCash, actualCash, delta}`, so the closed-day summary is broken on reload. *(close-day-unclosed)*
3. **Client create has no dedup guard** — `findClientByPhoneE164` exists in shared but is never called; re-creating/importing the same phone silently duplicates clients. *(clients)*
4. **Auth lockout risk** — no forgot/reset-password anywhere; an operator who forgets their password is locked out with no in-app recovery. *(auth-onboarding)*
5. **No onboarding gate** — `_layout.tsx` routes on session presence only, never checks `tenant.onboarded_at`, so a fresh user lands in an unconfigured dashboard. Plus `useTenantId` has no `tenant_members` fallback → null tenant + broken queries when the JWT lacks `tenant_id`. *(auth-onboarding)*

## Missing screens
| Area | What | Data layer | Effort | Priority |
|---|---|---|---|---|
| **Unclosed days** | Backlog of past-dated still-scheduled work appts; per-row Выполнено/Отменить + cancel-reason; «под вопросом на сумму»; aging. No route/nav. | Ready (only `logAudit` unported) | M | **High** |
| **Insights / Сводка** | Period chips + 3 KPI tiles (Записей/Выручка/Завершено + PoP delta%) + 3 leaderboards (Топ команды/услуги/клиенты). | Partial (period/delta/top-N logic only in web component) | M | Low |
| **SMS-template management** | Editor + token palette + GSM-7/UCS-2 counter + presets + «Тест». (cabinet «Шаблоны» is FINANCE templates, not SMS.) | Ready (`sms-templates/encoding/presets`) | M | Medium |
| **Audit / activity log** | Per-device write trail + filter chips + search + CSV. | Not ready (`logAudit` only in web, never called on mobile) | M | Low |
| **AI Assistant** | «Спроси у Babun» — non-functional stub even on web (STORY-010, no backend). | None | — | Out of scope |

## Partial areas (work, but shallower than web — data layer ready unless noted)
- **Calendar / appointments — XL, High.** Has agenda/day/month, drag-reschedule, deep create/edit sheet. Missing: week + 3-days views, personal-calendar lane, appointment recurrence (`event_repeat`), per-team appointment-blocks & per-team calendar settings, sheet blocks (photos, payments, expenses, prepay, source, reminder/SMS, address-note, map, history), day-finance footer, slot pre-confirm + Undo.
- **Finances — XL, High.** Has tx CRUD, accounts+transfers, categories, basic templates, period/scope, profit-by-category, CSV. Missing: income→appointment linking, receipt photo, real refund (`refund_of_id` + cap), tx detail popup, **Долги/debtors view**, richer analytics (income-by-service pie, cross-team profit bars), invoice issuing+PDF, fuller template/category editors, custom period range, owner-only gate.
- **Clients — XL, High.** Most mature area: list+filters, real multi-block card (reuses shared stats/service-due), create, working CSV import. Missing: team/period facets + auto-segments + sorts, bulk/quick actions (multi-select, bulk SMS, swipe, export), card 5-action quick row + equipment/service-spine + attachments + reminder setter, create dedup/objects/«Ещё» fields, import wizard depth (mapping/dedup/validation/resume).
- **Teams — XL, High.** Only name+region CRUD. Missing the entire team-detail hub + all 6 subroutes (calendar, cities/Метки, masters+roles, services, equipment, appointment-blocks) + per-member access editor. Data layer fully ready (`teams` table carries every column).
- **Masters — XL, Medium.** Only 2-field (name/phone) list. Missing detail hub + /info (credentials/contacts/bank/docs/incidents), /access (permissions matrix), /schedule (Визиты), /stats. Data partial (rich Master shape in web localStorage, no mobile Supabase repo).
- **Settings core — XL, Medium.** Cities full-parity; loyalty/calendar/business/event-types near or shallow. Missing: account/security (password change, 2FA, devices, self-delete — needs new auth plumbing), billing, personal depth, **calendar Метки/labels (data ready, UI absent)**, VAT mode/rate, event-types depth.
- **Settings comms/booking — XL, Medium.** Only object-types ported. Missing: sms (managed-SMS sender/balance/reminders/templates), online-booking (`booking_slug`), integrations (Telegram/webhooks), billing (Stripe), team (members/invites/roles).
- **Chats — L, Medium.** List+thread work (send/reply/star/delete/quick-replies/link/drafts/mark-read). Missing: status checkmarks, date grouping, header ⋮ menu (pin/close/archive/«Записать»/«Создать клиента»), photo attach, copy, «Без ответа» filter + SLA badge, swipe pin/archive, deep-links.
- **Recurring TO — M, Medium.** Inbox+manual-create work. Missing: auto-seed from completed appointment (primary origin), «Записать» booking, create depth (type/date/channel), due-vs-future split, delete confirm.
- **Services — L, Medium.** Only name/price/duration. Missing categories, per-team brigade scoping, bulk/tier pricing, costs/margin, color, weekdays, online/active toggles. Data partial (categories need a path).
- **Inventory/equipment — M, Low.** Register + object-types CRUD work. Missing per-team equipment view, brigade grouping, color picker, search, swipe/context menu, object-types rename. *(Owner: built for SaaS, not self-used → low priority.)*
- **Close-day — M, High.** UI near-complete; see bugs #1–2 above.

## Out of scope (correctly web-only)
- `/book/[slug]`, `/b/[token]`, `/feedback/[token]` — public pages for the operator's **customers**.
- `/invite/[token]` — one-time team-onboarding bounce.
- `/admin/*` — Babun-internal cross-tenant super-admin (`is_platform_admin()`).
- **Analytics charts** — web page is now just a redirect; nothing to port.
- **Billing on mobile** — Stripe Checkout/Portal redirects don't fit a phone flow; keep owner-only on web.

## Recommended build order (operator-value first; data-ready preferred)
1. **Fix close-day cash math + persistence + close-with-scheduled confirm** — M. *Data ready.*
2. **Port Unclosed-days backlog screen** — M. *Data ready.*
3. **Calendar: appointment recurrence (`event_repeat`/`expandRepeat`) then week/3-days views** — XL (slice). *Data ready.*
4. **Finances: income→appointment linking + real refund + tx detail popup + Долги view** — XL (slice). *Data ready.*
5. **Clients: create dedup guard + card 5-action quick row** — L. *Data ready.*
6. **Recurring: auto-seed from completed appointment + «Записать» booking** — M. *Data ready.*
7. **Teams: detail hub + /calendar + /appointment-blocks** — XL (slice). *Data ready.*
8. **Chats thread polish** (checkmarks, date grouping, header menu, «Без ответа» + SLA) — L. *Data ready.*
9. **SMS-template management screen** — M. *Data ready.*
10. **Insights / Сводка screen** (extract period/delta/top-N into shared first) — M. *Data partial.*
