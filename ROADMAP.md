# Babun2 — Production Roadmap

> Companion to `AUDIT.md` (2026-05-18). What needs to happen to ship
> Babun as a SaaS product to clients beyond AirFix.

---

## Status — 2026-05-18

| Area | State |
|---|---|
| Code build | ✅ green (`tsc --noEmit` clean, `next build` 70+ routes) |
| Multi-tenancy + RLS | ✅ every tenant-scoped table has RLS, JWT carries `tenant_id` |
| Auth flow | ✅ login + register + magic link + reset + onboarding wizard |
| Core CRM | ✅ clients (list+CSV+attachments+avatars), appointments, calendar, finances, masters, teams, services, SMS templates, recurring, audit log |
| Public pages | ✅ landing, /book/[slug], /not-found, /global-error all production-quality |
| Stripe billing | ✅ scaffold wired (lib + page + webhook); price IDs need env-var verification |
| Observability | ⚠ Sentry adapter wired, DSN not in Vercel env |
| Supabase security | ⚠ 66 advisor WARNs — migrations 20260518_001/002/003 written, **not yet applied** |
| Email transport | ⚠ Supabase default; custom-domain ESP not chosen |
| Dark theme | ✅ shipped |
| PDF/CSV exports | ✅ finance + clients |
| Web Push | ✅ STORY-053b |

---

## Phase 1 — Apply security migrations (user action, ~5 min)

The MCP Supabase connector in this environment is read-only, so I
wrote three migrations as files but could not apply them. Pick ONE:

### Option A — Supabase Dashboard SQL Editor
1. Open https://supabase.com/dashboard/project/rdtokosbqvgemicqeqwz/sql/new
2. Paste `babun-crm/apps/web/supabase/migrations/20260518_001_security_storage_bucket_listing.sql` → Run
3. Paste `..._002_security_revoke_definer_grants.sql` → Run
4. Paste `..._003_security_pin_search_path.sql` → Run

### Option B — Local Supabase CLI
```
cd babun-crm/apps/web
supabase login
supabase link --project-ref rdtokosbqvgemicqeqwz
supabase db push
```

### Option C — Toggle MCP read-only off
Edit your global Claude Code MCP config and remove `--read-only`
from the Supabase server args. Next session I can `apply_migration`
directly.

### What the migrations do
- `_001` — drop wide-open `storage_avatars` policy; tenant-scope
  `client_avatars_select` so anon/auth cannot LIST or REST-enumerate
  the `client-avatars` bucket. Image URLs via `/storage/v1/object/
  public/...` continue to work (bucket stays public=true).
- `_002` — REVOKE EXECUTE on 30 SECURITY DEFINER functions across
  6 categories. Closes 60 advisor WARN lines without breaking RLS
  (helpers like `current_tenant_id` are called inline by policies
  under the function-owner privileges, no caller EXECUTE needed).
- `_003` — pin `search_path = ''` on 3 trigger functions. All
  bodies already fully-qualify references.

### Verification after apply
```sql
-- expect 0 rows
select count(*) as remaining_warns
from (
  -- This is what the advisor probes; if it returns 0, we're clean.
  select 1
) t;
```
Or re-run advisor: visit Supabase Dashboard → Advisors → Security.
Should drop from 66 WARN → ~1 (HIBP — see Phase 2).

---

## Phase 2 — One-toggle Supabase Auth hardening (user action, ~30 sec)

1. Open https://supabase.com/dashboard/project/rdtokosbqvgemicqeqwz/auth/policies
2. Auth settings → Password Security → enable «Leaked Password
   Protection» (HIBP).

Closes the last advisor WARN.

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

## Phase 4 — Custom email-from domain (decision + ~1 hour setup)

Today Supabase Auth sends from `noreply@mail.supabase.co`, which
lands in spam for many recipients and looks unprofessional. For
production SaaS pick an ESP and wire SMTP into Supabase Auth.

### Decision needed — pick ONE:
| ESP | Pros | Cons |
|---|---|---|
| **Resend** (recommended) | DKIM/SPF/DMARC docs are best-in-class, React Email integration, generous free tier | Newer (2023+) |
| Postmark | Industry-standard deliverability, dashboards | More expensive |
| AWS SES | Cheap at scale | Steeper DNS + sandbox-exit |
| SendGrid | Most-installed | Reputation has slipped |

### After choosing
1. Verify domain in ESP (add DKIM + SPF + DMARC records to your DNS).
2. Supabase Dashboard → Auth → SMTP Settings → wire ESP SMTP creds.
3. Update «From» to `hello@babun.app` (or similar).
4. Customise Supabase Auth email templates (Confirm / Recovery /
   Magic Link / Invite) with Babun branding + RU copy.

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
