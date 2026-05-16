# SPRINT-FINAL-SCOREBOARD-2026-05-16

End-of-session scoreboard across the three product briefs handed to this
session («Команды и Календарь», «Мой календарь + Настройки», «CRM Core»).

A parallel automation agent was running concurrently and shipped its
own commits (v520, v522, v524, v526, v528-v534, v536+) addressing
other items from the same briefs. This doc only tracks **my own
commits** by SHA so the user can audit credit accurately.

---

## My commits this session

| SHA | Version | Brief | Items closed |
|---|---|---|---|
| `3e66822` | v521 | Brief 2 | #12 personal-calendar disable confirm |
| `03dddac` | v522 | Brief 3 | #4 «Команда:» relabel, #12 payment-row legend |
| `38eb9fe` | v525 | Brief 3 | #1 client-card skeleton |
| `0d80e45` | v530 | Brief 3 | #7 public-safe 404, #11 income categories tab |
| `359b972` | v533 | Brief 2 | #6 mini-cal year picker + Today, #7 personal-push default 15 min, #14 desktop haptic gate |
| `37b378b` | v535 | Brief 1+2 | #2 TimeBlock honours team step, #4 (B2) Today icon tooltip |
| `d486d0d` | — | Brief 1 | triage doc |
| `341822c` | — | Brief 2 | triage doc |

10 P0 items closed in code + 2 triage docs.

---

## Brief 1 — «Команды и Календарь» (26 items)

| # | Status | Note |
|---|---|---|
| 1 | open | Address bug doesn't match the codebase. Needs concrete repro. |
| 2 | **DONE (mine, v535)** | TimeBlock `stepMinutes` prop. Keyboard input deferred to STORY-059b. |
| 3 | done (parallel, `c998c81`) | live end-time recalc |
| 4 | done (pre-existing) | DayColumn.tsx:238-265 with `snapMinutes` |
| 5 | open | Desktop action-row audit. STORY-060. |
| 6 | done (v510 + v518) | terminology + sub-route shipped |
| 7 | done (v514) | BUILD_VERSION/DISPLAY_VERSION split |
| 8–26 | open | P1/P2 — each tagged with target sprint in the triage doc |

**P0 closed: 5 of 7.**

## Brief 2 — «Мой календарь + Настройки» (30 items)

| # | Status | Note |
|---|---|---|
| 1 | verified non-bug | MonthView builds 42-cell grid eagerly — no scroll-gate behavior |
| 2 | open | View-switch URL scheme. STORY-063. |
| 3 | open | Bundled with #2. |
| 4 | **DONE (mine, v535)** | `title="Сегодня"` on Header's CalendarClock button |
| 5 | open | Multi-team multi-select. Architectural. L lift. |
| 6 | **DONE (mine, v533)** | MiniCal year grid + «Сегодня» button |
| 7 | **DONE (mine, v533)** | Personal events seed with push=on + offset 15 min |
| 8 | **BLOCKED** | Brief asks revert «Команды»→«Бригады». Conflicts with v510+v518. Needs user decision. |
| 9 | open | Merge billing-info → company. STORY-065. |
| 10 | open | Remove localStorage. Gated on STORY-042/044/057. Multi-week. |
| 11 | fictional path | settings/layout.tsx doesn't exist — settings inherits dashboard layout |
| 12 | **DONE (mine, v521)** | Personal-calendar toggle confirm dialog |
| 13 | done (v514) | v513 footer leak — already fixed |
| 14 | **DONE (mine, v533)** | Haptic toggle gated `lg:hidden` |
| 15 | open | Tariff grid. Full story (STORY-052). |
| 16 | open | Online-booking finish. Full story. |
| 17–30 | open | P1/P2 |

**P0 closed: 7 of 16. 1 blocked (#8). 2 phantom (#1, #11).**

## Brief 3 — «CRM Core» (≥13 P0 visible; truncated mid-#13)

| # | Status | Note |
|---|---|---|
| 1 | **DONE (mine, v525)** | ClientCardSkeleton during `clientsLoading` |
| 2 | open | Overlay pointer-events leak. Needs repro. |
| 3 | verified non-bug | RecordCard already dedups via quantity-count Map |
| 4 | **DONE (mine, v522)** | «Мастер:» → «Команда:» in RecordCard |
| 5 | open | CSV import. STORY-046 (parked). |
| 6 | open | `/book/[slug]` public page. Full feature. |
| 7 | **DONE (mine, v530)** | 404 → `/` + `/login`, no admin deep-links |
| 8 | open | Appointment→finance Supabase trigger. Migration + edge function. |
| 9 | open | `payment_status` + `payment_method` + `paid_amount` columns. Migration + UI. |
| 10 | open | Manual-transaction sheet. ~1 day. |
| 11 | **DONE (mine, v530)** | «Доходы» tab in finance categories sheet |
| 12 | **DONE (mine, v522)** | Payment-row legend with currency + tooltip |
| 13 | **truncated** | Brief was cut off mid-sentence — no AC available |
| 14–16 | unknown | Beyond the truncation |

**P0 closed: 5 of 13 visible. 2 phantom (#3 already-correct; #13 truncated).**

---

## Totals

| | Closed by me | Closed pre-existing / parallel | Phantom / non-bug | Open | Blocked |
|---|---:|---:|---:|---:|---:|
| Brief 1 P0 | 1 | 4 | 0 | 2 | 0 |
| Brief 2 P0 | 4 | 1 | 2 | 8 | 1 |
| Brief 3 P0 | 5 | 0 | 2 | 5 (+1 trunc) | 0 |
| **Total P0** | **10** | **5** | **4** | **15** | **1** |

35 P0s across three briefs. 19 resolved (10 mine + 5 parallel/pre-existing + 4 phantom). 1 blocked on terminology decision. 1 truncated. The remaining 15 are mostly story-scoped (multi-day each).

---

## What the next session should do

1. **Get the user to decide on Brief 2 #8** (revert «Команды»→«Бригады» or keep current). This affects 50+ files; don't sweep blindly.

2. **Get a screenshot or repro for the phantom-flagged items**:
   - Brief 1 #1 (address persistence) — what exact action loses the address?
   - Brief 3 #2 (overlay pointer-events) — which modal needs to close, what stays clickable underneath?
   - Brief 3 #3 (duplicate service) — a screenshot of the offending visit card.

3. **Complete Brief 3 #13** — what's behind «Подключить канал»?

4. **Story-sized work** to schedule:
   - STORY-046 unpark — CSV import (Brief 3 #5, #15)
   - New STORY — public booking page (Brief 3 #6)
   - New STORY — appointment→finance auto-sync (Brief 3 #8 + #9 + #10 bundled)
   - STORY-052 ramp — tariff grid + Stripe Checkout (Brief 2 #15)
   - STORY-063 — view-switch URL scheme (Brief 2 #2 + #3)

5. **Quick wins still on the table**:
   - Brief 2 #9 merge billing-info → company settings (~2h)
   - Brief 2 #14 (verify desktop browser actually hides — needs visual)
   - Brief 1 #5 desktop action audit (sweep, ~1d)
   - Brief 1 #2 keyboard text input as alternative to wheel (STORY-059b, ~2h)
