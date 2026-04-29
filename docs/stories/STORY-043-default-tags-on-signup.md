# STORY-043 — Default client tags for new tenants

**Status:** `backlog`
**Estimate:** TBD (likely 1)
**Dependencies:** STORY-037 (auth + handle_new_user trigger ✅), STORY-040 (onboarding wizard ✅).
**Blocks:** none.

## Why

When a new tenant lands on `/dashboard/clients`, they have an empty tag set and have to invent their own taxonomy from scratch. The four tags we used internally for so long — VIP / Новый / Постоянный / Проблемный — are good defaults for a first-time service business. They were sitting on the orphan `Babun Dev` tenant until 2026-04-29 (deleted as part of post-STORY-041 cleanup) and never reached a real user.

## Decision needed

Two equally cheap insertion points; pick one:

### Option A — extend `handle_new_user` trigger
Add four `INSERT INTO public.client_tags` statements right after the `tenants` row is created. Pro: every signup gets them, including users who skip onboarding. Con: trigger logic grows, and the migration must run before the next signup.

### Option B — add to onboarding wizard step 4 commit
Insert the four tags from the same atomic write that stamps `onboarded_at`. Pro: keeps the trigger lean. Con: users who somehow land on the dashboard without finishing onboarding (shouldn't be possible after STORY-040 A2 server gate, but) miss them.

## Default set (locked)

```
VIP          #f59e0b   (orange)
Новый        #3b82f6   (blue)
Постоянный   #10b981   (green)
Проблемный   #ef4444   (red)
```

These are the ones we shipped on the dev tenant — keep the same names + colours so the visual association is consistent for any user who has seen them in screenshots.

## Acceptance criteria

1. New signup → `tenants` row created → 4 default `client_tags` rows visible in `/dashboard/clients` filter chips.
2. No duplicate insert if a user re-runs onboarding (idempotent — either the trigger uses `ON CONFLICT DO NOTHING` keyed on `(tenant_id, name)`, or the wizard checks before insert).
3. Migration is idempotent + safe to apply against the existing 2 tenants (it should NOT retroactively create tags for already-onboarded users — they'll define their own; just gate on `not exists`).
4. Production smoke: `/register` → wizard → tags visible immediately.
