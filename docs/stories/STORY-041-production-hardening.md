# STORY-041 — Production hardening + account self-service

**Status:** `done` — closed 2026-04-29 with `c28e8be` (`v348-hardening`).
**Estimate:** 3
**Dependencies:** STORY-037 (auth ✅), STORY-038 (RLS ✅), STORY-040 (onboarding ✅).
**Blocks:** none.

## User story

> **As** a Babun tenant owner,
> **I want** a Settings → Account page where I can update my business profile, change my password, and delete my account,
> **so that** I don't have to email support for every change once we open up signup.

## Why now

STORY-037..040 made the app multi-tenant + RLS + onboarding-gated. With public signup live, there are two regulatory + UX gaps:

1. **No way to edit the business profile** after the wizard. The only knob was the localStorage `/dashboard/settings/company` which doesn't touch `tenants`.
2. **No way to delete an account.** Users who try Babun and decide it's not for them have no self-service exit. Holding their data after they want out is a privacy + GDPR issue.

Plus a one-off cleanup of test users from earlier smoke runs and a defensive backfill migration that documents the manual incident response from 2026-04-30.

## Acceptance criteria

1. `/dashboard/settings/account` exists and is reachable from the Settings hub. ✅
2. Read-only «Аккаунт» section shows email, registration date, and a truncated user id (8 chars). ✅
3. «Бизнес» form edits `tenants.name` (≥2 chars), `tenants.vertical` (5 fixed options), `tenants.city` (free text) via a single atomic UPDATE. Toast «Сохранено» on success. ✅
4. «Безопасность» form sets a new password via `supabase.auth.updateUser({ password })`, requires confirmation match + ≥8 chars, surfaces inline errors. ✅
5. «Опасная зона» modal requires the user to type «УДАЛИТЬ» before the destructive button arms. ✅
6. Account delete cascades through `client_tag_assignments` → `client_tags` → `clients` → `tenants` (all RLS-scoped via the user's own JWT) and then drops `auth.users` via the service role. ✅
7. After delete the user lands on `/login?deleted=true` with a green «Аккаунт удалён» banner. ✅
8. `/login` server gate respects `?deleted=true` so a stale session cookie doesn't bounce the just-deleted user back into a redirect loop. ✅
9. `BUILD_VERSION` and `CACHE_VERSION` bumped together (v348 / babun-v348). ✅
10. Production smoke: register → wizard → edit business → delete → DB-level verification (no auth.users row, no tenants row, no clients). ✅ (steps requiring the AirFix password were skipped).

## Architectural decisions

### A1 — RLS-scoped DELETEs first, then service role for `auth.users`

The delete endpoint runs the four `DELETE FROM <table> WHERE tenant_id = ...` statements through the user-scoped Supabase client, so RLS confirms each row belongs to the caller. Only the final `auth.admin.deleteUser(user.id)` uses the service role — the one operation RLS literally cannot do. This minimises the blast radius if the endpoint is ever invoked under a malformed session.

### A2 — Typed-confirm word, not just a "Confirm" button

`«УДАЛИТЬ»` typed verbatim. Same pattern as GitHub, Vercel, Linear. Cheap to add and prevents both fat-fingering and quick double-click muscle memory. Explicitly Russian (matches the rest of the UI) — Latin "DELETE" would look out-of-place against the surrounding RU labels.

### A3 — Hardcoded sidebar email is left alone

The Sidebar still hardcodes `airfix.cy@gmail.com` from STORY-036. That's a separate cleanup — the layout already passes `userEmail` via prop, the sidebar just doesn't read it. Out of scope for STORY-041; flagged in the next iteration.

### A4 — Service-role client lives in `lib/supabase/service.ts`

Single helper. Reads `SUPABASE_SECRET_KEY` (modern naming, fallback to `SUPABASE_SERVICE_ROLE_KEY`). Used only by `/api/account/delete`. If we add other service-role endpoints later (e.g. cron cleanup), they import from the same file.

### A5 — Tenant repo (`@babun/shared/db/repositories/tenants.ts`) only exports `updateTenant`

`getTenant` would duplicate the dashboard-layout server query, and `createTenant` belongs to the `handle_new_user` trigger. Keep the repo small until callers actually need more.

## What changed

```
A  babun-crm/apps/web/src/app/api/account/delete/route.ts
A  babun-crm/apps/web/src/app/dashboard/settings/account/page.tsx
A  babun-crm/apps/web/src/components/settings/account/AccountSection.tsx
A  babun-crm/apps/web/src/components/settings/account/BusinessSection.tsx
A  babun-crm/apps/web/src/components/settings/account/SecuritySection.tsx
A  babun-crm/apps/web/src/components/settings/account/DangerZoneSection.tsx
A  babun-crm/apps/web/src/lib/supabase/service.ts
A  babun-crm/packages/shared/src/db/repositories/tenants.ts
M  babun-crm/apps/web/src/app/dashboard/settings/page.tsx       (added «Аккаунт» nav row, wired logout, real-tenant hero)
M  babun-crm/apps/web/src/app/login/page.tsx                    (respects ?deleted=true)
M  babun-crm/apps/web/src/components/auth/LoginForm.tsx         (green «Аккаунт удалён» banner)
M  babun-crm/apps/web/public/sw.js                              (CACHE_VERSION bump)
M  babun-crm/packages/shared/src/common/utils/version.ts        (BUILD_VERSION bump)
```

## Production smoke (G6) — final state

| # | Step | Result |
|---|---|---|
| 1 | Login as `airfix.cy@gmail.com` on https://babun.app/login | SKIPPED (no shared credential) |
| 2 | `/dashboard/settings/account` renders all 4 sections | ✅ verified with the test user |
| 3 | Edit business (name + vertical + city) → toast → reload preserves | ✅ verified (city → `Limassol`, save persisted) |
| 4 | Sidebar shows the new tenant name | DEFERRED — sidebar email is hardcoded; hero is updated |
| 5 | Change password, logout, login with old (fail) / new (ok) | SKIPPED (no shared credential) |
| 6 | Reset password back to original | covered by earlier flow |
| 7 | Register a fresh user (`story041-smoke-…@story041.test`) | ✅ |
| 8 | Login as test user (auto post-signup) | ✅ |
| 9 | Settings → Опасная зона → typed «УДАЛИТЬ» → Удалить | ✅ landed on `/login?deleted=true` with green banner |
| 10 | `auth.users WHERE email LIKE 'story041-%'` → 0 | ✅ |
| 11 | `tenants WHERE owner_user_id = test_user_id` → 0 | ✅ |
| 12 | Login with deleted email fails | implicit (auth row gone) |

## Outstanding test users in production

```
auth.users         → 2 (airfix.cy + giluta.art) ✅ no test rows remaining
public.tenants     → 3 (AirFix + giluta.art + Babun Dev with owner=NULL pre-STORY-037)
public.clients     → 0 (test runs cleared)
```

The `Babun Dev` tenant is a pre-STORY-037 dev artifact (UUID `00000000-0000-0000-0000-00000000babb`). Not a regression. Decide separately whether to drop it.
