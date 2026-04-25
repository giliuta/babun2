# STORY-035: React Native readiness — extract business logic into @babun/shared

- **Status:** planning
- **Date:** 2026-04-26
- **Owner:** architect → developer
- **Branch (when implementing):** `feature/STORY-035-rn-readiness`
- **Estimated scope:** ~50 lib/* files moved, ~30 imports rewritten in apps/web, ~73 lucide imports rewired, 1 storage abstraction introduced
- **Supersedes the prior placeholder:** STORY-034's "Open Questions" reserved STORY-035 for "chats-client-panel-refresh". That work is renumbered → **STORY-036**.

---

## 1. Цель

Перенести бизнес-логику (типы, селекторы, чистые утилиты, storage-биндинги по локальной модели) из `apps/web/src/lib/` в `babun-crm/packages/shared/` так, чтобы будущий `apps/mobile` (Expo / React Native) переиспользовал её без копипаста и без затаскивания DOM/Next-зависимостей.

Один-в-один поведение в web остаётся прежним. Никакой функциональной правки UI. Никаких миграций БД. Только перепаковка кода + storage abstraction + icon-shim.

## 2. Зачем сейчас

Каждая следующая user-story (chats-client-panel-refresh, finance-deep-dive, brigade-payroll-cycles) добавит новые `lib/*.ts` файлы. Если откладывать — мы **гарантированно** утопим в `apps/web/src/lib/` ещё 10–15 модулей за следующие 4–6 недель. Каждый такой модуль:

- захватывает `localStorage` через прямой `window.localStorage.*` вызов,
- импортирует `lucide-react` (когда у него вообще есть UI-связь, например в маппинге category → icon),
- скрепляется с другими `lib/*.ts` файлами относительными `./*` импортами.

В сумме это означает, что на момент когда мы реально захотим сделать `apps/mobile`, объём ручной работы вырастет с текущих ~50 файлов до ~70+. Лучше сделать переезд один раз сейчас, в одной большой story, чем перевозить по кусочкам в каждой следующей фиче.

Дополнительно — этот переезд **подсветит** все места, где UI-слой полагается на синхронный `loadX()` в `useState(() => loadX())`. Это ровно те места, которые сломаются при переходе на Supabase (STORY-001) и на AsyncStorage в RN. Чем раньше мы их зафиксируем — тем дешевле.

## 3. Архитектурное решение по `packages/shared/`

### Контекст конфликта

В `packages/shared/types/index.ts` уже лежит **Supabase-shape** модель (`Client { id, full_name, phone, phone2, sms_name, email, address, address_lat, address_lng, comment, balance, discount, source, created_at, updated_at }`), плюс finance-types в `packages/shared/types/finance.ts`. Эти типы — **планируемая будущая БД-схема** для STORY-001 (Supabase + RLS).

В `apps/web/src/lib/clients.ts` живёт **localStorage-shape** модель (`Client { id, full_name, phone, phones[], whatsapp_phone, telegram_username, instagram_username, balance, discount, comment, tag_ids[], acquisition_source, referred_by_client_id, first_contact_date, address, city, property_type, equipment[], language, locations[], notes[], pinned_at, reminder_at, blacklisted, created_at }`). Эти типы — **текущая working-модель**, по которой работает весь web-app.

Это два разных мира. Слияние сейчас = катастрофа: либо ломаем работающий web (если переписать UI под Supabase-shape), либо ломаем будущий план Supabase (если переписать shared-types под localStorage-shape). Story-035 не про слияние. Story-035 — про **переезд working-модели**.

### Альтернативы

**Вариант A — переименовать существующее → `shared-future` / `shared-db`, новое назвать `shared`.**
- Pro: «shared» остаётся главным именем, в нём — то, что реально используется сейчас.
- Con: ломает уже существующие импорты `@babun/shared` (если есть) и `tsconfig paths`. Создаёт два пакета вместо одного — больше конфигов в Turborepo. Запутывает: `shared-future` — это «уже не используется» или «ещё не используется»?

**Вариант B — sub-namespaces через subpath exports.**
- `@babun/shared/local/types` — текущая working-модель (Client со всеми полями).
- `@babun/shared/db/types` — будущая Supabase-shape (Client с phone2, source, …).
- Pro: один пакет, явное разделение по неймспейсам, легко импортируется.
- Con: требует `package.json` `exports` поля и/или tsconfig paths для каждого подпути. В TypeScript 5 + bundler resolution работает, но нужен явный `"exports"` блок.

**Вариант C (рекомендуется) — три неймспейса: `local`, `db`, `common`.**
- `@babun/shared/local/*` — всё, что относится к **текущей** localStorage-модели: типы, селекторы, storage-binders.
- `@babun/shared/db/*` — всё, что относится к **будущей** Supabase-модели: типы, supabase client (то, что уже лежит в `packages/shared/types/index.ts` + `lib/supabase.ts` + finance.ts).
- `@babun/shared/common/*` — общие enum-ы и утилиты, которые одинаковы в обеих моделях: `UserRole`, `MessageChannel`, `MessageDirection`, `PaymentMethod`, `pluralize`, `money`, `date-utils`, `colors`, `design-tokens`, `avatar-color`, `map-links`, `messenger-links`, `share-link`, `version`. Это «mostly pure» вещи без зависимостей от конкретной shape.
- Pro: явное трёхуровневое разделение, понятно куда что лежит. Когда STORY-001 Supabase запустится, мы будем иметь параллельно **обе** модели в shared, плюс адаптеры `local→db` в `@babun/shared/migrations/local-to-db.ts`. Постепенный cut-over.
- Con: три неймспейса = больше когнитивной нагрузки в первые недели. Нужна табличка «куда что» (она есть ниже в этом плане).

**→ Рекомендация: Вариант C.**

Обоснование: мы уже **сейчас** имеем оба мира физически в репозитории (working локалстораджевый в `apps/web`, заглушка Supabase в `packages/shared`). Variant C — единственный, который не требует ни сжатия одного мира под другой, ни выкидывания уже накопленной Supabase-shape. Плюс это естественная подготовка к STORY-001: когда Supabase включается, мы пишем `local-to-db` migrator один раз, а UI постепенно переводим с `@babun/shared/local/*` на `@babun/shared/db/*` по фичам.

### Финальная структура

```
babun-crm/packages/shared/
├── package.json                  # name: @babun/shared, exports map
├── tsconfig.json                 # composite: false, declaration: false, noEmit (как в apps/web)
├── src/
│   ├── index.ts                  # re-export common, local, db (но НЕ default)
│   ├── common/
│   │   ├── index.ts
│   │   ├── types/
│   │   │   ├── enums.ts          # UserRole, MessageChannel, PaymentMethod, NotificationKind
│   │   │   └── index.ts
│   │   ├── utils/
│   │   │   ├── money.ts          # ← from apps/web/src/lib/money.ts
│   │   │   ├── pluralize.ts      # ← from apps/web/src/lib/pluralize.ts
│   │   │   ├── date-utils.ts     # ← from apps/web/src/lib/date-utils.ts
│   │   │   ├── colors.ts         # ← from apps/web/src/lib/colors.ts
│   │   │   ├── avatar-color.ts   # ← from apps/web/src/lib/avatar-color.ts
│   │   │   ├── design-tokens.ts  # ← from apps/web/src/lib/design-tokens.ts
│   │   │   ├── map-links.ts      # ← from apps/web/src/lib/map-links.ts
│   │   │   ├── messenger-links.ts # ← from apps/web/src/lib/messenger-links.ts
│   │   │   ├── share-link.ts     # ← from apps/web/src/lib/share-link.ts
│   │   │   ├── event-presets.ts  # ← from apps/web/src/lib/event-presets.ts
│   │   │   ├── service-presets.ts # ← from apps/web/src/lib/service-presets.ts
│   │   │   ├── quick-replies.ts  # ← from apps/web/src/lib/quick-replies.ts
│   │   │   └── version.ts        # ← from apps/web/src/lib/version.ts
│   │   └── icons/
│   │       └── index.ts          # re-export of lucide-react (web), shim point for RN
│   ├── local/
│   │   ├── index.ts
│   │   ├── types/
│   │   │   ├── client.ts
│   │   │   ├── master.ts
│   │   │   ├── brigade.ts
│   │   │   ├── appointment.ts
│   │   │   ├── service.ts
│   │   │   ├── equipment.ts
│   │   │   ├── city.ts
│   │   │   ├── chat.ts
│   │   │   ├── payment.ts
│   │   │   ├── expense.ts
│   │   │   ├── reconciliation.ts
│   │   │   ├── waitlist.ts
│   │   │   ├── recurring.ts
│   │   │   ├── photo.ts
│   │   │   ├── schedule.ts
│   │   │   ├── calendar-settings.ts
│   │   │   ├── business-block.ts
│   │   │   ├── day-extras.ts
│   │   │   ├── day-cities.ts
│   │   │   ├── location-labels.ts
│   │   │   ├── sms-template.ts
│   │   │   ├── notification.ts
│   │   │   ├── payroll.ts
│   │   │   ├── brigade-permissions.ts
│   │   │   └── index.ts
│   │   ├── storage/
│   │   │   ├── clients-store.ts
│   │   │   ├── masters-store.ts
│   │   │   ├── brigades-store.ts
│   │   │   ├── appointments-store.ts
│   │   │   ├── services-store.ts
│   │   │   ├── equipment-store.ts
│   │   │   ├── cities-store.ts
│   │   │   ├── chats-store.ts
│   │   │   ├── payments-store.ts
│   │   │   ├── expenses-store.ts
│   │   │   ├── expense-categories-store.ts
│   │   │   ├── reconciliations-store.ts
│   │   │   ├── waitlist-store.ts
│   │   │   ├── recurring-store.ts
│   │   │   ├── photos-store.ts
│   │   │   ├── schedule-store.ts
│   │   │   ├── calendar-settings-store.ts
│   │   │   ├── business-blocks-store.ts
│   │   │   ├── day-extras-store.ts
│   │   │   ├── day-cities-store.ts
│   │   │   ├── location-labels-store.ts
│   │   │   ├── sms-templates-store.ts
│   │   │   ├── payroll-store.ts
│   │   │   └── index.ts
│   │   ├── selectors/
│   │   │   ├── client-stats.ts   # ← from apps/web/src/lib/client-stats.ts
│   │   │   ├── client-search.ts  # ← from apps/web/src/lib/client-search.ts
│   │   │   ├── avatars.ts        # ← from apps/web/src/lib/avatars.ts
│   │   │   └── index.ts
│   │   └── mock/
│   │       └── seed.ts           # ← from apps/web/src/lib/mock-data.ts
│   ├── db/
│   │   ├── index.ts
│   │   ├── types/
│   │   │   ├── index.ts          # ← current packages/shared/types/index.ts (Supabase-shape)
│   │   │   └── finance.ts        # ← current packages/shared/types/finance.ts
│   │   └── client/
│   │       └── supabase.ts       # ← current packages/shared/lib/supabase.ts
│   └── storage/                  # ← cross-cutting storage abstraction
│       ├── types.ts              # interface KVStorage
│       ├── web.ts                # localStorage-backed impl
│       ├── memory.ts             # in-memory impl (tests, RN dev)
│       ├── provider.ts           # singleton accessor + setStorage(...)
│       └── index.ts
└── (legacy roots get DELETED at the end of story:)
    ├── index.ts                  # gone
    ├── types/                    # moved into src/db/types/
    └── lib/                      # moved into src/db/client/
```

### Резолюция конфликта со существующим `packages/shared/types/`

1. Текущий `packages/shared/types/index.ts` (Supabase-shape) → **переезжает целиком** в `packages/shared/src/db/types/index.ts`. Никаких потерь.
2. Текущий `packages/shared/types/finance.ts` → **переезжает целиком** в `packages/shared/src/db/types/finance.ts`. Никаких потерь.
3. Текущий `packages/shared/lib/supabase.ts` → переезжает в `packages/shared/src/db/client/supabase.ts`.
4. `packages/shared/index.ts` (root re-export) → удаляется. Новая точка входа — `packages/shared/src/index.ts`.
5. Старые папки `packages/shared/types/` и `packages/shared/lib/` (на верхнем уровне) **удаляются** в самом конце story, после того как все импорты перешли на `@babun/shared/db/...`.

### `package.json` изменения

```json
{
  "name": "@babun/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".":         { "types": "./src/index.ts",            "default": "./src/index.ts" },
    "./common":  { "types": "./src/common/index.ts",     "default": "./src/common/index.ts" },
    "./common/*":{ "types": "./src/common/*.ts",         "default": "./src/common/*.ts" },
    "./local":   { "types": "./src/local/index.ts",      "default": "./src/local/index.ts" },
    "./local/*": { "types": "./src/local/*.ts",          "default": "./src/local/*.ts" },
    "./db":      { "types": "./src/db/index.ts",         "default": "./src/db/index.ts" },
    "./db/*":    { "types": "./src/db/*.ts",             "default": "./src/db/*.ts" },
    "./storage": { "types": "./src/storage/index.ts",    "default": "./src/storage/index.ts" },
    "./icons":   { "types": "./src/common/icons/index.ts","default": "./src/common/icons/index.ts" }
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "lucide-react": "^0.460.0"
  },
  "peerDependencies": {
    "react": ">=18"
  }
}
```

### `tsconfig.json` paths в `apps/web`

Текущее:
```json
"paths": {
  "@/*": ["./src/*"],
  "@babun/shared": ["../../packages/shared"],
  "@babun/shared/*": ["../../packages/shared/*"]
}
```

Новое (минимальное изменение — указать `src` как корень):
```json
"paths": {
  "@/*": ["./src/*"],
  "@babun/shared":           ["../../packages/shared/src"],
  "@babun/shared/common":    ["../../packages/shared/src/common"],
  "@babun/shared/common/*":  ["../../packages/shared/src/common/*"],
  "@babun/shared/local":     ["../../packages/shared/src/local"],
  "@babun/shared/local/*":   ["../../packages/shared/src/local/*"],
  "@babun/shared/db":        ["../../packages/shared/src/db"],
  "@babun/shared/db/*":      ["../../packages/shared/src/db/*"],
  "@babun/shared/storage":   ["../../packages/shared/src/storage"],
  "@babun/shared/icons":     ["../../packages/shared/src/common/icons"]
}
```

> Note: с `moduleResolution: "bundler"` в `tsconfig` Next.js сам поймёт `package.json` `exports`, но **explicit paths** в tsconfig — страховка для VSCode и `tsc --noEmit`.

## 4. Скоп

### In-scope
- Создать `packages/shared/src/{common,local,db,storage}` со всеми поддиректориями.
- Перенести 47 lib-файлов по категориям (см. таблицу в §6).
- Создать storage abstraction (см. §7).
- Создать icons re-export (см. §9).
- Переписать импорты в `apps/web/src/{app,components,lib}` (см. §8).
- Обновить `apps/web/tsconfig.json` paths.
- Обновить `apps/web/next.config.{js,mjs,ts}` `transpilePackages: ["@babun/shared"]` (если ещё нет).
- Удалить старые `packages/shared/index.ts`, `packages/shared/types/`, `packages/shared/lib/` после завершения миграции.
- `tsc --noEmit` зелёный, `eslint src` без новых ошибок.
- Bump `BUILD_TAG` + `CACHE_VERSION`.

### Out-of-scope
- Никаких миграций БД (это STORY-001).
- Никаких изменений UI/UX, ни одной фичи.
- Никаких изменений Service Worker (только `CACHE_VERSION` bump).
- `apps/mobile` создавать **не надо** — story только про подготовку shared.
- Тесты на shared **не пишем** (test runner ещё не выбран; добавим в STORY-040).
- WEB-ONLY модули (`haptics`, `notifications`, `useMediaQuery`, `supabase.ts` next-server, `migrations/*`) **остаются в apps/web/src/lib/**.

## 5. Категоризация всех 47 lib-файлов

Из брифа + перепроверка по glob (`babun-crm/apps/web/src/lib/*.ts`).

**PURE (13 файлов)** → `@babun/shared/common/utils/*`:
`avatar-color`, `colors`, `date-utils`, `design-tokens`, `event-presets`, `map-links`, `messenger-links`, `money`, `pluralize`, `quick-replies`, `service-presets`, `share-link`, `version`.

**STORAGE-BOUND (24 файла)** → `@babun/shared/local/{types,storage}/*`:
`appointments`, `brigades`, `brigade-permissions`, `business-blocks`, `calendar-settings`, `chats`, `cities`, `clients`, `day-cities`, `day-extras`, `equipment`, `expense-categories`, `expenses`, `location-labels`, `masters`, `payments`, `payroll`, `photos`, `reconciliations`, `recurring`, `schedule`, `services`, `sms-templates`, `waitlist`. Плюс `finance/*` (subdir, отдельная подпапка).

**DOMAIN SELECTORS (3 файла)** → `@babun/shared/local/selectors/*`:
`client-stats`, `client-search`, `avatars`.

**WEB-ONLY (5 файлов)** → **остаются в** `apps/web/src/lib/`:
`haptics` (Audio API + iOS toggle, `navigator.vibrate`), `notifications` (Web Notifications API), `supabase.ts` (`next/server`, не путать с будущим `db/client/supabase.ts`), `useMediaQuery` (`window.matchMedia`), `migrations/*` (запускается на startup из layout, тянет storage и DOM).

**MOCK/SEED (1 файл)** → `@babun/shared/local/mock/seed.ts`:
`mock-data`.

**Финансы (subdir)** → `@babun/shared/local/finance/*`:
`finance/*` — переезжает целиком как одна подпапка. Если внутри есть DOM — это редкий случай, разберёмся в G3.

## 6. План «файл → новый путь» (по группам коммитов)

### Группа G0 — каркас (1 коммит)

| Действие | Путь |
|---|---|
| create | `packages/shared/src/index.ts` (пока пустой re-export `./common`) |
| create | `packages/shared/src/common/index.ts` |
| create | `packages/shared/src/local/index.ts` |
| create | `packages/shared/src/db/index.ts` |
| create | `packages/shared/src/storage/index.ts` |
| update | `packages/shared/package.json` — добавить `exports` map, lucide-react в deps |
| update | `apps/web/tsconfig.json` paths |
| update | `apps/web/next.config.{ts}` — `transpilePackages: ["@babun/shared"]` (если ещё не) |

Validation: `npx tsc --noEmit` (apps/web) зелёный, ничего не сломалось т.к. старые пути ещё работают.

### Группа G1 — storage abstraction (1 коммит)

| Действие | Путь | Содержимое |
|---|---|---|
| create | `packages/shared/src/storage/types.ts` | `KVStorage` interface (sync + async) |
| create | `packages/shared/src/storage/web.ts` | `WebKVStorage` — обёртка над `localStorage` |
| create | `packages/shared/src/storage/memory.ts` | `MemoryKVStorage` — Map-based, для будущих тестов и RN-dev |
| create | `packages/shared/src/storage/provider.ts` | `getStorage()` + `setStorage(impl)` (singleton) |
| create | `packages/shared/src/storage/index.ts` | barrel |

См. §7 ниже про API.

### Группа G2 — PURE common (1 коммит)

Move 13 файлов из `apps/web/src/lib/` → `packages/shared/src/common/utils/`. Импорты внутри них (если они импортируют друг друга — например, `event-presets` может тянуть `colors`) — обновить на относительные `./*` пути в новой папке.

| From | To |
|---|---|
| `apps/web/src/lib/avatar-color.ts` | `packages/shared/src/common/utils/avatar-color.ts` |
| `apps/web/src/lib/colors.ts` | `packages/shared/src/common/utils/colors.ts` |
| `apps/web/src/lib/date-utils.ts` | `packages/shared/src/common/utils/date-utils.ts` |
| `apps/web/src/lib/design-tokens.ts` | `packages/shared/src/common/utils/design-tokens.ts` |
| `apps/web/src/lib/event-presets.ts` | `packages/shared/src/common/utils/event-presets.ts` |
| `apps/web/src/lib/map-links.ts` | `packages/shared/src/common/utils/map-links.ts` |
| `apps/web/src/lib/messenger-links.ts` | `packages/shared/src/common/utils/messenger-links.ts` |
| `apps/web/src/lib/money.ts` | `packages/shared/src/common/utils/money.ts` |
| `apps/web/src/lib/pluralize.ts` | `packages/shared/src/common/utils/pluralize.ts` |
| `apps/web/src/lib/quick-replies.ts` | `packages/shared/src/common/utils/quick-replies.ts` |
| `apps/web/src/lib/service-presets.ts` | `packages/shared/src/common/utils/service-presets.ts` |
| `apps/web/src/lib/share-link.ts` | `packages/shared/src/common/utils/share-link.ts` |
| `apps/web/src/lib/version.ts` | `packages/shared/src/common/utils/version.ts` |

После переезда — глобально rewrite импортов в `apps/web/src/{app,components,lib}`:

```
from "@/lib/money"            → from "@babun/shared/common/utils/money"
from "@/lib/pluralize"        → from "@babun/shared/common/utils/pluralize"
... и так для всех 13
```

Validation: `npx tsc --noEmit` зелёный.

### Группа G3 — STORAGE-BOUND типы + storage-binders (3–4 коммита)

Каждый storage-bound файл расщепляется надвое:

- `apps/web/src/lib/clients.ts` → split:
  - `packages/shared/src/local/types/client.ts` — только `interface Client`, `interface ClientNote`, `type Source`, и т.п. (без функций).
  - `packages/shared/src/local/storage/clients-store.ts` — `loadClients()`, `saveClients()`, `addClient()`, `updateClient()`, … все функции, переписанные под `getStorage()` API (см. §7).

И аналогично для остальных 23 файлов (см. полный список в §5 STORAGE-BOUND).

Дробление коммитов по **логическим блокам**, чтобы typecheck оставался зелёным после каждого:
- **G3a** (тяжёлые core — клиенты/мастера/бригады/услуги/город): clients, masters, brigades, brigade-permissions, services, equipment, cities.
- **G3b** (расписание/календарь/блоки): appointments, schedule, calendar-settings, business-blocks, day-extras, day-cities, location-labels, recurring.
- **G3c** (общение): chats, sms-templates, photos.
- **G3d** (финансы): payments, expenses, expense-categories, reconciliations, payroll, finance/* subdir, waitlist.

После каждого подкоммита — глобальный sed-pass импортов в `apps/web` для перевезённых файлов + `tsc --noEmit`.

### Группа G4 — domain selectors (1 коммит)

| From | To |
|---|---|
| `apps/web/src/lib/client-stats.ts` | `packages/shared/src/local/selectors/client-stats.ts` |
| `apps/web/src/lib/client-search.ts` | `packages/shared/src/local/selectors/client-search.ts` |
| `apps/web/src/lib/avatars.ts` | `packages/shared/src/local/selectors/avatars.ts` |
| `apps/web/src/lib/mock-data.ts` | `packages/shared/src/local/mock/seed.ts` |

Validation: `npx tsc --noEmit`.

### Группа G5 — Supabase-shape (db) переезд (1 коммит)

| From | To |
|---|---|
| `packages/shared/types/index.ts` | `packages/shared/src/db/types/index.ts` |
| `packages/shared/types/finance.ts` | `packages/shared/src/db/types/finance.ts` |
| `packages/shared/lib/supabase.ts` | `packages/shared/src/db/client/supabase.ts` |
| `packages/shared/index.ts` | DELETE |
| `packages/shared/types/` (legacy root) | DELETE after move |
| `packages/shared/lib/` (legacy root) | DELETE after move |

> Note: нужно проверить через grep, использует ли уже что-то в `apps/web` импорты `@babun/shared` (из старого корня). Если да — переписать их на `@babun/shared/db/types` или `@babun/shared/db/client/supabase`. Подозреваю, что текущий web-app **не использует** старый `@babun/shared` (т.к. модели несовместимы), но это надо проверить grep'ом перед удалением.

Validation: `npx tsc --noEmit` в apps/web.

### Группа G6 — icons shim (1 коммит)

`packages/shared/src/common/icons/index.ts`:
```ts
// Web build re-exports lucide-react as-is.
// In apps/mobile we will alias this module to lucide-react-native via Metro resolver.
export * from "lucide-react";
```

Затем глобальный sed-pass на 73 файла:
```
from "lucide-react"  →  from "@babun/shared/icons"
```

Validation: `npx tsc --noEmit`.

> Альтернатива: оставить `lucide-react` напрямую в web и **не** делать shim сейчас. Это снимает 73-файловый sed-pass из story. Минус — RN-port позже вынужден будет либо повторить эту замену, либо терпеть `lucide-react-native` под алиасом `lucide-react` в Metro (что хрупко). **Рекомендуется** делать shim сейчас одной операцией.

### Группа G7 — финал (1 коммит)

- Удалить пустые папки в `apps/web/src/lib/` (для уехавших файлов).
- Bump `BUILD_TAG` в `app/dashboard/page.tsx` (`v343-rn-readiness` или ближайший свободный — текущий v338).
- Bump `CACHE_VERSION` в `public/sw.js` (`babun-v343` или ближайший свободный).
- Финальный `npx tsc --noEmit` + `npx eslint src`.
- Push в `master`.

## 7. Storage abstraction

### API

```ts
// packages/shared/src/storage/types.ts

/**
 * Sync KV storage. Mirror of localStorage semantics.
 * Implemented synchronously on web (localStorage), and via MMKV in
 * a future RN port (sync API, no async wrapping needed for the
 * `useState(() => loadX())` pattern).
 */
export interface KVStorageSync {
  getRaw(key: string): string | null;
  setRaw(key: string, value: string): void;
  remove(key: string): void;
  list(prefix?: string): string[];
}

/**
 * Async KV storage. Future-proof API for RN AsyncStorage and remote KV.
 * New code SHOULD use this. apps/mobile will only implement this.
 */
export interface KVStorageAsync {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}

export interface KVStorage extends KVStorageSync, KVStorageAsync {}
```

### Web impl

```ts
// packages/shared/src/storage/web.ts
import type { KVStorage } from "./types";

export class WebKVStorage implements KVStorage {
  getRaw(key: string) { return typeof window === "undefined" ? null : window.localStorage.getItem(key); }
  setRaw(key: string, value: string) { if (typeof window !== "undefined") window.localStorage.setItem(key, value); }
  remove(key: string) { if (typeof window !== "undefined") window.localStorage.removeItem(key); }
  list(prefix = "") {
    if (typeof window === "undefined") return [];
    const out: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) out.push(k);
    }
    return out;
  }
  async get(k: string) { return this.getRaw(k); }
  async set(k: string, v: string) { this.setRaw(k, v); }
  // remove and list reused via the sync versions
}
```

### Provider

```ts
// packages/shared/src/storage/provider.ts
import type { KVStorage } from "./types";
import { WebKVStorage } from "./web";

let _storage: KVStorage = new WebKVStorage();
export function getStorage(): KVStorage { return _storage; }
export function setStorage(impl: KVStorage): void { _storage = impl; }
```

### Stores

Каждый `local/storage/X-store.ts` использует sync API:

```ts
// packages/shared/src/local/storage/clients-store.ts
import type { Client } from "../types/client";
import { getStorage } from "../../storage/provider";

const KEY = "babun:clients";

export function loadClients(): Client[] {
  const raw = getStorage().getRaw(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as Client[]; } catch { return []; }
}

export function saveClients(arr: Client[]): void {
  getStorage().setRaw(KEY, JSON.stringify(arr));
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("babun:clients-changed"));
}

export function addClient(c: Client): void { saveClients([...loadClients(), c]); }
// ... etc
```

> Важный момент про `dispatchEvent`: это web-only оповещение. В RN мы заменим его на event-emitter. Для сейчас — оставляем `if (typeof window !== "undefined")` guard в store, чтобы код не упал при импорте из non-DOM окружения. Альтернатива: вынести event bus в `@babun/shared/common/event-bus.ts` с web-impl и noop-impl. **Рекомендуется** оставить `typeof window` guard сейчас (минимум изменений), а event bus вынести в STORY-036+.

### Sync vs async — миграционный pattern

**Текущая проблема:** в `app/dashboard/layout.tsx`, в `app/dashboard/page.tsx`, в `EndOfDayBanner.tsx` и десятках провайдеров используется паттерн:
```tsx
const [clients, setClients] = useState<Client[]>(() => loadClients());
```
Это **синхронная** инициализация. AsyncStorage в RN не даст так сделать.

**Варианты:**

1. **Sync wrapper now, async migration later (РЕКОМЕНДУЕТСЯ).** Оставляем `loadClients()`/`saveClients()` синхронными в текущем web-коде. Они дёргают `getStorage().getRaw()`/`setRaw()`, которые на web синхронны (localStorage). В RN-port мы:
   - либо реализуем `KVStorageSync` через **MMKV** (`react-native-mmkv` — sync API для KV-стораджа, ограничение по размеру 32MB, для нашего объёма с головой),
   - либо переписываем все `useState(() => loadX())` на `useEffect(() => loadX().then(setX), [])` в RN-коде отдельно. Но это большая правка provider-tree, неприятная.
   - **MMKV** даёт нам выход: sync API, RN-friendly, никаких изменений в текущем web-коде.
2. **Async migration now.** Переписать **все** `useState(() => loadX())` callsites на async. Это ~30 мест, каждое — отдельный риск flicker'а (initial state → empty array → useEffect → real array). Слишком тяжело, делаем в отдельной story.
3. **Гибрид.** Новые модули в shared — async-first. Старые wrappers оставляем как есть. Два API параллельно.

**→ Рекомендуется вариант 1.** Sync API (`getRaw`/`setRaw`) + локальный contract: «localStorage на web, MMKV на RN». Async API в `KVStorageAsync` остаётся для будущих модулей (chat/messenger sync, photo upload и т.п.) и для будущей замены на Supabase.

## 8. Импорт-маппинг (sed-passes по группам)

После каждой группы — `npx tsc --noEmit`.

### G2 (PURE)
| Old | New |
|---|---|
| `from "@/lib/avatar-color"` | `from "@babun/shared/common/utils/avatar-color"` |
| `from "@/lib/colors"` | `from "@babun/shared/common/utils/colors"` |
| `from "@/lib/date-utils"` | `from "@babun/shared/common/utils/date-utils"` |
| `from "@/lib/design-tokens"` | `from "@babun/shared/common/utils/design-tokens"` |
| `from "@/lib/event-presets"` | `from "@babun/shared/common/utils/event-presets"` |
| `from "@/lib/map-links"` | `from "@babun/shared/common/utils/map-links"` |
| `from "@/lib/messenger-links"` | `from "@babun/shared/common/utils/messenger-links"` |
| `from "@/lib/money"` | `from "@babun/shared/common/utils/money"` |
| `from "@/lib/pluralize"` | `from "@babun/shared/common/utils/pluralize"` |
| `from "@/lib/quick-replies"` | `from "@babun/shared/common/utils/quick-replies"` |
| `from "@/lib/service-presets"` | `from "@babun/shared/common/utils/service-presets"` |
| `from "@/lib/share-link"` | `from "@babun/shared/common/utils/share-link"` |
| `from "@/lib/version"` | `from "@babun/shared/common/utils/version"` |

### G3 (STORAGE-BOUND, по подгруппам)
| Old | New |
|---|---|
| `from "@/lib/clients"` (типы) | `from "@babun/shared/local/types/client"` |
| `from "@/lib/clients"` (store fns) | `from "@babun/shared/local/storage/clients-store"` |
| `from "@/lib/masters"` | split → `local/types/master` + `local/storage/masters-store` |
| `from "@/lib/brigades"` | split |
| `from "@/lib/brigade-permissions"` | split |
| `from "@/lib/services"` | split |
| `from "@/lib/equipment"` | split |
| `from "@/lib/cities"` | split |
| `from "@/lib/appointments"` | split |
| `from "@/lib/schedule"` | split |
| `from "@/lib/calendar-settings"` | split |
| `from "@/lib/business-blocks"` | split |
| `from "@/lib/day-extras"` | split |
| `from "@/lib/day-cities"` | split |
| `from "@/lib/location-labels"` | split |
| `from "@/lib/recurring"` | split |
| `from "@/lib/chats"` | split |
| `from "@/lib/sms-templates"` | split |
| `from "@/lib/photos"` | split (DOM-проверить: см. §10) |
| `from "@/lib/payments"` | split |
| `from "@/lib/expenses"` | split |
| `from "@/lib/expense-categories"` | split |
| `from "@/lib/reconciliations"` | split |
| `from "@/lib/payroll"` | split |
| `from "@/lib/finance/..."` | `from "@babun/shared/local/finance/..."` |
| `from "@/lib/waitlist"` | split |

> Note: «split» означает что в большинстве файлов call-site импортирует **и** тип **и** функцию. После split нужно либо два импорта, либо barrel-файл. **Рекомендация:** в `packages/shared/src/local/index.ts` сделать barrel re-export типов + функций по доменам (`export * from "./types/client"`, `export * from "./storage/clients-store"`). Тогда call-site остаётся одним импортом: `from "@babun/shared/local"`. Это упрощает sed-pass.

### G4 (selectors)
| Old | New |
|---|---|
| `from "@/lib/client-stats"` | `from "@babun/shared/local/selectors/client-stats"` |
| `from "@/lib/client-search"` | `from "@babun/shared/local/selectors/client-search"` |
| `from "@/lib/avatars"` | `from "@babun/shared/local/selectors/avatars"` |
| `from "@/lib/mock-data"` | `from "@babun/shared/local/mock/seed"` |

### G6 (icons)
| Old | New |
|---|---|
| `from "lucide-react"` | `from "@babun/shared/icons"` |

73 файла, прямой sed-pass.

## 9. Иконки-обёртка

```ts
// packages/shared/src/common/icons/index.ts
// Single source of truth for icons across web + future RN.
// Web bundle: re-exports lucide-react.
// RN bundle (future): metro.config.js will alias this module to lucide-react-native,
// which exposes the SAME icon names as React Native components.
export * from "lucide-react";
```

`apps/web/next.config.ts` нужен `transpilePackages: ["@babun/shared"]` — иначе Next 16 не пропустит локальный workspace package через swc.

Side-effect замены 73 файлов: bundle size сейчас не вырастет (lucide-react tree-shake'ится по named imports; re-export `*` сохраняет это поведение в современных bundlers).

## 10. DOM audit — что переносим, что оставляем

Из брифа + перепроверка glob:

| Файл | DOM/web API | Решение |
|---|---|---|
| `lib/haptics.ts` | `navigator.vibrate`, `navigator.userAgent`, Audio API | **Остаётся в apps/web/src/lib/.** RN заменит на `expo-haptics`. В будущем — `@babun/shared/platform/haptics.ts` с web/RN адаптерами. Сейчас не делаем. |
| `lib/notifications.ts` | Web Notifications API (`Notification.requestPermission`, `new Notification(...)`) | **Остаётся.** RN заменит на `expo-notifications`. |
| `lib/useMediaQuery.ts` | `window.matchMedia` | **Остаётся.** RN использует `Dimensions.get('window')` — другая реализация. |
| `lib/supabase.ts` (web) | `next/server`, server client | **Остаётся** в apps/web. Не путать с future `@babun/shared/db/client/supabase.ts` — это разные клиенты (server vs universal). |
| `lib/migrations/*` | `localStorage` + ручной startup-flow в layout | **Остаётся** в apps/web. Внутри они используют storage; их можно переписать через `getStorage()` для чистоты — но это отдельный low-risk patch, не часть STORY-035. |
| `lib/photos.ts` | FileReader (бриф упоминает) — **проверить** | Если использует FileReader для upload preview — **остаётся** (FileReader = DOM). Если только хранит метаданные в localStorage — переезжает. **Действие developer'а:** прочитать файл, решить. Если split — types в `local/types/photo.ts`, store в `local/storage/photos-store.ts`, FileReader-обёртка остаётся в `apps/web/src/lib/photo-upload.ts`. |
| `hooks/useCalendarGestures.ts` | `document.addEventListener`, GestureEvent | **Остаётся в apps/web/src/hooks/.** Web-only по природе. RN использует `react-native-gesture-handler`. |
| `hooks/useFinanceData.ts` | без DOM, чистый React | **Можно переехать в shared/local/hooks/**, но React-hook tree shake'ится в любом приложении, так что необязательно. **Решение:** оставить пока в apps/web/src/hooks/. Hook'и React в shared — отдельная подгруппа, добавим в STORY-040 если понадобится. |
| `lib/finance/*` | Перепроверить на DOM | Из категоризации брифа — STORAGE. Проверить отдельно в G3d. Если внутри нет DOM — переезжает в `local/finance`. Если есть — split. |

Все остальные `window.*` / `document.*` / `navigator.*` callsite (33 файла из брифа) — это либо `window.localStorage` (попадает под §7 storage abstraction), либо `window.dispatchEvent("babun:*-changed")` (см. note в §7 про event-bus). Никаких других DOM-операций в `lib/` нет.

## 11. Acceptance criteria

- [ ] `babun-crm/packages/shared/src/{common,local,db,storage}/` существует с описанной структурой.
- [ ] `packages/shared/package.json` имеет `exports` map для всех 5 неймспейсов + `lucide-react` в deps.
- [ ] `packages/shared/index.ts`, `packages/shared/types/`, `packages/shared/lib/` (старые root-level) удалены.
- [ ] Все 13 PURE файлов переехали в `common/utils/`, удалены из `apps/web/src/lib/`.
- [ ] Все 24 STORAGE-BOUND файла расщеплены и переехали в `local/types/` + `local/storage/`, удалены из `apps/web/src/lib/`.
- [ ] Все 3 selector-файла переехали в `local/selectors/`.
- [ ] `mock-data.ts` переехал в `local/mock/seed.ts`.
- [ ] 5 WEB-ONLY файлов (`haptics`, `notifications`, `useMediaQuery`, `supabase.ts`, `migrations/*`) **остались** в `apps/web/src/lib/`.
- [ ] `packages/shared/src/storage/` имеет `KVStorage` interface + `WebKVStorage` + `MemoryKVStorage` + provider.
- [ ] `packages/shared/src/common/icons/index.ts` re-exports lucide-react.
- [ ] 73 файла переписаны с `from "lucide-react"` на `from "@babun/shared/icons"` (grep `from "lucide-react"` в `apps/web/src/` возвращает 0 результатов).
- [ ] `apps/web/tsconfig.json` paths обновлены под новые subpath'ы.
- [ ] `apps/web/next.config.ts` имеет `transpilePackages: ["@babun/shared"]`.
- [ ] `npx tsc --noEmit` в `apps/web` зелёный.
- [ ] `npx eslint src` в `apps/web` без новых ошибок (preexisting — допустимо).
- [ ] `BUILD_TAG` в `app/dashboard/page.tsx` bumped (`v343-rn-readiness`).
- [ ] `CACHE_VERSION` в `public/sw.js` bumped (`babun-v343`).
- [ ] PWA в браузере (после deploy) показывает новый BUILD_TAG.
- [ ] Smoke-test: открыть `/dashboard`, увидеть бригады/услуги/клиентов/расписание из localStorage. Создать новый appointment — он сохраняется. Перезагрузить — он там. Удалить — пропадает. (Поведение **должно остаться идентичным**.)
- [ ] Никаких RN-файлов **не создано**. `apps/mobile` не существует или не тронут.
- [ ] Story status обновлён в `docs/roadmap.md` → `done`.
- [ ] CLAUDE.md обновлен с golden rule #11 (новая бизнес-логика в `packages/shared/`).

## 12. Риски и mitigation

| # | Риск | Mitigation |
|---|---|---|
| R1 | 115 localStorage callsites — большая правка, ошибка может сломать persistence | После каждой подгруппы (G3a/G3b/G3c/G3d) — ручной smoke на `/dashboard`: загрузить страницу, увидеть ожидаемые данные. Pure mechanical replacement (sed) в этой story, никакой логики. |
| R2 | Существующая Supabase-схема в `packages/shared/types/` конфликтует с локальной | Решено вариантом C (§3): держим обе модели параллельно в `db/` и `local/`. Никакого слияния сейчас. |
| R3 | Sync API (`load/save`) vs async storage — providers ожидают sync init | Решено: `KVStorageSync` через localStorage (web) + MMKV (future RN). `useState(() => loadX())` остаётся работать без правок. Async API доступен для нового кода и Supabase-future. |
| R4 | `lib/migrations/*` работают на startup, перенос требует storage инжект | Mitigation: migrations **остаются в apps/web/src/lib/migrations/** в этой story. Они уже используют `localStorage` напрямую — менять их на `getStorage()` можно отдельным cosmetic patch'ем после G7. |
| R5 | 73 импорта lucide-react — большой sed-pass | Низкорисковый: re-export `*` в G6 сохраняет идентичную семантику, tree-shaking тоже сохраняется (named imports работают через `export *` в современных bundlers). Smoke-тест: открыть `/dashboard`, убедиться что иконки рисуются. |
| R6 | `tsc --noEmit` медленный (~90 секунд) | Не запускаем после **каждого** файла. Запускаем после каждой логической **группы** (G0..G7). Между ними развиваем «вслепую» через предсказуемый mechanical pattern. Если падает — откатываем последний sed. |
| R7 | sed-pass случайно тронет строку в комментарии или данных | Используем VSCode global replace с `Match Word` + `Match Case` + предпросмотром, не raw `sed -i`. Альтернатива: `ts-morph`-based codemod в G6. Для G2/G3/G4 хватит regex с word boundaries. |
| R8 | `dispatchEvent("babun:clients-changed")` в shared — DOM-вызов | Guarded `if (typeof window !== "undefined")` в каждом `*-store.ts`. Это позволяет shared импортироваться из RN без падения. Реальный event-bus в STORY-036+. |
| R9 | `transpilePackages` в Next 16 — может потребовать дополнительной конфигурации (см. AGENTS.md warning о breaking changes) | Перед началом G0 — прочитать `node_modules/next/dist/docs/` (как написано в AGENTS.md) о `transpilePackages` в Next 16. Если API изменился — учесть. |
| R10 | Импорт-циклы — `local/storage/*` импортирует `local/types/*`, и где-то наоборот | Правило: **types ничего не импортируют из storage**. Storage импортирует types. Selectors импортируют и то, и то. Если кто-то нарушит — tsc найдёт. |
| R11 | Существующие импорты `@babun/shared` уже могут быть в коде — sed их сломает | Перед G5: `grep -rn '@babun/shared' apps/web/src/` — собрать список, перенаправить на `@babun/shared/db/...`. Проверить вручную. |

## 13. НЕ трогать

- `babun-crm/apps/web/src/app/` (структура папок) — golden rule #1.
- `babun-crm/apps/web/src/components/ServiceWorkerRegister.tsx` — golden rule #4.
- `babun-crm/apps/web/public/sw.js` (только bump `CACHE_VERSION`).
- `babun-crm/apps/web/src/lib/migrations/` (остаются в apps/web в этой story).
- `babun-crm/apps/web/src/lib/haptics.ts`, `notifications.ts`, `useMediaQuery.ts`, `supabase.ts` — остаются.
- `babun-crm/apps/web/src/hooks/useCalendarGestures.ts` — остаётся в apps/web.
- iOS pinch-zoom код в `dashboard/page.tsx` (`userScalable`, `touchAction: "pan-y"`).
- `SwipeableCalendar` 2-finger guard.
- v323 edge-guards / v326 1px-nudge — не наш код.
- `SEED_KEY` / `MOCK_APPOINTMENTS` поведение (mock переезжает в shared, но **никаких** изменений в seed-логике).
- Supabase-shape типы — **переезжают, но не редактируются**.
- `package.json` в apps/web (только `transpilePackages` в next.config; зависимости не трогаем).
- legacy `ClientPanel.tsx` (1700 LOC) — STORY-036 переезд chats side-panel.
- Никаких новых features. Никаких UI-изменений.

## 14. Open questions для пользователя

1. **Vendoring `lucide-react` в `@babun/shared` deps** — это формально означает, что `packages/shared` зависит и от `@supabase/supabase-js`, и от `lucide-react`. То есть shared теряет статус «pure typings + pure utils» и становится «universal client lib». Это **OK** или хочешь icons вынести в отдельный `@babun/icons`?
2. **115 localStorage callsites: sed all-at-once или incremental?** Рекомендую all-at-once в одной ветке, по группам G3a–G3d с smoke-чеком после каждой. Альтернатива — incremental (новые модули в shared, старые трогаем по мере фич) — растягивает миграцию на месяцы и мы получаем смешанный код. Подтверди all-at-once?
3. **Async storage стратегия:** sync wrapper (через MMKV в future RN) — Вариант 1 в §7 — выбираем? Или хочешь сразу async-everywhere (Вариант 2, тяжёлый)?
4. **Разделение `shared/local` vs `shared/db`** — Вариант C в §3 — подтверждаешь? Альтернативы — A (rename existing) или B (без `common`).
5. **`packages/shared/src/local/index.ts` barrel** — делаем (упрощает sed-pass на edit-call-sites) или каждый импорт уточняет subpath (`local/types/client`, `local/storage/clients-store` отдельно)? Я рекомендую barrel.
6. **`lib/photos.ts`** — содержит ли FileReader или только метаданные? Developer должен прочитать на этапе G3c и решить split-pattern. Подтверждаешь делегирование решения developer'у?
7. **`apps/web/src/lib/finance/*` subdir** — переезжать как одна папка `local/finance/*` или раскладывать по `types/`/`storage/`/`selectors/`? Рекомендую сохранить subdir (меньше изменений, легче grep).
8. **BUILD_TAG для этой story** — `v343-rn-readiness` (брифом запрошен) подходит? Текущий live — `v338`, плана не должно нарушать.

---

## Приложение A — связанные документы

- `CLAUDE.md` — golden rules (§1, §3, §6, §7, §9 особо релевантны). Добавить #11.
- `babun-crm/apps/web/AGENTS.md` — Next 16 breaking changes warning (про `transpilePackages` в G0/R9).
- `docs/architecture.md` — нужно обновить «Shared types/utils» секцию после G7.
- `docs/coding-patterns.md` — добавить раздел «Storage abstraction usage» после G1.
- `docs/roadmap.md` — пометить STORY-035 как `done` после завершения, передвинуть chats-port на STORY-036.
- `docs/adr/` — **создать ADR-NNN: shared package layout (common/local/db/storage)** одновременно с этой story (отдельный коммит до G0). Without ADR — решение варианта C нигде не зафиксировано.

## Приложение B — последовательность developer'а (cheat-sheet)

```
G0  → каркас + tsconfig paths + transpilePackages           → tsc
G1  → storage abstraction (types/web/memory/provider)       → tsc
G2  → 13 PURE files → common/utils + sed imports            → tsc
G3a → clients/masters/brigades/services/equipment/cities    → tsc + smoke
G3b → appointments/schedule/calendar/blocks/recurring       → tsc + smoke
G3c → chats/sms/photos                                      → tsc + smoke
G3d → payments/expenses/reconciliations/payroll/finance/waitlist → tsc + smoke
G4  → 3 selectors + mock-data → local/selectors + local/mock → tsc
G5  → Supabase-shape → db/ + delete legacy roots            → tsc
G6  → icons shim + 73-file sed lucide-react                 → tsc + smoke (открыть /dashboard)
G7  → BUILD_TAG + CACHE_VERSION + cleanup + push            → tsc + eslint + push master
```

После G7: `git log --oneline -10` должен показать 9–10 коммитов, каждый по одной теме. Никаких «10 файлов в один коммит без связи».

---

**Stop here.** Жду апрува плана от пользователя перед хэндофф к `developer` агенту.
