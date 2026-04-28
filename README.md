# Babun CRM

## Security

Babun is multi-tenant. **Row-Level Security** is on for every
tenant-scoped table — each user only sees their own data, enforced at
the database layer (not just in app code). Even with the publishable
key in the browser bundle, an attacker who opens DevTools and crafts
direct REST queries cannot read other tenants' rows.

What RLS does **not** cover (handled elsewhere):

- **CSRF** — Supabase auth tokens travel via httpOnly cookies; any
  future custom POST endpoint will need explicit CSRF tokens.
- **Brute-force on login** — Supabase Auth rate-limits sign-in
  attempts out of the box.
- **Session hijacking** — auth cookies are httpOnly + Secure +
  SameSite=lax (Supabase Auth defaults).

CRM platform for service businesses. First customer: AirFix (HVAC, Cyprus).

## Setup

See [docs/SETUP.md](docs/SETUP.md).

## Project structure

- `babun-crm/apps/web/` — Next.js 16 web app (App Router, Tailwind v4, Turbopack)
- `babun-crm/apps/web/supabase/migrations/` — Supabase SQL migrations
- `babun-crm/packages/shared/` — shared types, db repositories, local-storage layer (legacy, being migrated)
- `docs/stories/` — feature plans (STORY-NNN.md)
- `docs/adr/` — architecture decision records

## Workflow

1. `/plan {feature}` → docs/stories/STORY-NNN.md
2. Wait for approval
3. `/implement {story-id}` → code by groups (G0..G6), commit per group
4. Smoke-test gate before bumping versions
5. `git push origin master` → Vercel auto-deploys
