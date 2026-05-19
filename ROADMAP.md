# Babun2 — Production Roadmap

> Companion to `AUDIT.md` (2026-05-18, updated 2026-05-19). What
> needs to happen to ship Babun as a SaaS product to clients beyond
> AirFix.

---

## Status — 2026-05-19 (post-apply)

| Area | State |
|---|---|
| Code build | ✅ green (`tsc --noEmit` clean, `next build` 70+ routes) |
| Multi-tenancy + RLS | ✅ every tenant-scoped table has RLS, JWT carries `tenant_id` |
| Auth flow | ✅ login + register + magic link + reset + onboarding wizard |
| Core CRM | ✅ clients (list+CSV+attachments+avatars), appointments, calendar, finances, masters, teams, services, SMS templates, recurring, audit log |
| Public pages | ✅ landing, /book/[slug], /not-found, /global-error all production-quality |
| Stripe billing | ✅ scaffold wired (lib + page + webhook); price IDs need env-var verification |
| Observability | ⚠ Sentry adapter wired, DSN not in Vercel env |
| Supabase security | ✅ **24 WARN** (was 66; -42 closed). Remaining are intentional admin/public RPCs + HIBP (Pro plan). |
| Email transport | ✅ **Resend wired** on `noreply@babun.app` with custom RU templates for confirmation + recovery |
| Dark theme | ✅ shipped |
| PDF/CSV exports | ✅ finance + clients |
| Web Push | ✅ STORY-053b |

---

## ~~Phase 1 — Apply security migrations~~ ✅ APPLIED 2026-05-19

All 3 migrations applied via Supabase Management API on 2026-05-19.
Recorded in `supabase_migrations.schema_migrations` as versions
`20260518000001`, `20260518000002`, `20260518000003`.

**Advisor result**: 66 WARN → 24 WARN (-42, -64%).

---

## Phase 2 — HIBP toggle (needs Supabase Pro plan upgrade)

Tried to flip via Management API; Supabase returned:
> Configuring leaked password protection via HaveIBeenPwned.org is
> available on Pro Plans and up.

**Action**: upgrade Supabase project to Pro ($25/mo) at
https://supabase.com/dashboard/project/rdtokosbqvgemicqeqwz/settings/billing
→ HIBP toggle becomes available → enable it.

Pro plan also gives:
- Daily backups (current Free has none).
- Higher API request limits.
- Better analytics retention.

(Already done in this session: `password_min_length` raised 6 → 8
via Management API PATCH.)

---

## Phase 3 — Vercel env vars verification (user action, ~5 min)

Visit https://vercel.com/babun/babun2/settings/environment-variables
and confirm these exist for **Production** environment:

### Sentry (closes §5.1 deploy side)
- `SENTRY_DSN` — server-side error capture.
- `NEXT_PUBLIC_SENTRY_DSN` — client-side error capture.
  Both come from your Sentry project dashboard → Settings → Client
  Keys (DSN). The same DSN value works for both.

### Stripe (so checkout doesn't 404)
- `STRIPE_SECRET_KEY` — live mode `sk_live_…`.
- `STRIPE_WEBHOOK_SECRET` — from webhook endpoint settings.
- `STRIPE_PRICE_ID_PRO` — live mode Pro price ID.
- `STRIPE_PRICE_ID_BUSINESS` — live mode Business price ID.

### Supabase (probably already set)
- `NEXT_PUBLIC_SUPABASE_URL` — `https://rdtokosbqvgemicqeqwz.supabase.co`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — publishable anon key.
- `SUPABASE_SECRET_KEY` — service-role key (NOT anon — memory note
  flags this was misconfigured previously: project_vercel_supabase_secret_key).

---

## ~~Phase 4 — Custom email-from domain~~ ✅ ALREADY DONE

Discovered via Management API in this session: Supabase Auth SMTP
is already wired to **Resend** (`smtp.resend.com`) with sender
`noreply@babun.app` / display name `Babun`. Custom RU email
templates already configured for:

- **Confirmation** — «Babun: подтверждение email» (custom HTML
  pointing at `/auth/callback?token_hash=...&type=signup&next=
  /dashboard/clients`).
- **Recovery** — «Babun: сброс пароля» (custom HTML pointing at
  `/auth/callback?token_hash=...&type=recovery&next=/reset-password`).

Not yet customised (still default English copy):
- Magic Link, Invite, Reauthentication, Email Change, password/
  phone/MFA notifications.

**Optional future polish** (no business blocker):
- Translate the 12 remaining templates to RU.
- Verify Resend domain DKIM/SPF/DMARC records in DNS still pass
  (last DKIM rotation can break deliverability silently).

---

## Phase 5 — Multi-day stories (in priority order)

Listed in `docs/stories/REMAINING-WORK-2026-05-17.md`. Pick one,
run `/plan STORY-NNN`, ship it. Don't batch — each is a focused
1-day → multi-day deliverable.

### Tier A (clear customer value, modest size)
- **STORY-085** — Online booking full form on `/book/[slug]` (1-2 d).
- **STORY-094** — Webhooks for developers (1 d) — table + dispatcher.
- **STORY-091** — Recurrence engine + custom-pattern UI (1 d).
- **STORY-092** — Drag-resize appointment bottom edge (½ d).

### Tier B (architecture-heavy)
- **STORY-090** — Multi-team multi-select calendar (2-3 d).
- **STORY-093** — Google Calendar 2-way sync (3-5 d).
- **STORY-095** — i18n base scaffold next-intl (1-2 d).
- **STORY-096** — Dark theme component sweep (verify everywhere).

### Tier C (need external dependencies)
- **STORY-099** — Maps embed + auto-buffer (Google Maps API key, 1-2 d).
- **STORY-097** — Login history GeoIP (ipinfo.io token, 1 d).
- **STORY-098** — Email-OTP 2FA factor (Resend/SES decision, 1 d).
- **STORY-100** — Form builder split-view (1 d).

### Tier D (later)
- Real WhatsApp Business / Instagram channel integration (multi-day).
- Mobile app (Expo, packages/mobile stub) — STORY-007.
- AI assistant (STORY-010) — Claude API tool-calls + transcripts.

---

## Definition of «Production-ready for clients beyond AirFix»

Tick all of the following:

### MUST
- [ ] Phase 1 applied — Supabase advisor 0 WARN.
- [ ] Phase 2 applied — HIBP on.
- [ ] Phase 3 applied — Sentry DSN visible in production
      (open `/dashboard`, deliberately throw a `console.error
      ("test")`, see it in Sentry).
- [ ] Phase 4 applied — sign up with a fresh email, receive the
      confirmation from your domain (not supabase.co), land in
      inbox not spam.
- [ ] Smoke-test full flow on prod: register → confirm → onboarding
      → create first client → create first appointment → mark paid
      → check audit log → upgrade to Pro on Stripe (test mode) →
      verify webhook flipped `tenants.plan = 'pro'`.
- [ ] Domain pointing — `babun.app` resolves to the Vercel project
      with HTTPS, `www.babun.app` redirects.
- [ ] Custom domain in Supabase Auth → confirmation email links
      use `https://babun.app/auth/callback` (not Vercel preview).
- [ ] Privacy + Terms reviewed by a lawyer (links are at /privacy
      + /terms).
- [ ] Backup strategy — Supabase auto-backups are enabled (Pro
      plan gets daily; verify in dashboard).

### SHOULD
- [ ] Trial period defined (14-day free trial on Pro vs
      free-then-upgrade — decision needed).
- [ ] First-run tutorial / Coachmarks beyond
      `FirstRunCalendarChoice` (current is calendar-only).
- [ ] Demo seed wired to onboarding-finish (optional «Заполнить
      пример» CTA — schema exists in `_002_demo_seed.sql`).
- [ ] Mobile QA pass — iPhone Safari + iPad + Android Chrome.
- [ ] Lighthouse a11y > 95 on landing + login + dashboard.

### NICE-TO-HAVE
- [ ] i18n RU/EN/EL (STORY-095).
- [ ] STORY-046 CSV import already shipped; verify with a 1000-row
      Bumpix export.
- [ ] Onboarding video / loom embed in landing FAQ.

---

## Open architectural decisions (need user input)

1. **Trial model.** 14-day free trial on Pro, or free-tier-then-
   upgrade-anytime? Affects landing copy + Stripe checkout shape.
2. **ESP choice** (see Phase 4) — Resend / Postmark / SES /
   SendGrid?
3. **Demo seed UX** — auto-fire on onboarding finish, or opt-in
   button in empty state? Auto-fire is friendlier but means the
   user later has to delete fake data.
4. **AirFix import** — when do we cut over the 903-client Bumpix
   export? Requires STORY-003 (parse + dedup script).

---

## Quick-reference commands

```bash
# Dev
cd babun-crm/apps/web && npm run dev      # → http://localhost:3001

# Typecheck (from babun-crm/)
npx tsc --noEmit -p apps/web

# Build (from babun-crm/apps/web/)
npm run build

# Bundle analyze
ANALYZE=true npm run build

# Run e2e (need Playwright install)
npm run e2e:install && npm run e2e
```

After applying Phases 1-4, this project is production-ready for
its first paying customer beyond AirFix.
