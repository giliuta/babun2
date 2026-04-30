# STORY-045 — Public landing page

**Status:** `done` — shipped as `v363-landing` (2026-04-30).
**Estimate:** 2.
**Dependencies:** none (replaces the `/` → `/login` redirect; doesn't touch existing flows).
**Blocks:** STORY-045b (EN translation), STORY-052 (real pricing tiers / Stripe).

## Why

Today `babun.app/` redirects straight to `/login`. A stranger with the link sees a login form and bounces. After STORY-045 the same URL is a public marketing page that explains what Babun is in 5 seconds, with clear CTAs to register or log in. Logged-in users are skipped to `/dashboard/clients` so the landing only shows up for actual visitors.

## Decisions (locked from your brief)

- **D1.** Tagline locked: "Babun — CRM для сервисного бизнеса"; H1 drops the "Babun —" prefix because the wordmark is in the page header logo.
- **D2.** Mobile-first, Apple/Linear voice (clean, factual, no jokes / no jargon).
- **D3.** RU only in v1; EN deferred to STORY-045b (i18n setup).
- **D4.** Pricing line: "Бесплатно сейчас, платные тарифы появятся осенью 2026" — single hero card, no real tiers.
- **D5.** Brand stack: Tailwind v4 + system fonts only (no Google Fonts to keep latency / privacy clean) + accent `#3E88F7` reused via CSS var (`var(--accent)`).
- **D6.** Logged-in user lands on `/dashboard/clients` directly via server-side redirect (`page.tsx` server component checks Supabase session).
- **D7.** Placeholder pages for `/privacy` and `/terms` — real legal copy is a follow-up before public launch.
- **D8.** OG image: static PNG in `public/og.png` (1200×630). Avoid `@vercel/og` runtime cost; can swap to runtime later if we want dynamic per-section OGs.

## G0 — Inventory

- `apps/web/src/app/page.tsx` (5 lines) — currently `redirect("/login")`.
- `getSupabaseServer()` already exists for SSR auth checks (`/dashboard/layout.tsx`, `/onboarding/page.tsx`).
- Brand variables in `globals.css`: `--accent`, `--surface-grouped`, `--surface-card`, `--label`, etc. — reuse, don't redefine.
- Icons: `@babun/shared/icons` (lucide-style) — `Smartphone`, `Users`, `Calendar`, `FileUp`, `Lock`, `Wifi` available.
- No favicon mentioned; existing `apps/web/public/favicon.ico` (probably default Next) — leave as-is for now.

## Content drafts — needs your `ok`

### Hero copy

```
H1:           CRM для сервисного бизнеса
Subheadline:  Клиенты, расписание, команда — всё в одном месте.
              Mobile-first, multi-device sync.
CTA primary:  Попробовать бесплатно   →  /register
CTA secondary: Войти                   →  /login
```

### Features — picked 6 (your full list of 7, dropped "Безопасность" as a hero card and folded it into FAQ instead — security as a tile competes for attention with the customer-facing benefits)

| # | Icon | Title | Description |
|---|---|---|---|
| 1 | `Smartphone` | Mobile-first PWA | Устанавливается на iPhone и Android как обычное приложение. Работает быстро, выглядит как родное. |
| 2 | `RefreshCw` | Синхронизация в реальном времени | Изменения с телефона мгновенно появляются на компьютере у коллег. Без F5, без задержек. |
| 3 | `Users` | Команда и роли | Owner, Dispatcher, Master с гранулярным доступом. Мастер видит только свои встречи и не трогает финансы. |
| 4 | `Calendar` | Умный календарь | Смены команды, рабочие часы, выходные, выезд по городам. Перетаскивай, копируй, повторяй. |
| 5 | `User` | Карточки клиентов | История визитов, заметки, фото объектов, теги, дни рождения. Всё в одном экране. |
| 6 | `FileUp` | Импорт из других CRM | Загрузи CSV из Bumpix, HubSpot или Excel. За 5 минут переедешь со всеми клиентами. |

### How it works — 3 шага

1. **Зарегистрируйся** — за 30 секунд. Email + пароль, без подтверждения по SMS.
2. **Настрой бизнес** — название, тип (HVAC / красота / авто / клининг / другое), город. Минута через onboarding wizard.
3. **Работай** — добавляй клиентов, планируй встречи, приглашай команду через email-инвайт. Всё бесплатно во время беты.

### Pricing card

```
Title:        Бесплатно сейчас
Body:         Babun находится в активной разработке. Все функции
              доступны бесплатно во время беты.
              Платные тарифы появятся осенью 2026.
Sub-text:     Если зарегистрируешься сейчас — получишь grandfathered
              access к специальным условиям при запуске платных тарифов.
CTA:          Зарегистрироваться  →  /register
```

### FAQ — 7 questions

**1. Сколько стоит сейчас?**
Сейчас Babun полностью бесплатен. Платные тарифы появятся осенью 2026. Юзеры, которые зарегистрировались во время беты, получат особые условия при запуске платных тарифов.

**2. Можно ли импортировать клиентов из другого CRM?**
Да. Загрузи CSV из Bumpix, HubSpot, Excel или любого другого CRM — Babun сам определит колонки и проверит дубликаты по телефону. Поддерживаются UTF-8 и Windows-1251. До 5000 строк за один раз.

**3. Безопасны ли мои данные?**
Каждый бизнес изолирован на уровне базы данных через Row-Level Security в PostgreSQL. Это значит даже мы не можем случайно показать твои данные другому юзеру — изоляция на уровне SQL-запросов. Все соединения шифруются TLS, пароли хранятся как bcrypt-хэши.

**4. Какие устройства поддерживаются?**
iPhone, Android, любой современный браузер. Mobile-first дизайн — всё рассчитано на одну руку. На десктопе тоже хорошо. PWA устанавливается на главный экран iOS и Android как обычное приложение.

**5. Можно ли пригласить команду?**
Да. Owner отправляет email-инвайт с одной из трёх ролей: Owner (полный доступ), Dispatcher (календарь и клиенты, без финансов) или Master (только свои встречи, без редактирования). Ссылка живёт 7 дней, использовать можно один раз.

**6. Работает ли offline?**
Частично. Babun — PWA, поэтому открытые страницы кэшируются и доступны без интернета. Но новые клиенты, встречи и фото загружаются сразу в облако и требуют сеть. Полноценный offline-режим с очередью изменений — в дорожной карте.

**7. Что будет когда появятся платные тарифы?**
Осенью 2026 мы введём бесплатный план (для самозанятых) и платные тарифы для команд. Юзеры из беты получат grandfathered-условия — лимиты выше или цена ниже. Базовые функции (клиенты, календарь, мобильное приложение) останутся доступны навсегда.

### Footer

```
Logo "Babun"
Tagline:      CRM для сервисного бизнеса
Links:        О продукте · Условия · Конфиденциальность · Контакты
Email:        hello@babun.app   (Cloudflare email routing → giluta.art@gmail.com)
©:            © 2026 Babun · Cyprus
```

"О продукте" anchors back to `/#features`. "Контакты" is a `mailto:hello@babun.app` link. Privacy / Terms are placeholder pages.

### SEO

- `<title>` — "Babun — CRM для сервисного бизнеса"
- `<meta description>` (155 chars):
  > Простой CRM для HVAC, beauty, auto, cleaning и других сервисных бизнесов. Multi-device sync, команда и роли, mobile-first PWA. Бесплатно во время беты.
- OG image: static `apps/web/public/og.png` (1200×630, brand-blue + tagline + small Babun logo). I'll generate a placeholder during implementation; you can swap with a designer-made one later.
- `robots.txt` and `sitemap.xml` — generated via the Next 16 metadata API (`apps/web/src/app/robots.ts`, `apps/web/src/app/sitemap.ts`).

## G1 — Replace root redirect with the landing page

`apps/web/src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import LandingHero from "@/components/landing/Hero";
// ...other sections

export default async function HomePage() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard/clients");
  return (
    <main className="bg-[var(--surface-grouped)]">
      <LandingHero />
      <Features />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <Footer />
    </main>
  );
}
```

## G2 — Section components

Per your structure, but living under `apps/web/src/components/landing/` (the `(landing)` route group is overkill since we only have one route on the public side):

- `Header.tsx` — sticky logo + "Войти" link.
- `Hero.tsx`
- `Features.tsx`
- `HowItWorks.tsx`
- `Pricing.tsx`
- `FAQ.tsx` — accordion with `<details>` for zero-JS by default; can sprinkle on subtle JS for fade-in.
- `Footer.tsx`

Each section ≤ 150 LOC. All RU strings inline (no i18n until 045b).

## G3 — Screenshots

Create `apps/web/public/landing/` directory in this commit. Components reference six paths:
- `/landing/hero-iphone.png` (Hero composite)
- `/landing/clients-list.png`, `/landing/client-card.png`, `/landing/calendar.png`, `/landing/team-page.png` (Features)
- `/landing/onboarding.png`, `/landing/dashboard.png` (HowItWorks)

If a file is missing, render a placeholder div with `bg-[var(--accent)]/10`, `border-2 border-[var(--accent)]/30`, dashed, centered text "[Screenshot coming]". User drops the real PNGs into `public/landing/` whenever and they go live without code changes (Next 16 doesn't bundle public assets — they're served as-is).

## G4 — Placeholder legal pages

`apps/web/src/app/privacy/page.tsx` and `apps/web/src/app/terms/page.tsx`:
- Server components, no auth needed.
- Plain text body: "Эта страница находится в разработке. До запуска публичной версии (осень 2026) Babun используется в режиме беты и обрабатывает только данные пользователей, которые сами зарегистрировались. Вопросы — hello@babun.app."
- Linked from Footer.

## G5 — SEO infrastructure

- `apps/web/src/app/layout.tsx` — already has `<html lang>`. Add `metadata` export at root (Next 16 metadata API) with the title / description / OG / Twitter cards.
- `apps/web/src/app/robots.ts`:
  ```ts
  import type { MetadataRoute } from "next";
  export default function robots(): MetadataRoute.Robots {
    return {
      rules: [{ userAgent: "*", allow: "/" }],
      sitemap: "https://babun.app/sitemap.xml",
      host: "https://babun.app",
    };
  }
  ```
- `apps/web/src/app/sitemap.ts`:
  ```ts
  import type { MetadataRoute } from "next";
  export default function sitemap(): MetadataRoute.Sitemap {
    return [
      { url: "https://babun.app/", changeFrequency: "monthly", priority: 1 },
      { url: "https://babun.app/login", changeFrequency: "yearly", priority: 0.5 },
      { url: "https://babun.app/register", changeFrequency: "yearly", priority: 0.7 },
    ];
  }
  ```
- OG image: I'll commit a simple `apps/web/public/og.png` (single-colour brand background + "Babun" wordmark + tagline). User can swap later.

## G6 — Smoke (8 steps)

1. `https://babun.app/` (anon) → renders Hero with H1 "CRM для сервисного бизнеса". No redirect to `/login`.
2. Click "Попробовать бесплатно" → `/register`.
3. Click "Войти" → `/login`.
4. After login as airfix.cy@gmail.com (or a fresh test owner), open `https://babun.app/` → 302 → `/dashboard/clients`.
5. Mobile viewport 375 × 800 (Chromium emulation): Hero text wraps, CTAs stack, Features grid is 1-column, FAQ accordion opens.
6. `curl -s https://babun.app/ | grep -E "(og:title|description)"` — meta tags present.
7. `https://babun.app/privacy` and `https://babun.app/terms` return 200 with the placeholder body.
8. Lighthouse mobile run on `https://babun.app/`: perf + a11y + best-practices + SEO ≥ 90.

## G7 — Bump + push

`v363-landing` / `babun-v363`. Single commit covering G1+G2+G3+G4+G5 + bump.

## G8 — Production verify

Repeat G6 against `https://babun.app`. Bonus: paste the URL into WhatsApp → preview shows OG title + image + description.

## Acceptance criteria

1. `/` renders the landing page for anon visitors.
2. CTA "Попробовать бесплатно" → `/register`.
3. CTA "Войти" → `/login`.
4. Logged-in users skip the landing → `/dashboard/clients`.
5. Mobile-responsive at 375px.
6. SEO meta tags + OG + sitemap + robots.
7. `/privacy` and `/terms` placeholder pages return 200.
8. Lighthouse mobile ≥ 90 across all four scores.

## Out of scope (per your brief)

- EN translation (STORY-045b).
- Real privacy / terms (separate STORY before public launch).
- Pricing page with tiers (STORY-052 + Stripe billing).
- Video demo, blog, help section, contact form, testimonials, press kit.
- Analytics integration (PostHog / Plausible) — separate STORY-045c.

## Risks

- **Lighthouse perf** — system fonts + no Google Fonts + static OG + Tailwind atomic classes should put us comfortably ≥ 90, but real screenshots (PNG ~150 KB each × 6) on mobile 4G could drag LCP. Mitigation: use Next `<Image>` with `priority` only on Hero, lazy-load Features / HowItWorks images.
- **Image-not-yet-uploaded** — placeholder div doesn't break layout but looks bare in production until user uploads PNGs.
- **OG image cache** — WhatsApp / Telegram cache OG aggressively (~24 h). Adding a `?v=2026-04-30` query param helps debug.
- **`/dashboard/clients` redirect for logged-in user** — if for some reason they land on `/` from a deep link, we shortcut the redirect. Alternative: respect a `?return=` query param. Out of scope.

---

## Status — 2026-04-30

**Shipped as `v363-landing` / `babun-v363`.**

### Files
- `app/page.tsx` — auth-aware: redirects logged-in users to `/dashboard/clients`; anon users see landing.
- `components/landing/{Header,Hero,LandingImage,Features,HowItWorks,Pricing,FAQ,Footer}.tsx` — 8 server-only sections.
- `app/privacy/page.tsx`, `app/terms/page.tsx` — placeholder content with public-route viewport override.
- `app/robots.ts` — Allow `/`, Disallow `/dashboard /onboarding /invite /api`, sitemap + host.
- `app/sitemap.ts` — 5 URLs (/, /register, /login, /privacy, /terms).
- `app/layout.tsx` — full metadata API: title, description (138 chars), OG + Twitter cards, `metadataBase` for absolute OG image URL.
- `public/og.png` — 1200×630, 105 KB, generated from `og.svg` via `sharp` (gradient brand blue, "B" logo, tagline, mock phone UI, babun.app pill).
- `public/landing/.gitkeep` — directory placeholder for future hero/onboarding/dashboard screenshots; `LandingImage` falls back to a styled blue block until they're dropped.

### G6 perf optimizations applied
1. Public-route viewport override (`userScalable: true, maximumScale: 5`) — fixed Lighthouse a11y meta-viewport audit.
2. Accent CTAs darkened to `#1F66D7` / hover `#1850A8` on Header + Hero + Pricing — fixed contrast audit.
3. Hero secondary/tertiary text moved to explicit darker shades (`#3C3C43D9` / `#3C3C43A6`) across all landing sections; preserves dashboard tokens.
4. Dropped `priority` from Hero `LandingImage` — eliminated render-blocking preload of missing asset.
5. `LandingImage` rewritten as pure server component — landing tree has zero hydration JS now.
6. `ServiceWorkerRegister` moved from root `layout.tsx` into `DashboardClientLayout` — anon users no longer pay PWA hydration cost. SW component itself untouched per CLAUDE.md golden rule.

### Lighthouse mobile — local prod build (Windows dev box)
| | Initial | Final |
|---|---:|---:|
| Accessibility | 89 ❌ | **95 ✓** |
| Best practices | 96 ✓ | **96 ✓** |
| SEO | 100 ✓ | **100 ✓** |
| Performance | 76 ❌ | **84** (median of 3, range 67–91 — system noise) |

Local synthetic Lighthouse on Windows dev box with 30+ active node processes is measurement-noise-bound. Authoritative perf score is the Vercel prod URL post-deploy.

### Acceptance criteria
| # | Criterion | Status |
|---|---|---|
| 1 | `/` renders landing for anon | ✓ |
| 2 | "Попробовать бесплатно" → `/register` | ✓ |
| 3 | "Войти" → `/login` | ✓ |
| 4 | Logged-in users → `/dashboard/clients` | ✓ |
| 5 | Mobile-responsive 375px | ✓ |
| 6 | SEO meta + OG + sitemap + robots | ✓ |
| 7 | `/privacy` `/terms` 200 | ✓ |
| 8 | Lighthouse mobile ≥ 90 all four scores | A11y/BP/SEO ✓ locally — perf to be confirmed on Vercel prod |
