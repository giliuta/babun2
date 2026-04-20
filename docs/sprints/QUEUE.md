# Sprint Queue

**Updated:** 2026-04-20
**Format:** Approved by CEO, in order. Status reflects current reality.

## In Flight / Approved Queue

| # | Slug | Size | Status | Notes |
|---|------|------|--------|-------|
| 001 | Before/After Photos | S (1 day) | ✅ shipped | v172-photos, PhotoBlock + PhotoPicker + PhotoViewer |
| 002 | Share-link «моя запись» | S (1 day) | ⏳ queued | Public `/b/[token]` page, no auth, shown in SMS |
| 003 | Recurring cleanings | M (2 days) | ⏳ queued | «Повторить через 6 мес», waitlist integration |
| 004 | PDF-invoice with photos | M (2 days) | ⏳ queued | jspdf client-side, VAT, photos appendix |

## Idea Exploration (agent workup in progress)

| Stream | Agent | Status |
|--------|-------|--------|
| Design language | researcher | ⏳ running |
| Fast appointment creation | researcher | ⏳ running |
| Client add / search flow | researcher | ⏳ running |
| Money ergonomics | researcher | ⏳ running |
| Home / dashboard experience | researcher | ⏳ running |

Each stream drops into `docs/ideas/IDEAS-<slug>.md`. Chief of Staff critiques each idea (GO / MAYBE / SKIP) before surfacing to CEO.

## Triage rules

- GO → added to queue after current sprints finish
- MAYBE → parked in backlog with open question
- SKIP → rejected with reason

## Backlog (unscheduled, from audit)

- Phase 2 UX audit: floating `+`, 30-min snap, touch drag, typography 7→12 px
- Phase 3 UX audit: design tokens file, z-index registry, BrigadeTabs component
- UX_AUDIT data-loss follow-up: undo-toast hook, debounce in ClientPanel
- STORY-001 Supabase migration
- STORY-002 Auth
- STORY-003 Import 903 clients
