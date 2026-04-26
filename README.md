# Babun CRM

> ⚠️ **WARNING — DB is publicly readable until STORY-038**
>
> Babun is currently running on a Supabase project **without RLS enabled** and
> with the publishable key in the browser bundle. Anyone who can reach
> `babun2.vercel.app` can `select *` from the `clients` table.
>
> **Until STORY-038 lands:**
> - Do **NOT** share the production URL publicly.
> - Do **NOT** post the publishable key (or any screenshot containing it) anywhere.
> - Treat the deployed instance as private dev.

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
