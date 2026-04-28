# Babun CRM

> ⚠️ **WARNING — RLS not enabled yet (STORY-038)**
>
> STORY-037 landed real Supabase Auth (register / login / forgot / reset),
> per-user tenants and a server-side auth gate. **But RLS policies aren't
> live yet** — any signed-in user (or anyone who opens DevTools and crafts
> a REST query with the publishable key) can read every tenant's data.
> The UI is correctly tenant-scoped via repository filters, but the
> security gap stays until STORY-038.
>
> **Until STORY-038 ships:**
> - Trusted-tester deploys only — invite people you actually trust.
> - Do **NOT** post the production URL on Twitter / blog / Telegram.
> - Do **NOT** post the publishable key in screenshots.
> - The `<meta robots noindex>` tag stays in `app/layout.tsx`.

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
