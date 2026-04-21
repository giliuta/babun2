# Supabase — Babun CRM backend

Implements [ADR-001](../docs/adr/ADR-001-supabase-backend.md). The migrations in `migrations/` create the full schema, RLS policies, and the signup trigger that wires `auth.users` → `public.tenants` + `public.users`.

Babun's app bundle currently runs in `NEXT_PUBLIC_BACKEND_MODE=localStorage` so these migrations can be applied ahead of any user-visible change.

---

## CEO pre-flight checklist

Run these once, from your laptop, before flipping the killswitch.

### 1. Create the Supabase project

1. Open https://supabase.com/dashboard and sign in.
2. **New project**
   - Organization: whichever you own
   - Name: `babun-prod` (and later `babun-staging` for preview deploys)
   - Password: save to your password manager — you'll need it for CLI pushes.
   - Region: `eu-central-1` (Frankfurt) — lowest latency from Cyprus.
   - Plan: Free is enough for AirFix today.

Wait ~2 min for provisioning.

### 2. Install the Supabase CLI

```bash
npm install -g supabase
```

### 3. Link the repo to the project

From the repo root (`C:\Users\Dmitry\Desktop\Babun2`):

```bash
npx supabase login          # opens browser, grants CLI access
npx supabase link --project-ref <your-project-ref>
```

Find `<your-project-ref>` in the Supabase dashboard URL (`app.supabase.com/project/<ref>`).

### 4. Push the migrations

```bash
npx supabase db push
```

This applies the three SQL files in `supabase/migrations/` in order:

1. `20260421000100_initial_schema.sql` — tables + indexes
2. `20260421000200_rls.sql` — `public.tenant_id()` helper + policies
3. `20260421000300_signup_trigger.sql` — auto-create tenant on signup

The CLI asks for confirmation — the diff should show only `CREATE` statements and no destructive drops.

### 5. Turn on email/password auth

Supabase Dashboard → **Authentication** → **Providers** → **Email**:

- Enabled: ON
- "Confirm email" — your choice. **Off** for the first test signups (no mailbox needed); **On** before you invite real customers.
- Minimum password length: 8 (matches the login form).

### 6. Record the keys

Dashboard → **Settings** → **API**:

- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Never** copy the `service_role` key into the web app — it bypasses RLS.

### 7. Set the Vercel env vars

In Vercel → Project → **Settings** → **Environment Variables**, add for **Preview** and **Production** scopes:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | the project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon key |
| `NEXT_PUBLIC_BACKEND_MODE` | `localStorage` (for now — flip later) |

Redeploy the `master` branch (Vercel → Deployments → Redeploy).

### 8. Smoke-test auth

- Open `https://babun2.vercel.app/login` in an incognito window.
- The page is still the prototype stub (mode = `localStorage`), but you can verify Supabase is *reachable* by running in the browser console:

  ```js
  fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tenants?select=id`, {
    headers: { apikey: 'YOUR_ANON_KEY' }
  }).then(r => r.status)
  ```

  Expected: `401` (RLS refuses anonymous reads). **403** or network errors mean the project URL/key are wrong.

### 9. Flip the killswitch and test signup

When you're ready:

1. Change `NEXT_PUBLIC_BACKEND_MODE` to `supabase` in Vercel.
2. Redeploy.
3. Sign up with a throwaway email on `/login`.
4. Check Supabase → **Table Editor** → `tenants`: one row appeared.
5. Check `users`: the row has `tenant_id` set and `role = 'owner'`.
6. Open `/dashboard/settings/import` and run the import. Your localStorage data lands in the tenant.

If anything goes wrong, flip `NEXT_PUBLIC_BACKEND_MODE` back to `localStorage` and redeploy — the app reverts without touching the database.

---

## Re-importing in staging

Use a separate Supabase project (`babun-staging`) linked to the Vercel Preview scope. That way `master` stays on the prod Supabase and PRs run against staging without cross-contamination.

## Adding a new migration later

```bash
npx supabase migration new <snake_case_name>
# edit the SQL file created under supabase/migrations/
npx supabase db push
```

Keep migrations append-only. Never rewrite a migration that's already been pushed to prod — add a new one that undoes/fixes it.

## Verifying RLS is working

From a terminal after signing in as tenant A:

```bash
# Fetch tenant A's JWT from the browser localStorage key `sb-<ref>-auth-token`.
curl -H "Authorization: Bearer $JWT_A" \
     -H "apikey: $ANON_KEY" \
     "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/clients?select=id"

# Same query with tenant B's JWT should return a disjoint set.
# If rows leak across tenants, stop the rollout and debug RLS.
```

A proper automated test lives in TODO: `tests/rls.test.ts` (next sub-story).
