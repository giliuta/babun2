# Babun CRM

## Identity
CRM + скоро SaaS для сервисных бизнесов. Первый клиент — **AirFix** (кондиционеры, Кипр, 2 бригады, 903+ клиентов). В будущем продаём как платформу другим сервисам.

## Stack (LOCKED — не менять без явного запроса)
- **Framework:** Next.js **16** App Router + Turbopack (breaking changes vs 14 — см. `babun-crm/apps/web/AGENTS.md`)
- **Monorepo:** Turborepo (`babun-crm/apps/web`, `babun-crm/apps/mobile`, `babun-crm/packages/shared`)
- **Language:** TypeScript strict mode
- **Styling:** Tailwind CSS **v4** (не v3)
- **UI:** shadcn-style custom components (не устанавливаем npm-пакет)
- **DB сейчас:** localStorage (prototype phase)
- **DB планируется:** Supabase (PostgreSQL + RLS + Auth + Realtime) — см. `docs/stories/STORY-001`
- **Deploy:** Vercel (branch `master` → auto-deploy)
- **Repo:** github.com/giliuta/babun2 — branch **`master`** (не `main`)
- **PWA:** service worker `babun-v{N}`, auto-update через `ServiceWorkerRegister`

## Golden Rules (MUST — нарушение = откат)
1. **НИКОГДА** не удаляй и не перемещай `babun-crm/apps/web/src/app/`
2. **ВСЕГДА** `npx tsc --noEmit` после серии правок в одной фиче (не обязательно после каждого файла — наш tsc медленный)
3. **ВСЕГДА** bump `BUILD_TAG` в `app/dashboard/page.tsx` и `CACHE_VERSION` в `public/sw.js` при изменении UI — чтобы пользователь видел, что новая версия активна
4. **НИКОГДА** не трогай `ServiceWorkerRegister.tsx` без явного запроса — там тонкий dev/prod разрыв
5. **ВСЕГДА** пушь в `master` после завершения фичи (Vercel deploys from master)
6. **НИКОГДА** не используй `any` — если TypeScript ругается, разбирайся с типами, а не обходи
7. **Максимум 400 строк** на компонент — если больше, разбивай на sub-components
8. **RU в UI, EN в коде.** Переменные, функции, комментарии — только английский
9. **Один логический коммит = одно сообщение.** Не меняй 10 несвязанных файлов в один commit
10. **НИКОГДА** не ставь хуки в `.claude/settings.json` которые запускают `tsc` на каждую правку — это всё убьёт

## Architecture

```
Babun2/
├── CLAUDE.md                    # Этот файл (главные правила)
├── .claude/
│   ├── commands/                # /plan, /implement, /test, /review, /status, /debug, /setup
│   ├── agents/                  # architect, developer, tester, reviewer
│   └── settings.json            # Permissions (без тяжёлых hooks!)
├── docs/
│   ├── architecture.md          # Как устроен Babun2 сейчас
│   ├── coding-patterns.md       # Паттерны кода
│   ├── roadmap.md               # Что делаем дальше
│   ├── adr/                     # Architecture Decision Records
│   └── stories/                 # User stories (STORY-NNN.md)
├── babun-crm/                   # ← ЗДЕСЬ КОД
│   ├── apps/
│   │   ├── web/                 # Next.js 16 app
│   │   │   ├── src/app/         # App Router pages + API routes
│   │   │   ├── src/components/  # React components
│   │   │   ├── src/lib/         # appointments.ts, clients.ts, schedule.ts ...
│   │   │   ├── public/sw.js     # Service worker
│   │   │   └── AGENTS.md        # ⚠ Next 16 breaking-changes warning
│   │   └── mobile/              # (planned) React Native / Expo
│   └── packages/
│       └── shared/              # Shared types/utils
├── supabase/                    # (planned) migrations
└── .reference/                  # Код-шпаргалки (gitignored)
    ├── nextcrm/                 # Reference CRM паттерны
    ├── calcom/                  # Availability engine
    └── monica/                  # Contact data model
```

## Workflow — Plan-then-Code

### Фаза 1: Планирование (ОБЯЗАТЕЛЬНО перед кодом)
1. Прочитай `docs/architecture.md` и `docs/coding-patterns.md`
2. Прочитай актуальный `docs/roadmap.md`
3. Создай `docs/stories/STORY-NNN.md` через `/plan {feature}`
4. **НЕ ПИШИ КОД пока план не записан.** Показываем план — ждём «ок».

### Фаза 2: Реализация
1. Если фича > 5 файлов — создай ветку `feature/STORY-NNN`
2. Порядок: **миграции → types → lib → API → components → UI**
3. `npx tsc --noEmit` после основных изменений
4. Если меняешь UI: bump `BUILD_TAG` + `CACHE_VERSION`
5. Коммит по смыслу (не «10 файлов за раз если они не связаны»)
6. `git push origin master`

### Фаза 3: Верификация
1. `npx tsc --noEmit` зелёный
2. `npx eslint src` без новых ошибок
3. Проверить что Vercel deploy прошёл
4. Обновить статус story на `done`

## Context Management
- **Новая большая фича → новая сессия** с `/clear`
- Перед `/clear` — сохрани прогресс в соответствующую `STORY-NNN.md`
- При возврате к проекту: прочитай CLAUDE.md → docs/roadmap.md → текущую STORY → `git log --oneline -5`

## Critical Known Issues
- **iOS Safari pinch-zoom** на календаре работает только с `userScalable: false` + gesture events (см. `app/dashboard/page.tsx`). НЕ возвращай `userScalable: true`, иначе zoom на календаре сломается.
- **`touchAction: "pan-y"`** на outer scroller нужен для forwarding pinch в JS. Не меняй на `none` или `auto`.
- **`SwipeableCalendar`** имеет собственный touch-handler, отменяющий swipe при 2+ пальцах — не удаляй этот guard.
- **Seed appointments** из `MOCK_APPOINTMENTS` имеют `client_id: null` — клиентские имена хранятся в `comment` как fallback. AppointmentBlock это учитывает.

## Commands (см. `.claude/commands/`)
- `/plan {feature}` — план новой фичи → `docs/stories/STORY-NNN.md`
- `/implement {story-id}` — реализация story по плану
- `/test` — `tsc + eslint` (тестов пока нет)
- `/review` — анализ `git diff master`
- `/status` — dashboard состояния проекта
- `/debug {описание}` — диагностика бага
- `/setup` — проверка окружения

## Agents (см. `.claude/agents/`)
- **architect** (opus) — архитектурные решения, ADR, без кода
- **developer** (sonnet) — реализация по story, один коммит = одна причина
- **tester** (sonnet) — напишет тесты (когда добавим test runner)
- **reviewer** (opus) — code review через git diff

## Dev Workflow Tools
- `npm run dev` (из apps/web) → localhost:3001
- `npm run dev:lan` → http://192.168.X.X:3001 (проверь LAN IP через ipconfig на ноуте)
- Stagewise toolbar активен в dev — кликай по элементам чтобы получить контекст
- Chrome DevTools MCP добавлен — используй mcp__chrome-devtools__* tools когда нужно проинспектировать рантайм

## Quick Reference
```bash
# Dev
cd babun-crm/apps/web && npm run dev       # localhost:3001 (3000 часто занят)

# Typecheck (из babun-crm/apps/web)
npx tsc --noEmit

# Lint
npx eslint src

# Git (всегда master)
git push origin master

# Bump versions при UI changes
# 1. apps/web/public/sw.js → CACHE_VERSION = "babun-v{N+1}"
# 2. apps/web/src/app/dashboard/page.tsx → BUILD_TAG = "v{N+1}-{feature}"
```
