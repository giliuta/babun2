# Babun2 Architecture (current state)

> Snapshot of where we are now. This document reflects reality, not aspiration.
> When architecture changes, update this file in the same commit.

## High-level

Babun2 is a **single-tenant prototype** (AirFix) built as a **Turborepo monorepo** with a Next.js 16 web app. All state lives in `localStorage` via React Context providers. There is no backend yet — the plan is to migrate to Supabase in `STORY-001`.

```
┌─────────────────────────────────────────────────────┐
│                   Browser (PWA)                      │
│  ┌───────────────────────────────────────────────┐  │
│  │  Next.js 16 App Router                        │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  /dashboard (calendar)                  │  │  │
│  │  │  /dashboard/clients                     │  │  │
│  │  │  /dashboard/services                    │  │  │
│  │  │  /dashboard/schedule                    │  │  │
│  │  │  /dashboard/analytics                   │  │  │
│  │  │  /dashboard/sms-templates               │  │  │
│  │  │  /dashboard/income /expenses /reports   │  │  │
│  │  │  /dashboard/masters /teams              │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  │                                               │  │
│  │  Context providers (DashboardLayout):         │  │
│  │  Sidebar, Schedules, Masters, Teams,          │  │
│  │  Appointments, FormSettings, Services,        │  │
│  │  Clients, SmsTemplates, ExpenseCategories     │  │
│  │                                               │  │
│  │  State → localStorage keys:                   │  │
│  │  babun-appointments, babun-clients,           │  │
│  │  babun-services, babun-team-schedules, ...    │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  Service Worker (sw.js — prod only, dev auto-nuke)  │
└─────────────────────────────────────────────────────┘
                          │
                          │ (no backend yet)
                          ▼
                     ┌────────┐
                     │ Vercel │   ← static deploy of Next app
                     └────────┘
```

## Package layout

```
babun-crm/
├── apps/
│   ├── web/                                  # Next.js 16
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx                # Root layout — viewport, SW register
│   │   │   │   ├── page.tsx                  # Home redirect
│   │   │   │   ├── login/
│   │   │   │   ├── manifest.ts
│   │   │   │   └── dashboard/
│   │   │   │       ├── layout.tsx            # 10 context providers
│   │   │   │       ├── page.tsx              # Calendar + BUILD_TAG
│   │   │   │       ├── analytics/page.tsx
│   │   │   │       ├── appointment/[id]/
│   │   │   │       ├── appointment/new/
│   │   │   │       ├── clients/page.tsx
│   │   │   │       ├── expenses/page.tsx
│   │   │   │       ├── income/page.tsx
│   │   │   │       ├── master-profile/
│   │   │   │       ├── masters/page.tsx
│   │   │   │       ├── reports/page.tsx
│   │   │   │       ├── schedule/page.tsx
│   │   │   │       ├── services/page.tsx
│   │   │   │       ├── settings/
│   │   │   │       ├── sms-templates/page.tsx
│   │   │   │       ├── teams/page.tsx
│   │   │   │       └── waitlist/page.tsx
│   │   │   ├── components/
│   │   │   │   ├── appointments/             # AppointmentForm, dialog
│   │   │   │   ├── calendar/                 # WeekView, DayColumn, Swipeable, TimeColumn, AppointmentBlock, MiniCalendar
│   │   │   │   ├── clients/                  # ClientCard, dialog
│   │   │   │   ├── layout/                   # Header, PageHeader, Sidebar
│   │   │   │   ├── master/
│   │   │   │   ├── pwa/                      # InstallPrompt, ServiceWorkerRegister
│   │   │   │   ├── finance/ reports/ settings/ waitlist/
│   │   │   ├── lib/
│   │   │   │   ├── appointments.ts           # Appointment type + color kinds + photos + payments
│   │   │   │   ├── clients.ts                # Client type + acquisition source + segmentation
│   │   │   │   ├── services.ts               # Service type + categories + material costs
│   │   │   │   ├── masters.ts                # Master + Team + permission groups
│   │   │   │   ├── schedule.ts               # Per-weekday TeamSchedule + breaks
│   │   │   │   ├── sms-templates.ts          # Templates with [Name] [Date] tokens
│   │   │   │   ├── expense-categories.ts
│   │   │   │   ├── mock-data.ts              # Seed data
│   │   │   │   ├── date-utils.ts
│   │   │   │   └── supabase.ts               # Client stub (not wired yet)
│   │   └── public/
│   │       ├── sw.js                         # CACHE_VERSION bump on UI changes
│   │       ├── manifest.webmanifest
│   │       └── icon.svg
│   └── mobile/                               # Planned Expo app (not built yet)
└── packages/
    └── shared/                               # Shared types (not populated yet)
```

## Data model (localStorage today)

Each entity is a TypeScript interface persisted to localStorage under a namespaced key. Every lib/ file exposes `load{X}()` / `save{X}()` helpers.

| Entity | File | Key | Notes |
|---|---|---|---|
| Appointment | `lib/appointments.ts` | `babun-appointments` | has `photos`, `kind`, `is_online_booking`, `payments[]`, `status` |
| Client | `lib/clients.ts` | `babun-clients` | has `acquisition_source`, `referred_by_client_id`, `tag_ids[]`, `discount`, `balance` |
| Service | `lib/services.ts` | `babun-services` | has `category_id`, `material_costs[]`, `color`, `available_weekdays[]` |
| Category | `lib/services.ts` | `babun-service-categories` | service grouping |
| Client tags | `lib/clients.ts` | `babun-client-tags` | VIP / Regular / New / Problem |
| Master | `lib/masters.ts` | `babun-masters` | grouped permissions (data/edit/sections) |
| Team | `lib/masters.ts` | `babun-teams` | brigade with region + color |
| TeamSchedule | `lib/schedule.ts` | `babun-team-schedules` | per-team base + per-weekday overrides with breaks |
| SmsTemplate | `lib/sms-templates.ts` | `babun-sms-templates` | kind + body with tokens |
| ExpenseCategory | `lib/expense-categories.ts` | `babun-expense-categories` | icon + color + name |

## Calendar architecture (deep-dive)

The calendar has been the most complex surface. Key decisions:

1. **Single shared vertical scroller** in `dashboard/page.tsx` wraps `TimeColumn` (outside swipe) + `SwipeableCalendar` (inside swipe). This is why hour labels stay aligned with day cells when zooming.

2. **SwipeableCalendar** renders 3 pages (`-1`, `0`, `+1`) in a track translated by `-width`. On swipe commit, `flushSync` advances parent state + recenters track atomically → no flicker.

3. **Zoom** is continuous 30–240px/hour via `hourHeight` state + `hourHeightRef`. Three input paths:
   - Mouse wheel with `ctrl`/`meta` (desktop)
   - Touch pinch (2-finger distance delta)
   - iOS `gesturestart/gesturechange/gestureend` (non-standard but only reliable pinch on Safari)
   - Listeners are on the scroller div, not document — because iOS gesture events don't bubble to document reliably.

4. **Drag-to-reschedule** uses `@dnd-kit/core`:
   - `MouseSensor` with 5px distance activation (desktop)
   - `TouchSensor` with 200ms delay + 8px tolerance (mobile, avoids conflict with swipe)
   - `DragEndEvent.delta.y` → snap to 15-minute steps
   - HTML5 DnD was replaced because it doesn't work on iOS touch.

5. **Colors** are computed in `getAppointmentColorKind` with priority: cancelled → event/personal → debt → completed → in_progress → past → online → incomplete → scheduled. Each maps to Tailwind classes in `COLOR_KIND_TAILWIND`.

6. **Day totals footer** is `position: sticky; bottom: 0` inside each DayColumn, shows income/material cost/profit for that date.

## PWA

- `sw.js` in `public/` with `CACHE_VERSION = "babun-v{N}"` — bump on every UI release
- `ServiceWorkerRegister.tsx` auto-detects dev mode (localhost/192.168/10.x hostname) and **unregisters any existing SW + nukes caches + reloads once**
- In prod: network-first for HTML, cache-first for static, periodic update checks every 60s + on visibility change
- `BUILD_TAG` constant in `dashboard/page.tsx` shows a small black pill in the bottom-left corner so you can visually confirm which version is live

## What's NOT yet in the code

- Supabase (planned STORY-001)
- Authentication (login page exists but doesn't auth)
- Multi-tenancy (single-tenant today, `tenant_id` column planned for every table)
- Stripe / payments (planned later)
- Tests (no test runner configured)
- Public online-booking page
- WhatsApp / Telegram / Instagram inbox
- Mobile app (Expo stub only)
- Route optimization + GPS
- CI (no GitHub Actions yet)
