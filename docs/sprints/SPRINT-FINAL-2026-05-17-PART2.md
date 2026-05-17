# SPRINT-FINAL-2026-05-17-PART2 — Running scoreboard after user decisions

After user answered the 3 blocked questions on 2026-05-17:
- Terminology stays «Команды» (no revert to «Бригады»)
- Brief 3 #13 = Telegram MVP + WhatsApp/Instagram «Уведомить меня»
- «Скоро» plates removed, single footer line «Скоро: SMS-код, email-код, FaceID, журнал входов»

This round shipped:

```
v602  feat: Telegram MVP + remove Security «Скоро» plates           Brief 2 #20/#21 + Brief 3 #13 + Brief 2 #8
v604  feat(calendar): recurrence engine for personal events         STORY-091 / Brief 2 #18
v605  feat: webhooks CRUD UI (parallel agent)                       STORY-094 / Brief 2 #30
```

Plus push + merge to master in this session — Vercel deploys
continuously from master at the time of writing.

## Running totals

| Brief | Done | Total | % |
|---|---:|---:|---:|
| 1 — Команды/Календарь | 19 | 26 | 73% |
| 2 — Мой календарь/Настройки | 20 | 30 | 67% |
| 3 — CRM Core | 14 | 16 visible | 88% |
| **Combined** | **~53** | **72 visible** | **~74%** |

## What's left

See [REMAINING-WORK-2026-05-17.md](../stories/REMAINING-WORK-2026-05-17.md)
— twelve mini-plans, one per multi-day story. The user should pick
ONE with `/plan STORY-NNN` rather than ship them all in one session.

Most pressing options:
- **STORY-046** CSV import (1-2 days)
- **STORY-052** Stripe tariff grid (1 day, needs Stripe keys)
- **STORY-090** Multi-team multi-select (2-3 days, architectural)
- **STORY-093** Google Calendar 2-way sync (3-5 days, needs OAuth keys)

## Note on parallel agent coordination

Per user 2026-05-17: «работайте в разных feature-branches, merge через
PR». This session pushed everything to `feat/audit-fixes-2026-05` and
merged into master at the end. For the next sessions, parallel agents
should each pick a dedicated `feature/STORY-NNN` branch and PR back —
this session experienced 3+ rollback incidents where my edits and the
parallel agent's edits raced on the same files.
