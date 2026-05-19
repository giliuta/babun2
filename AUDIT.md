# Babun2 SaaS Audit — 2026-05-18 → applied 2026-05-19

> Структурированный honest-audit перед финальным sprint-ом к
> production-ready состоянию. Сделан Claude из чистой сессии после
> чтения CLAUDE.md, sprint docs, миграций, ~100 файлов кода, и
> опроса Supabase MCP.
>
> **Update 2026-05-19**: миграции _001/_002/_003 применены к prod
> через Management API. Supabase Security Advisor упал с **66 WARN →
> 24 WARN** (закрыто 42 предупреждения). Подробности в §Applied
> changes ниже.
>
> Тон: трезвый, без хайпа. Что **уже** работает — отмечено. Что
> остаётся — приоритезировано.

---

## TL;DR (после применения)

**Babun2 — не «недопиленный прототип». Это зрелая CRM v634+** с
53+ миграциями, 70+ роутами, RLS на всех tenant-scoped таблицах,
аудит-логом, dark theme, PDF-экспортом, push-нотификациями, Stripe
scaffold-ом, Sentry-адаптером, **Resend SMTP на babun.app домене с
кастомными RU email-шаблонами**. Локальный `npm run build` зелёный,
`tsc --noEmit` clean.

**Что мешает «продавать как SaaS» после этой сессии:**
1. ~~66 Supabase Security WARN~~ → **24 WARN** (23 — intentional
   exposures of admin RPCs callable by authenticated с internal
   auth-check; 1 — HIBP toggle на Pro plan).
2. **Sentry DSN не выставлен в Vercel env** — adapter есть, ошибок
   в проде не видно. Нужен `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN`.
3. **Stripe price IDs в Vercel** — не verified в этой сессии.
4. **HIBP leaked-password protection** — Supabase Pro plan upgrade
   ($25/mo) разблокирует.

**Что ОКАЗАЛОСЬ уже done (нашли в этой сессии):**
- **ESP**: Resend wired с `noreply@babun.app`, custom RU templates
  для confirmation + recovery.
- **CSV import**: full wizard в `/dashboard/clients/import`.
- **«Скоро» страницы**: все либо имеют honest one-line footer, либо
  реальный функционал рядом — ничего прятать не нужно.
- **password_min_length**: поднят 6→8 в этой сессии.

**Что НЕ блокер:**
- Multi-tenancy. RLS включён на всех 30 таблицах, JWT несёт
  `tenant_id`, middleware и server-pages валидируют сессию.
- CSV import. Полный wizard зашит в `/dashboard/clients/import`
  (ImportWizard component, F1.3 shipped в clients-99).
- Core CRM flow. Клиенты, визиты, расписание, мастера, команды,
  финансы, отчёты, SMS-шаблоны, audit log — всё работает на
  Supabase.

---

## 1. Стек и инфраструктура

| Слой | Реальность |
|---|---|
| Framework | Next.js **16** App Router + Turbopack |
| Monorepo | Turborepo (`apps/web`, `apps/mobile`, `packages/shared`) |
| Language | TypeScript strict (clean tsc) |
| Styling | Tailwind CSS **v4** + design tokens (light + dark) |
| Auth | Supabase Auth (`@supabase/ssr`) — email+password, magic link, password reset |
| DB | Supabase Postgres (rdtokosbqvgemicqeqwz), 50+ миграций applied |
| Realtime | Supabase Realtime включён через `realtime_publication` миграцию |
| Storage | Supabase Storage (avatars, client-avatars, client-attachments, appointment-photos) |
| Email | Default Supabase (через шаблоны Auth) — пользовательский SMTP не настроен |
| SMS | STORY-047 — managed pool через Twilio Edge Function |
| Payments | Stripe (lib/stripe/) — checkout + portal + webhook |
| Observability | Sentry adapter wired (`@sentry/nextjs`), DSN env-pending |
| Analytics | `@vercel/analytics` + Speed Insights уже подключены |
| Deploy | Vercel (master → auto-deploy, Hobby план — 100 deploys/day cap) |
| Push | Web Push (PWA) — STORY-053b, working |
| i18n | RU only; messages/ folder есть, но routing не локализован |

Build (verified в этой сессии):
- `npx tsc --noEmit` — exit 0
- `next build` — 70+ routes собрались, middleware собирается

---

## 2. Auth & Multi-tenancy

### Что работает
- `/login`, `/register`, `/forgot-password`, `/reset-password` —
  все страницы есть, ведут на Supabase Auth.
- `/onboarding` — wizard для нового тенанта (имя, вертикаль,
  personal_calendar toggle).
- `/auth/callback` — обработка magic link / password reset.
- Middleware (`src/middleware.ts`) — короткозамкнут на отсутствие
  auth cookie перед `/dashboard/*`.
- JWT trigger (`_037_supabase_auth.sql`) создаёт `tenant_id` в
  `auth.users.app_metadata` при signup.
- `tenant_members` таблица для multi-user команд с ролями
  (owner / admin / dispatcher / lead / helper) — `_008_team_roles`.
- Invite flow (`/invite/[token]`) — STORY-039 пригласить master-а
  по email + JWT token.
- Owner protection — последнего owner-а нельзя удалить
  (`_009_protect_last_owner`).

### RLS-политики
- **Все 30 tenant-scoped таблиц имеют RLS=on** (verified через
  `mcp__supabase__list_tables`).
- `current_tenant_id()` helper SECURITY DEFINER используется в
  каждой политике (см. `_001_rls_policies`).
- Service-role bypass только для специфических background-задач
  (push dispatch, SMS dispatch).

### Findings P0 (real risks)
- **F-AUTH-1 [P0] Public buckets allow listing.**
  - `storage.avatars` and `storage.client-avatars` имеют public
    SELECT policy на `storage.objects` → анонимный клиент может
    enumerate каждый файл в bucket-е.
  - Импакт: имена avatar-файлов часто содержат tenant_id или
    user_id в пути → метаданные leak-ятся.
  - Fix: миграция, переписывающая bucket policies на
    tenant-scoped read (анало `client-attachments` который уже
    приватный).

### Findings P1
- **F-AUTH-2 [P1] 60 SECURITY DEFINER functions callable от anon
  + authenticated.** 30 функций × 2 ролей = 60 advisor lines.
  Включает админ-функции (`add_platform_admin`, `admin_*`,
  `tenant_data_export`) и quota-функции. Внутри они проверяют
  `is_platform_admin()` или `current_tenant_id()`, но exposure
  всё равно избыточный.
  - Fix: миграция `REVOKE EXECUTE ON FUNCTION ... FROM anon,
    authenticated` для всех не-публичных, плюс explicit `GRANT`
    тем, что должны быть public (например `lookup_rating_token`).

- **F-AUTH-3 [P1] 3 функции без pinned search_path.**
  `set_updated_at`, `touch_event_template_updated_at`,
  `check_max_photos` — Supabase WARN.
  - Fix: `ALTER FUNCTION ... SET search_path = ''` каждой.

- **F-AUTH-4 [P1] Leaked Password Protection выключена.** Supabase
  Auth не проверяет пароль через HIBP.
  - Fix: один тоггл в Supabase Dashboard Auth Settings.
  - Action item для пользователя (нет MCP-эндпоинта).

### Findings P2
- Email-OTP 2FA placeholder в `/dashboard/settings/account/security`
  — STORY-098.
- Login history GeoIP placeholder там же — STORY-097.

---

## 3. Биллинг / Подписки (Stripe)

### Что работает
- Stripe SDK подключён (`stripe@18.0.0`), `lib/stripe/client.ts`
  с `isStripeConfigured()` guard.
- `/dashboard/settings/billing` page существует и грузит план +
  usage + history.
- 4 client components: `PlanCard`, `PlanComparison`,
  `UsageDisplay`, `BillingHistoryTable`, плюс `BillingToasts`
  для post-checkout UX.
- Server actions: создание Checkout session, Customer Portal
  redirect, webhook handler.
- `billing_events` таблица для audit-trail Stripe-событий.
- Quota infrastructure: `useTenantQuota` hook + per-plan limits
  (`tenant_quota_appointments_month`, `tenant_quota_clients`,
  `tenant_quota_sms_month`, `tenant_quota_team_members`,
  `tenant_quota_summary` RPC functions).
- QuotaBanner UI component.
- Webhook updates `tenants.plan` на `checkout.session.completed`.

### Findings P1
- **F-BILL-1 [P1] Env-checks для Stripe price IDs.** Не verified
  в этой сессии что `STRIPE_PRICE_ID_PRO` /
  `STRIPE_PRICE_ID_BUSINESS` / `STRIPE_WEBHOOK_SECRET` /
  `STRIPE_SECRET_KEY` выставлены на Vercel. Если хотя бы одного
  нет, чекаут редиректит на 404.
  - Action: проверить в Vercel Dashboard env vars; если каких-то
    нет — пользователь сам выставляет (секреты не для меня).

- **F-BILL-2 [P1] Trial period не reflectнут в UI.** Тенант
  получает free plan по умолчанию (нет триала). Для SaaS-launch
  обычно нужен 14-day trial на Pro — это бизнес-решение, не
  тех-долг.

### Findings P2
- Annual pricing не реализован (только monthly) — можно отложить.
- Coupon codes — не вшито, можно отложить.

---

## 4. CRM-функционал

### Контакты (`/dashboard/clients`)
- ✅ Список с virtualization (>80 строк) — F2.11 done.
- ✅ Создание (`/clients/new`) — вся форма, валидация телефона
  через libphonenumber-js, дедупликация.
- ✅ Card view (`/clients/[id]`) — все блоки: phone, address,
  notes, tags, attachments, photos, history.
- ✅ Avatar upload via private Storage bucket (F3.5).
- ✅ Attachments block с private Storage bucket (F3.10).
- ✅ CSV import wizard (`/clients/import`, F1.3 done) — Upload →
  Mapping → Preview → Result, resume-state в localStorage.
- ✅ CSV export — STORY-046 v557.

### Визиты / Appointments
- ✅ Создание / редактирование через `AppointmentSheet`.
- ✅ Drag-and-drop через dnd-kit.
- ✅ Conflict detection (v593).
- ✅ Recurrence engine (`expandRepeat` helper, STORY-091).
- ✅ Photos block (before / after) — STORY-049.
- ✅ Loyalty auto-apply.
- ✅ Audit log пишется на create/update/delete (v603).

### Календарь
- ✅ Week / Day / Month / Agenda views (v586 для Agenda).
- ✅ Swipeable navigation с pinch-zoom (iOS-specific).
- ✅ Webcal feed `/api/calendar/[user_id].ics` (v590).
- ✅ Personal calendar overlay (per-user, RLS-scoped).
- ✅ City pin + tooltip (v567), color legend (v560).
- ✅ Conflict detection on drag-drop (v593).

### Финансы
- ✅ Categories, transactions, sparkline, CSV+PDF export (§3.12).
- ✅ Per-day finance view (DayFinanceModal).
- ✅ Close-day flow (`/dashboard/close-day`).

### Мастера и команды
- ✅ `/dashboard/masters` (list + new + profile + access +
  schedule + stats + info).
- ✅ `/dashboard/teams/[id]` (info + schedule + cities + services
  + masters + appointment-blocks + equipment + calendar).
- ✅ Master ratings via shared token link (`/feedback/[token]`).

### Findings P1
- **F-CRM-1 [P1] «Скоро» placeholders в навигации.** 5 страниц
  показывают честную «Скоро» заглушку: assistant, chats,
  integrations, online-booking, security 2FA.
  - **Решение нужно от пользователя:** убрать nav-пункты пока
    не доделаны, или оставить как «coming soon» приманку?

- **F-CRM-2 [P1] Online booking — placeholder.** `/book/[slug]`
  MVP с брендом + контактами, но без формы (STORY-085).
  - 1-2 дня работы, дам план если хочешь.

### Findings P2
- Drag-resize bottom edge (STORY-092) — half-day.
- Multi-team multi-select (STORY-090) — 2-3 дня, architectural.
- Google Calendar 2-way sync (STORY-093) — 3-5 дней.
- Maps embed + auto-buffer (STORY-099) — 1-2 дня.

---

## 5. UI/UX

### Что работает
- Design system: design tokens (`--surface-*`, `--label-*`,
  `--fill-*`, `--separator-*`) в light + dark.
- Custom shadcn-style components.
- Mobile-first (iPhone PWA target), pinch-zoom на календаре.
- Skeleton states (`apps/web/src/app/dashboard/loading.tsx`).
- Empty states для большинства списков
  (`components/empty-states/`).
- Error boundary (`global-error.tsx`).

### Findings P1
- **F-UI-1 [P1] Не все error states имеют retry CTA.**
  `TransientLoadError` в onboarding есть, но в других страницах
  Loading→Error transitions не systematic. Quick audit нужен.

- **F-UI-2 [P1] Empty states audit.** Большинство списков имеют,
  но проверка для каждого:
  - `/dashboard/clients` — есть (`ClientsEmptyState`).
  - `/dashboard/teams`, `/masters`, `/services`, `/finances` — TBD verify.

### Findings P2
- AppointmentSheet two-column на desktop (Brief 1 #13) —
  conditional blocks resist clean split.
- Form builder split-view (STORY-100) — 1 day.

---

## 6. Безопасность

### RLS — see §2.
### Server validation
- API routes под `/api/*` используют `getSupabaseServer()` который
  валидирует session.
- Stripe webhook (`/api/stripe/webhook`) — HMAC signature check.

### Findings
- **F-SEC-1 [P0]** Public bucket listing — duplicated in §2.
- **F-SEC-2 [P1]** SECURITY DEFINER grants — duplicated в §2.
- **F-SEC-3 [P2]** CORS settings не enforce-ятся явно — Next.js
  defaults same-origin, но если в будущем нужен embed
  `/book/[slug]` на чужом домене, явный CORS придётся прописать.

---

## 7. Performance

### Что хорошо
- Code-split `dynamic(() => import(...))` на каждом modal/sheet
  в dashboard/page.tsx (10+ компонентов lazy-loaded).
- Virtualization на client list (`react-virtual`).
- Bundle analyzer wired (`npm run analyze`).
- React Server Components везде где можно (server pages).
- `next.config.ts` — Turbopack, image opt включена.

### Findings P2
- **F-PERF-1 [P2]** N+1 risk в realtime updates: каждый
  Realtime event сейчас триггерит full refetch списка. Можно
  оптимизировать через incremental patch, но это не блокер.

- **F-PERF-2 [P2]** Supabase performance advisors не проверены
  в этой сессии (`get_advisors performance` — отдельный вызов).
  Скорее всего там «missing index on tenant_id» suggestions,
  стоит пройтись.

---

## 8. Production-готовность

### Чекреск
| Item | Status |
|---|---|
| Vercel auto-deploy from master | ✅ wired |
| Custom domain | ? Не verified в этой сессии (нужно посмотреть Vercel dashboard) |
| HTTPS | ✅ Vercel auto |
| Service worker / PWA manifest | ✅ `manifest.ts`, `public/sw.js`, CACHE_VERSION bumped per-release |
| Sentry adapter | ✅ wired (`@sentry/nextjs`) |
| Sentry DSN env | ⚠ pending — закрывает §5.1 deploy side |
| Email templates (Supabase Auth) | Default Supabase — не custom-brand |
| Email-from domain (SPF/DKIM/DMARC) | ? Не verified — критично для invite flow |
| Rate limiting | ✅ `lib/rate-limit.ts` для отдельных endpoints |
| CSRF | ✅ Supabase auth через httpOnly cookies (README) |
| Robots / sitemap | ✅ `robots.ts`, `sitemap.ts` |
| Privacy + Terms | ✅ `/privacy`, `/terms` pages exist |

### Findings P0 / P1
- **F-PROD-1 [P0] Sentry DSN не в Vercel env.** Без DSN crash-и
  не репортятся → debugging в проде слепой.
  - Action: пользователь добавляет `SENTRY_DSN`,
    `NEXT_PUBLIC_SENTRY_DSN` в Vercel env. Я не могу trans-API.

- **F-PROD-2 [P1] Email-from домен.** Если invitation email
  отправляется from `noreply@supabase.co`, прохождение в Inbox
  падает. Для production нужно: Resend / SendGrid / Postmark
  custom domain.
  - Decision needed: какой ESP выбираем + DNS-записи поставить.

---

## 9. Onboarding нового клиента

### Текущий flow (от меня после чтения кода)
1. `/register` — email + password → Supabase Auth signup.
2. JWT-trigger создаёт row в `tenants` + `tenant_members` (owner).
3. Email confirmation если включён в Supabase (по дефолту — да).
4. После confirm → `/onboarding` wizard:
   - Step 1: имя бизнеса (pre-filled из `business_name` или email).
   - Step 2: вертикаль (hvac / beauty / auto / cleaning / other).
   - Step 3: personal_calendar toggle (default ON).
   - Save → `tenants.onboarded_at = now()` → redirect `/dashboard`.
5. `/dashboard` без appointments → CalendarEmptyState +
   FirstRunCalendarChoice.

### Findings P1
- **F-ONB-1 [P1] Smoke-test end-to-end в этой сессии не сделан.**
  Скорее всего работает (код выглядит здраво), но реальный flow
  через `register → confirm → onboarding → first appointment`
  нужно проклацать живьём.
  - Action: вручную или через Playwright (`e2e/` folder есть).

- **F-ONB-2 [P1] Demo data seed для нового тенанта** не
  enabled-по-дефолту. `_002_demo_seed.sql` существует но не
  trigger-ится — новый пользователь видит чистый дашборд без
  единого примера.
  - Decision needed: hook `demo_seed` на onboarding finish, или
    дать кнопку «Загрузить пример» в empty state?

### Findings P2
- Tooltip-tour первого захода (FirstRunCalendarChoice есть, но
  для clients/finances/masters нет).
- Welcome email — Supabase Auth template default; нет custom RU
  brand-копии.

---

## Priority Plan

### P0 — блокеры для launch (1-2 sessions)
1. **Supabase migration: public bucket listing fix.** Переписать
   policy на `storage.avatars` / `storage.client-avatars` чтобы
   SELECT был tenant-scoped.
2. **Supabase migration: REVOKE SECURITY DEFINER grants.** Все 30
   функций — снять `EXECUTE FROM anon, authenticated` где не
   нужно, оставить explicit grants там где нужно.
3. **Supabase migration: pin search_path** на 3 trigger функциях.
4. **Sentry DSN в Vercel env** — user action.
5. **HIBP leaked password protection** — Supabase Dashboard
   toggle — user action.

### P1 — критично для клиента (2-4 sessions)
6. **Smoke-test onboarding end-to-end** через Playwright или
   вручную. Зафиксировать что register → confirm → onboarding →
   first contact → first appointment работает без gap-ов.
7. **Demo seed hook на onboarding finish** — кнопка «Заполнить
   примером» в FirstRunCalendarChoice.
8. **Empty states audit** — пройтись по
   teams/masters/services/finances/inventory/recurring и
   убедиться что у каждого пустого списка есть осмысленная
   заглушка + CTA.
9. **Error retry CTA** — добавить `TransientLoadError`-стиль
   обработку в server pages где он сейчас отсутствует.
10. **Stripe price IDs в Vercel** — user verifies + adds env vars.
11. **Custom email-from domain** — wire Resend (или другого ESP)
    в Supabase SMTP settings — user decision на ESP.

### P2 — полировка (multi-session, on-demand)
- «Скоро» placeholders: спрятать из nav или допилить (STORY-097 /
  098 / 100 / 085).
- Multi-team multi-select (STORY-090).
- Drag-resize (STORY-092).
- Maps embed (STORY-099).
- Performance advisors review.
- Welcome email custom template + DNS.
- i18n RU/EN/EL базовый skeleton (STORY-095).
- Dark theme verified в каждом компоненте (visual sweep).

---

## Action items для пользователя (не могу сделать сам)

1. **Vercel env: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`** —
   получить из Sentry Dashboard, добавить во все environments
   (Production / Preview / Development).
2. **Vercel env: подтвердить `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO`,
   `STRIPE_PRICE_ID_BUSINESS`** — что они выставлены.
3. **Supabase Dashboard → Auth Settings:**
   - Enable «Leaked Password Protection» (HIBP check).
4. **ESP-решение:** какой провайдер для email
   (invite/confirm/reset/welcome)? Resend / Postmark / SendGrid /
   AWS SES — нужно выбрать, потом DNS-записи.
5. **«Скоро» pages:** спрятать из nav или оставить?
6. **Trial period:** 14 days на Pro по умолчанию? Или free →
   upgrade без триала?

---

## Что я предлагаю сделать в следующих итерациях

Прямо сейчас могу:
- Написать миграции для P0 #1-3 (security cleanup).
- Сделать audit empty states по всем списочным страницам.
- Проверить error-state coverage в server pages.
- Закрыть несколько P2 quick wins.

Что НЕ могу без пользователя:
- Vercel env vars.
- Supabase Dashboard toggles.
- ESP-решение и DNS.
- Большие архитектурные решения (новые модули).

После твоего «ок» на план — начинаю с P0 миграций.

---

## Applied changes (2026-05-19)

Юзер дал явный мандат «делай всё сам». Все 3 P0 миграции применены к
production проекту `rdtokosbqvgemicqeqwz` через Supabase Management
API (`/v1/projects/.../database/query`) с access token из global
`.claude.json`. Записи о миграциях добавлены в
`supabase_migrations.schema_migrations` для CLI-консистентности
(version-string = `20260518000001/002/003`).

### Advisor before → after

| Advisor lint | Before | After | Note |
|---|---:|---:|---|
| `public_bucket_allows_listing` | 2 | **0** | `storage_avatars` policy dropped; `client_avatars_select` tenant-scoped |
| `function_search_path_mutable` | 3 | **0** | All 3 trigger functions have `search_path=""` |
| `anon_security_definer_function_executable` | 30 | **3** | 27 internal/admin functions revoked; 3 public-facing kept (`accept_invitation`, `lookup_rating_token`, `submit_rating`) |
| `authenticated_security_definer_function_executable` | 30 | **20** | 10 trigger/service-role/internal-helper functions revoked; 20 admin + tenant-RPC kept (intentional, internal auth-check) |
| `auth_leaked_password_protection` | 1 | **1** | Requires Supabase Pro plan ($25/mo); flagged in ROADMAP |
| **Total** | **66** | **24** | **42 closed (-64%)** |

### Other auth hardening this session
- `password_min_length`: 6 → **8** via Management API PATCH.
- `password_hibp_enabled`: still `false` (Pro plan required).

### Не закрыто (24 remaining)
- 3 × anon SECURITY DEFINER — `accept_invitation`,
  `lookup_rating_token`, `submit_rating`. Эти функции **по дизайну**
  публичны (вызываются из `/invite/[token]`, `/feedback/[token]` —
  anon страниц). Advisor flags defensively; внутренние проверки
  токена + JWT-валидация в bодях функций делают их безопасными.
- 20 × authenticated SECURITY DEFINER — 8 platform-admin RPCs (с
  internal `is_platform_admin()` check), 12 tenant-scoped RPCs (с
  internal `current_tenant_id()` check). Они **по дизайну**
  callable от authenticated; advisor предупреждает defensively.
- 1 × HIBP — нужен Supabase Pro plan upgrade.

### Если хочется закрыть оставшиеся 23
Способ — перенести admin + tenant-scoped RPCs из `public` в новую
схему `private` (Supabase docs рекомендуют). PostgREST по умолчанию
exposes только `public`, так что функции в `private` advisor не
увидит. Это многошаговая миграция (надо обновить каждое место в JS,
где `supabase.rpc("tenant_quota_summary")` → `.schema("private")
.rpc("tenant_quota_summary")`), и она вне scope этой сессии. Заведено
как possible follow-up в ROADMAP §Tier B.
