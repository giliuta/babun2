# Babun CRM — Local Dev Setup

> ⚠️ **WARNING — RLS not enabled yet (STORY-038)**
>
> STORY-037 landed real Supabase Auth (register / login / forgot / reset),
> per-user tenants and a server-side auth gate. **But RLS policies aren't
> live yet** — any signed-in user (or anyone who opens DevTools and crafts
> a REST query with the publishable key) can read every tenant's data.
> The UI is correctly tenant-scoped via repository filters, but the
> security gap stays until STORY-038.
>
> **Until STORY-038 ships:** trusted-tester deploys only. Don't post the URL or
> the publishable key in screenshots. `<meta robots noindex>` stays in place.

## Supabase Dashboard config (one-time, per project)

After running the auth migration (`20260428_001_auth_tenants.sql`), set the
following in the Supabase Dashboard:

- **Authentication → Sign In / Providers → Email → "Confirm email" OFF.**
  STORY-037 ships with auto-sign-in after register so dev / smoke-test
  works end-to-end. STORY-040 will reinstate confirmation with a proper
  "verify your email" UI flow.

## Prerequisites

- Node 20+
- npm 11+
- Access to the Supabase project `rdtokosbqvgemicqeqwz` (eu-west-1, free tier)

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/giliuta/babun2.git
cd babun2
npm install              # from repo root — Turborepo workspaces install everything
```

### 2. Get Supabase keys

Open https://supabase.com/dashboard/project/rdtokosbqvgemicqeqwz/settings/api and copy:

- **Project URL** — `https://rdtokosbqvgemicqeqwz.supabase.co`
- **Publishable key** — starts with `sb_publishable_…`. Safe to expose; sent to the browser.
- **Secret key** — starts with `sb_secret_…`. Server-side only; never commit.

### 3. Create `.env.local`

From `babun-crm/apps/web/`:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` — fill in the publishable + secret keys. Leave `NEXT_PUBLIC_DEV_TENANT_ID` as the seeded UUID.

`.env.local` is in `.gitignore`. **Never commit it.** If you accidentally push it, immediately revoke + reissue the keys in the Supabase Dashboard.

### 4. Generate Supabase types (optional)

The repo ships a hand-validated `database.types.ts` matching the applied migration. To regenerate from the live project:

```bash
# One-time: get a Supabase Personal Access Token at
# https://supabase.com/dashboard/account/tokens, then:
export SUPABASE_ACCESS_TOKEN=sbp_…

cd babun-crm/apps/web
npm run db:types
```

### 5. Run dev

```bash
cd babun-crm/apps/web
npm run dev          # localhost:3001 by default; falls back to 3000
```

Open http://localhost:3001/dashboard/clients — you should see the empty list (or seeded clients if any).

## Migrations

Always run the Supabase CLI from `babun-crm/apps/web/` so it scopes to that workspace's `supabase/migrations/` folder.

```bash
cd babun-crm/apps/web

# Link the CLI to the project once
npx supabase link --project-ref rdtokosbqvgemicqeqwz

# Push pending migrations
npx supabase db push
```

**Manual fallback** (if the CLI fails — e.g. no PAT available):

1. Open the Supabase SQL Editor: https://supabase.com/dashboard/project/rdtokosbqvgemicqeqwz/sql/new
2. Paste the SQL of any new file under `apps/web/supabase/migrations/`
3. Click Run
4. Verify with `select count(*) from public.tenants;`

## Vercel Production Setup

The deployed app at https://babun2.vercel.app needs the same env vars set in Vercel. **Do this BEFORE pushing changes that depend on the variables**, otherwise the build will deploy a broken bundle.

1. Go to **Vercel Dashboard → Project `babun2` → Settings → Environment Variables**.
2. Add each of the four variables. For each, enable **Production**, **Preview**, **Development**.

   | Name | Value | Sensitive? |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://rdtokosbqvgemicqeqwz.supabase.co` | no |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | no |
   | `SUPABASE_SECRET_KEY` | `sb_secret_…` | **yes** — toggle the *Sensitive* checkbox |
   | `NEXT_PUBLIC_DEV_TENANT_ID` | `00000000-0000-0000-0000-00000000babb` | no |

3. Save → either trigger a redeploy from the Deployments tab or push a new commit.
4. Verify by opening https://babun2.vercel.app/dashboard/clients — list should load from Supabase.

## Common errors

- **`Supabase env missing`** at runtime — `.env.local` not present or one of the publishable/URL vars is empty.
- **`new row violates row-level security policy`** — RLS is on but no permissive policy. Run `apps/web/supabase/migrations/20260427_002_disable_rls.sql` (Dashboard SQL Editor fallback works) until STORY-038 ships proper policies.
- **`invalid input syntax for type uuid`** — id field passed to Supabase isn't UUID-formatted. New clients should use `crypto.randomUUID()` (handled by `createBlankClient`); legacy `cli-…` ids will fail.

## Common dev tasks

```bash
# Type check
cd babun-crm/apps/web && npx tsc --noEmit

# Lint
cd babun-crm/apps/web && npx eslint src

# LAN dev (test from phone on same Wi-Fi)
cd babun-crm/apps/web && npm run dev:lan
```
