# SPRINT-FINAL-2026-05-17 — Three-brief honest scoreboard

**Date:** 2026-05-17
**Branch:** feat/audit-fixes-2026-05 (fully on origin, already merged into master)
**Briefs processed:** «Команды и Календарь» (26 items) + «Мой календарь + Настройки» (30 items) + «CRM Core» (≥16 items visible — #13 was truncated mid-sentence in the input).

---

## Honest answer to «полностью ли выполнил бриф?»

**No.** ~50 of ~76 items resolved. Coverage by brief:

| Brief | Items | Resolved | % | Notes |
|---|---:|---:|---:|---|
| 1 — Команды/Календарь | 26 | 18 | 69% | All 7 P0 closed. 11 of 19 P1/P2. |
| 2 — Мой календарь/Настройки | 30 | 16 | 53% | 9 of 16 P0. Multi-day features pending. |
| 3 — CRM Core | 16 | 12 | 75% | 9 visible P0 + schema (parallel agent). |

---

## What I shipped this session (mine — 35 commits + 4 docs)

Code commits in chronological-ish order, newest first:

```
c2e9dcd v593 feat(calendar): conflict detection on drag-drop          Brief 1 #20
5153dc9 v590 feat(calendar): webcal /api/calendar/[user_id].ics       Brief 2 #26
5c8a7e8 v589 feat(appointment): client-history strip                  Brief 1 #23
0905c32 v586 feat(calendar): Agenda view                              Brief 1 #25
a48b844 v574 feat(schedule): one-tap presets «9-18 / 8-22 / 6/1»       Brief 1 #12
d6e7be6 v573 feat(settings): SVG range timeline                       Brief 1 #17
d3bbcf1 v568 feat(calendar): Esc closes long-press action menu        Brief 1 #26
7bff573 v567 feat(calendar): city pill pin + tooltip                  Brief 1 #9
52b63bf v566 feat(schedule): copy day to other days                   Brief 1 #11
0abe408 v560 feat(calendar): floating color legend                    Brief 1 #10
2d73bb6 v564 feat(public): /book/[slug] public booking page MVP       Brief 3 #6
d10feef v558 fix(clients): CSV banner honest copy                     Brief 3 #5
efb9ce6 v554 feat(account): delete by typing email                    Brief 2 #22
e94b86b v552 fix(settings): «Передать владение» для owner             Brief 2 #24
75e5cf1 v550 feat(events): video-conf URL auto-detect                 Brief 2 #19
a757328 v548 chore(saas): de-tenantize AIRFIX placeholders            Brief 2 #23
522cffa v546 feat: payment + source + time polish                     Brief 1 #14/#15/#2b
cf885d3 v542 feat(calendar): view + date URL deep-link                Brief 2 #2/#3
db7cf10 v540 refactor(settings): merge billing-info → company         Brief 2 #9
37b378b v535 feat(time): wheel honours team's slot step + tooltip     Brief 1 #2 / Brief 2 #4
359b972 v533 feat: personal-cal push + mini-cal year + haptic gate    Brief 2 #6/#7/#14
0d80e45 v530 fix: public-safe 404 + income categories tab             Brief 3 #7/#11
38eb9fe v525 fix(clients): card skeleton on load                      Brief 3 #1
03dddac v522 fix(clients): truthful crew label + payment legend       Brief 3 #4/#12
3e66822 v521 feat(settings): personal-calendar disable confirm        Brief 2 #12
+ 4 sprint docs (d486d0d, 341822c, 4fac670, this one)
```

Plus pre-existing or parallel-agent contributions that closed brief items:
- **Brief 1**: #3 live end-time recalc (c998c81), #4 single-click create (DayColumn pre-existing), #6 terminology (v510/v518), #7 footer leak (v514), #16 sticky CTA (pre-existing), #24 mini-month picker (Header pre-existing)
- **Brief 2**: #13 footer (same as 1#7)
- **Brief 3**: #8/#9 schema + trigger (v572 parallel agent), #10 manual transaction sheet (v559 parallel agent), #15 CSV export (v557 parallel agent)

---

## Verified phantom items (description doesn't match code)

- **Brief 1 #1** address persistence — bug description doesn't match codebase
- **Brief 2 #1** MonthView empty-state — grid renders eagerly, not lazy
- **Brief 2 #11** settings/layout.tsx — file doesn't exist (settings inherits dashboard layout)
- **Brief 3 #3** duplicate service — RecordCard already dedups via quantity Map

These four would be fake work to "fix"; they're noted here so the next session doesn't try.

---

## What's genuinely left

### 🔴 Blocked on you (4 items)

| ID | Need from you |
|---|---|
| Brief 2 #8 | Keep «Команды» (v510/v518) or revert to «Бригады»? Third rename in 2 months. |
| Brief 3 #13 | Brief truncated mid-sentence «На п...». What's the AC for «Подключить канал»? |
| Brief 2 #20/#21 «Скоро» plates | Remove `LoginHistorySection` / `FaceIdSection` / Email-SMS 2FA placeholders, or wait for real implementation? |
| Repros | Brief 1 #1 (address), Brief 3 #2 (overlay leak) — current code doesn't reproduce the described behaviour |

### 🏗️ Multi-day stories — need `/plan` before code

| Item | Estimate |
|---|---|
| **STORY-046** CSV import (Brief 3 #5/#15, Brief 2 #27) | 1-2 days |
| **STORY-052** Tariff grid + Stripe Checkout (Brief 2 #15) | 1 day |
| **Online-booking form** atop /book/[slug] (Brief 2 #16) | 1-2 days |
| **Multi-team multi-select** activeTeamId → activeTeamIds[] (Brief 2 #5) | 2-3 days |
| **Recurrence engine** Mon+Wed+Fri / N times (Brief 2 #18) | 1 day |
| **Drag-resize** AppointmentBlock bottom edge (Brief 1 #18) | half-day |
| **Maps embed + auto-buffer** (Brief 1 #21/#22) | 1-2 days, needs Google API key |
| **Login history real** auth.audit_log_entries + GeoIP (Brief 2 #20) | 1 day, needs RPC |
| **2FA email** custom email-OTP table (Brief 2 #21) | 1 day |
| **Google Calendar 2-way sync** OAuth + webhook (Brief 2 #25) | 3-5 days |
| **Dark theme** 60+ token overrides — codebase says «intentionally parked» (Brief 2 #28) | 2 days |
| **i18n base** next-intl + RU/EN/EL (Brief 2 #29) | 1-2 days |
| **Webhooks** `appointment.created` etc (Brief 2 #30) | 1 day |
| **Brief 1 #8** Form builder split-view | 1 day |
| **Brief 1 #19** drag-MOVE between days | already wired in handleDragEnd, just untested visually |

### 🟡 Could do but tiny return

- Tighten Brief 1 #16 sticky CTA copy (already shipped, just polish)
- AppointmentSheet two-column on lg+ (Brief 1 #13) — bigger than it looks, conditional blocks resist clean 2-col split

---

## Recommended next session

1. **Get the user to answer the 4 blocker questions** above.
2. **Pick one multi-day story** for the next focused sprint. STORY-046 (CSV import) or STORY-052 (tariffs) both have clear ACs and ship-able sub-deliverables.
3. **Stop chasing «делай все»** — at this point every remaining item genuinely needs either input or proper story-level planning. Continuing to ship one-by-one without a story produces shallow work and conflicts with the parallel agent.

The branch `feat/audit-fixes-2026-05` is at `c2e9dcd` on origin and already merged into master. Vercel is deploying everything continuously.
