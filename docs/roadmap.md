# Babun2 Roadmap

> Short, honest, prioritized. Update when plans change.

## Status today (2026-04-11)

- **Phase 1 done:** Calendar, clients, services, appointments, schedule, analytics, reports, SMS templates, masters, teams — all in localStorage, working prototype.
- **Pending:** Real backend, auth, tests, mobile app, online booking, messaging integrations.

## Near-term (1-2 weeks)

### STORY-001 — Supabase migration (HIGH)
Move from localStorage to Postgres + Auth + RLS. Single-tenant for AirFix, but schema is multi-tenant-ready.
- Wire `@supabase/ssr` client
- Create migrations for 9 tables (see `docs/stories/STORY-001.md`)
- Add `tenant_id` to every table + RLS policies
- Write seed script that imports existing localStorage dump
- Keep localStorage as offline fallback

### STORY-002 — Auth + onboarding
Login page already exists as stub. Wire it up.
- Supabase Auth (email + magic link for now)
- Create default tenant on first signup
- Invite flow for brothers/teams (email link)
- Role-based UI: admin/dispatcher/lead/helper

### STORY-003 — Import 903 AirFix clients
- Parse Bumpix export (format TBD — ask user)
- Validation script (phone normalization, deduplication)
- Review UI before mass-import
- Preserve history if Bumpix exposes it

## Mid-term (weeks 3-6)

### STORY-004 — Online booking public page
Use `.reference/calcom/packages/lib/availability.ts` as reference.
- Public URL `/book/{team-slug}`
- Pick service → pick slot → contacts → confirm
- SMS/email confirmation (via STORY-005 templates)
- New booking appears in calendar with `is_online_booking: true`

### STORY-005 — WhatsApp Business API (inbox MVP)
- Meta webhook → `/api/webhooks/whatsapp`
- Unified inbox page `/dashboard/inbox`
- Client matching by phone
- Send templated replies
- Realtime updates via Supabase Realtime

### STORY-006 — Route optimization
- Google Maps Directions API
- Day-route view for team leads
- "Оптимизировать маршрут" button
- GPS tracking (team_locations table)

## Later (months 2-3)

### STORY-007 — Mobile app (Expo)
Use `babun-crm/apps/mobile` stub. Tabs: Calendar, Clients, Inbox, More. Same Supabase, realtime sync.

### STORY-008 — Instagram + Telegram + Messenger
Add more channels to the inbox from STORY-005.

### STORY-009 — Stripe subscription + billing
For SaaS v1. Only after at least one other pilot customer.

### STORY-010 — AI marketing
Claude API for:
- Ad copy generation
- Schedule optimization suggestions
- Client segmentation insights
- Auto-responses in inbox

## Ground rules

- **Don't start STORY-N+1 until STORY-N is `done`** (merged + deployed + visible on prod).
- **Supabase migration first**, everything else depends on it.
- **Keep the UI working during migration** — switch data sources, don't rebuild pages.
- **Test data separate from prod** — never drop production tables.
- **Track technical debt** in `docs/adr/` as decision records.
