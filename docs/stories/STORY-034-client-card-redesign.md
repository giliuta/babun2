# STORY-034 — Client card redesign

**Status:** planning
**Created:** 2026-04-26
**Owner:** architect → developer
**Branch (when implementing):** `feature/STORY-034`

---

## 1. Цель

Переключить `/dashboard/clients/[id]` с режима «форма редактирования» на режим «инструмент диспетчера»: главное вверху (адрес объекта + 4 кнопки коммуникации), детали — в свёрнутых карточках. Создание клиента вынести в отдельный минимальный экран `/dashboard/clients/new`. Бригадой эта карточка не используется — будущий `// TODO(roles)` гейт ставим, реализацию ролей оставляем под отдельную стори.

## 2. User scenarios

1. **Диспетчер принял звонок** — открыл карточку → видит адрес главного объекта и кнопку «Открыть в Картах» в hero без скролла.
2. **WhatsApp клиенту после визита** — тапнул кнопку WhatsApp; long-press → центр-popup с альтернативным номером (если у клиента отдельный whatsapp_phone).
3. **«Что мы про этого делали раньше?»** — История визитов раскрыта по умолчанию, не надо тапать таб «Активность».
4. **Заметка после звонка** — quick action «+ Заметка» сразу в hero, не надо листать до блока «Заметки».
5. **Создать клиента «по-быстрому»** — `/clients/new` показывает только Имя + Телефон (+357 default), кнопка «Создать» disabled пока пусто, никаких оранжевых баннеров.

## 3. Объём

### In-scope
- Полный редизайн страницы `/dashboard/clients/[id]` (заменяет текущий `ClientProfileView`).
- Новый sticky header c аватаром, тегами, главным объектом и бейджем следующей записи.
- 4 quick actions: Позвонить · WhatsApp · SMS · + Заметка (Чат и Записать удаляются).
- 7 collapsible cards: Объекты, История визитов (open), Финансы, Заметки, Контакты, Личное, Метаданные.
- Switcher объектов когда `client.locations.length > 1`.
- Отдельный минимальный экран `/dashboard/clients/new`.
- Заготовка `src/lib/business-blocks.ts` (тип + DEFAULT_BLOCK_ORDER, без UI настроек).
- Trash icon → в `…` меню, destructive подтверждение через `useConfirm()`.

### Out-of-scope
- Страница настроек блоков (только тип + дефолт сейчас, UI потом).
- Реализация ролей (только TODO-комменты).
- Изменения side-panel в `/dashboard/chats` — `ClientPanel` остаётся для этого сценария (см. §13 Risks).
- Inline-pane в `/dashboard/clients?id=...` — продолжает работать через текущий `ClientPanel` до отдельной стори по списку клиентов.
- Bottom sheet для long-press — нарушает `feedback_center_modals`. Используем существующий `ClientQuickActionsSheet.tsx` (центрированный popup).
- Миграции localStorage. Модель `Client` уже подходит.

## 4. Карта файлов

### Создаётся
- `babun-crm/apps/web/src/app/dashboard/clients/new/page.tsx` — route для quick-create.
- `babun-crm/apps/web/src/components/clients/ClientHeader.tsx` — sticky header (имя, теги, главный объект, бейдж next apt, switcher объектов).
- `babun-crm/apps/web/src/components/clients/ClientQuickActions.tsx` — 4 кнопки + long-press handler → `ClientQuickActionsSheet`.
- `babun-crm/apps/web/src/components/clients/ClientCard.tsx` — generic collapsible wrapper (header с chevron, body, persisted open-state по `block.id` в `localStorage`).
- `babun-crm/apps/web/src/components/clients/blocks/ObjectsBlock.tsx` — обёртка над существующим `LocationsSection`.
- `babun-crm/apps/web/src/components/clients/blocks/VisitsBlock.tsx` — timeline визитов (date / service / amount / status), data из `appointments.filter(client_id)` + `servicesById`.
- `babun-crm/apps/web/src/components/clients/blocks/FinanceBlock.tsx` — read-only LTV / последний платёж / долг (источник: `stats.totalSpent`, `stats.lastVisitDate`, `stats.debt`).
- `babun-crm/apps/web/src/components/clients/blocks/NotesBlock.tsx` — input сверху + timeline `client.notes`.
- `babun-crm/apps/web/src/components/clients/blocks/ContactsBlock.tsx` — телефоны + мессенджеры (выделить из ClientPanel `PhonesSection` + `MessengersSection`).
- `babun-crm/apps/web/src/components/clients/blocks/PersonalBlock.tsx` — Город (legacy `client.city`), ДР, Email, Язык.
- `babun-crm/apps/web/src/components/clients/blocks/MetaBlock.tsx` — Источник обращения (`acquisition_source`), Теги (`tag_ids`), `referred_by_client_id`, `created_at`.
- `babun-crm/apps/web/src/lib/business-blocks.ts` — `BlockConfig` type, `DEFAULT_BLOCK_ORDER`, helper `loadBlockConfig()`.

### Меняется
- `babun-crm/apps/web/src/app/dashboard/clients/[id]/page.tsx` — рендерит новый `ClientCardPage` компонент вместо текущего `ClientProfileView`.
- `babun-crm/apps/web/src/components/clients/ClientProfileView.tsx` — переименовываем в `ClientCardPage.tsx` (или создаём новый, старый удаляем после прохождения tsc). Использует `ClientHeader` + `ClientQuickActions` + map(blocks → ClientCard).
- `babun-crm/apps/web/src/app/dashboard/clients/page.tsx` — обновить навигацию (опционально, не блокирующее): тап по строке клиента → `router.push("/dashboard/clients/" + id)` вместо `selectedId` state. Если решаем оставить inline-pane на этой стори — никаких изменений, только список callsites обновляется в отдельной стори.
- `babun-crm/apps/web/src/app/dashboard/page.tsx` — bump `BUILD_TAG` (4 раза, по одному на группу коммитов).
- `babun-crm/apps/web/public/sw.js` — bump `CACHE_VERSION` (по разу на группу).

### Удаляется
- Tabs «Профиль / Активность» внутри клиентской карточки — вместе с `TabBtn` / `ActivityTab` / `ProfileForm` (но только в новом компоненте, `ClientPanel.tsx` оставляем для chats side-panel).
- Кнопки «Чат» и «Записать» из quick actions — только в новом hero.
- Trash icon в header — переносится в `…` меню как пункт «Удалить клиента».
- Оранжевый баннер «Имя и телефон обязательны» / «Заполни профиль ниже» (если найден в `CreateClientModal` или `[id]` — снять).

### Решение по `/dashboard/chats` side-panel
`ClientPanel.tsx` (1700 строк) **остаётся** для chats side-panel и legacy inline-pane. Новый `ClientCardPage` живёт только под route `/clients/[id]`. Переезд chats — отдельная стори (см. §13). Это позволяет не блокировать STORY-034 на регрессии в чатах.

## 5. Контракты компонентов

### `ClientHeader.tsx`
```ts
interface ClientHeaderProps {
  client: Client;
  stats: ClientStats;                  // из buildStats / statsMap
  activeLocationId: string;            // controlled
  onChangeLocation: (id: string) => void;
  onOpenMenu: () => void;              // … menu (Удалить, Поделиться, …)
  onBack: () => void;
}
```
Рендерит: back arrow · аватар · имя · status badges (`ClientStatusBadges`, использует `tag_ids.includes("tag-vip")`, `client.blacklisted`) · «… меню» · primary object строка с `MapPin` иконкой и кнопкой «Открыть в Картах» (вызывает `buildMapUrl("apple", ...)` на iOS, `buildMapUrl("google", ...)` иначе) · бейдж «📅 27 апр 14:00» из `stats.nextApt` (тап → `/dashboard?date={date}&apt={id}`) · switcher объектов когда `locations.length > 1` (chips или select).

### `ClientQuickActions.tsx`
```ts
interface ClientQuickActionsProps {
  client: Client;
  onAddNote: () => void;               // открывает inline-input в NotesBlock + раскрывает блок
}
```
Рендерит 2×2 grid: Позвонить (`telUrl`), WhatsApp (`whatsappUrl`), SMS (`sms:`), + Заметка. Long-press на любой кнопке → открывает `<ClientQuickActionsSheet client={client} onClose={...} />` (центр-popup, уже существует). Disabled state когда нет phone.

### `ClientCard.tsx`
```ts
interface ClientCardProps {
  id: string;                          // ключ для localStorage open-state
  title: string;
  badge?: React.ReactNode;             // "3", "·", и т.д.
  defaultOpen?: boolean;
  children: React.ReactNode;
}
```
Header c chevron, тап toggle. Open-state хранится в `localStorage` под `babun-block-open:{blockKind}` (глобальный per-kind, не per-client — см. §12 Risk 5). `defaultOpen` — фолбэк для первого открытия.

### Block-компоненты (одинаковая сигнатура)
```ts
interface BlockProps {
  client: Client;
  stats: ClientStats;
  appointments: Appointment[];         // только для VisitsBlock / FinanceBlock
  onUpdate: (next: Client) => void;    // для NotesBlock / ContactsBlock / PersonalBlock / MetaBlock
}
```
Каждый блок сам знает что ему нужно из props (TS unused-параметры допустимы — будем чистить в каждом блоке).

## 6. `BlockConfig` type

```ts
// src/lib/business-blocks.ts
export type BlockKind =
  | "objects"
  | "visits"
  | "finance"
  | "notes"
  | "contacts"
  | "personal"
  | "meta";

export interface BlockConfig {
  kind: BlockKind;
  title: string;                       // RU
  defaultOpen: boolean;
  /** TODO(roles): if "crew" → hide. */
  hiddenForRoles?: ReadonlyArray<"crew">;
}

export const DEFAULT_BLOCK_ORDER: ReadonlyArray<BlockConfig> = [
  { kind: "objects",  title: "Объекты",         defaultOpen: false }, // open if locations.length > 1 — handled in component
  { kind: "visits",   title: "История визитов", defaultOpen: true  },
  { kind: "finance",  title: "Финансы",         defaultOpen: false, hiddenForRoles: ["crew"] },
  { kind: "notes",    title: "Заметки",         defaultOpen: false },
  { kind: "contacts", title: "Контакты",        defaultOpen: false },
  { kind: "personal", title: "Личное",          defaultOpen: false },
  { kind: "meta",     title: "Метаданные",      defaultOpen: false, hiddenForRoles: ["crew"] },
];

export function loadBlockConfig(): ReadonlyArray<BlockConfig> {
  // v1: hardcoded. v2 (отдельная стори): merge с настройками тенанта из localStorage.
  return DEFAULT_BLOCK_ORDER;
}
```

`ClientCardPage` импортирует `loadBlockConfig()` и map-ит в JSX через switch по `kind`. Render блока обёрнут в `<ClientCard id={kind} ...>` для open-state persistence.

## 7. Маршруты

| Путь | Назначение |
|---|---|
| `/dashboard/clients` | Список (без изменений в этой стори) |
| `/dashboard/clients/new` | **новый** Quick-create экран |
| `/dashboard/clients/[id]` | Редизайн карточки (заменяет ClientProfileView) |

Навигация:
- Список → клиент: текущий поведение `?id=X` через inline-pane продолжает работать (`ClientPanel`). Параллельно добавляем кнопку «открыть полный профиль» / тап-навигацию на `/clients/[id]` — не обязательная часть STORY-034, можно отложить.
- Из чатов: `/dashboard/clients?id=X` (inline-pane) — без изменений.
- Из global search и финансов (`/dashboard/clients?id=X`) — без изменений в этой стори.
- «+ Создать клиента» в списке → `router.push("/dashboard/clients/new")`. После создания → `router.replace("/dashboard/clients/" + newId)`.

## 8. Migration / data

| Что | Решение |
|---|---|
| Миграция localStorage | **Не требуется.** Модель `Client` (`lib/clients.ts:110`) уже содержит `notes`, `birthday`, `created_at`, `locations`, `tag_ids`. |
| `Client.notes` | Тип `ClientNote { id, text, created_at }` (`lib/clients.ts:69-73`) — подходит. NotesBlock делает unshift нового объекта в массив. |
| Следующая запись | `stats.nextApt` из `buildStatsMap` (`lib/client-stats.ts:106-134`). Hero просто читает поле. |
| LTV / долг / последний визит | `stats.totalSpent`, `stats.debt`, `stats.lastVisitDate` — те же поля. |
| Open-state блоков | Новый ключ `localStorage`: `babun-block-open:{kind}` → `"1"|"0"`. Глобальный per-kind, не per-client (см. §12 Risk 5). |
| VIP/ЧС | Через `client.tag_ids.includes("tag-vip")` и `client.blacklisted` — никаких новых полей. |

## 9. План коммитов

Каждая группа = 1-3 коммита, отдельный `BUILD_TAG` + `CACHE_VERSION` bump.

### Group 1 — Header + Quick actions + удаление вкладок (v335)
**Файлы:**
- create `ClientHeader.tsx`
- create `ClientQuickActions.tsx`
- modify `app/dashboard/clients/[id]/page.tsx` — рендерит новый `ClientCardPage` со скелетом без блоков
- create `ClientCardPage.tsx` (или rename `ClientProfileView.tsx`) — sticky header + quick actions + plain `<div>Visits coming…</div>` placeholder
- bump `BUILD_TAG = "v335-card-header"`, `CACHE_VERSION = "babun-v335"`

**Diff size:** ~600 строк добавлено, ~300 удалено (старый header в ClientProfileView).

**Проверка:** `npx tsc --noEmit`, страница `/dashboard/clients/{id}` открывается, нет вкладок, hero виден, кнопки звонят.

### Group 2 — Objects + Visits + Finance blocks (v336)
**Файлы:**
- create `lib/business-blocks.ts`
- create `components/clients/ClientCard.tsx`
- create `components/clients/blocks/ObjectsBlock.tsx`, `VisitsBlock.tsx`, `FinanceBlock.tsx`
- modify `ClientCardPage.tsx` — подключает `loadBlockConfig()` и рендерит первые три блока
- bump `BUILD_TAG = "v336-card-blocks-1"`, `CACHE_VERSION` bump

**Diff size:** ~700 строк добавлено.

**Проверка:** History визитов раскрыта по умолчанию, switcher объектов работает, Finance показывает реальные `stats.*`.

### Group 3 — Notes + Contacts + Personal + Meta (v337)
**Файлы:**
- create `blocks/NotesBlock.tsx`, `ContactsBlock.tsx`, `PersonalBlock.tsx`, `MetaBlock.tsx`
- modify `ClientCardPage.tsx` — подключает оставшиеся блоки
- modify `ClientQuickActions.tsx` — `onAddNote` раскрывает NotesBlock + фокусит input (через ref + URL `#notes`)
- bump `BUILD_TAG = "v337-card-blocks-2"`, `CACHE_VERSION` bump

**Diff size:** ~600 строк добавлено.

**Проверка:** Заметки добавляются/удаляются, мессенджеры открываются по deep-link, теги togglе работают, Trash в `…` меню вызывает `useConfirm`.

### Group 4 — `/clients/new` экран (v338)
**Файлы:**
- create `app/dashboard/clients/new/page.tsx` — Имя (required, autoFocus), Телефон (default `+357 `), кнопка «+ Добавить объект» (опционально, открывает inline `LocationEditor`), кнопка «Создать» (disabled when name+phone empty), убрать оранжевые баннеры
- modify `app/dashboard/clients/page.tsx` — кнопка «+» в списке `router.push("/dashboard/clients/new")`
- bump `BUILD_TAG = "v338-clients-new"`, `CACHE_VERSION` bump
- `git push origin master`

**Diff size:** ~250 строк добавлено.

**Проверка:** `/clients/new` открывается, кнопка disabled пока пусто, после создания редирект на `/clients/{newId}`, никаких баннеров.

## 10. Acceptance criteria

- На `/dashboard/clients/[id]` нет вкладок «Профиль / Активность» — одна скроллируемая страница.
- Hero виден без скролла на iPhone 14 (375×812): аватар, имя, теги, primary location, кнопка «Открыть в Картах».
- Кнопка «Открыть в Картах» открывает Apple Maps на iOS (через `buildMapUrl("apple", ...)`) и Google Maps на Android/desktop.
- Если у клиента есть будущая запись — в hero показан бейдж «📅 27 апр 14:00»; тап ведёт в `/dashboard?date=...`.
- Switcher объектов появляется только когда `client.locations.length > 1`.
- Quick actions: 4 кнопки (Позвонить, WhatsApp, SMS, + Заметка). Long-press открывает `ClientQuickActionsSheet` (центр-popup).
- Кнопок «Чат» и «Записать» в quick actions нет.
- Блок «История визитов» раскрыт по умолчанию.
- Остальные блоки свёрнуты по умолчанию; их open-state переживает перезагрузку страницы.
- `…` меню содержит «Удалить клиента» с `useConfirm` подтверждением.
- `/dashboard/clients/new` рендерит только Имя + Телефон (+357 default). Кнопка «Создать» disabled пока name пустое.
- Никаких оранжевых баннеров на `/clients/new` или на `/clients/[id]`.
- `npx tsc --noEmit` зелёный, `npx eslint src` без новых ошибок.
- `BUILD_TAG` + `CACHE_VERSION` bumped в каждой группе.
- Side-panel в `/dashboard/chats` продолжает работать (regression test: открыть чат с привязанным клиентом, ClientPanel рендерится).

## 11. Open questions

1. **«Подробнее» в Финансы** — куда ведёт? Вариант A: `/dashboard/finances?client_id=X`. Вариант B: новая страница `/dashboard/clients/[id]/finances`. **Рекомендация архитектора:** A — переиспользуем существующую финансовую страницу с фильтром.
2. **Side-panel в чатах** — обновляем сейчас или отдельной стори? **Рекомендация:** отдельная стори (STORY-035-chats-client-panel-refresh). 1700-строчный `ClientPanel` остаётся untouched в STORY-034.
3. **Тап по строке в списке клиентов** — продолжаем `?id=X` (inline-pane) или сразу `router.push("/clients/[id]")`? Бриф намекает на новый route, но это требует обновить минимум 4 callsite. **Рекомендация:** этот рефакторинг выносим в STORY-036 (single-source navigation). Сейчас `/clients/[id]` доступен через прямую ссылку.
4. **Bottom sheet vs центр-popup для long-press** — бриф упоминает «bottom sheet с расширенными опциями», но `feedback_center_modals` обязывает центр. **Решение архитектора:** используем существующий центрированный `ClientQuickActionsSheet`.
5. **«+ Заметка» в quick actions** — раскрывает NotesBlock и автофокусит input, или открывает отдельный inline-popup? **Рекомендация:** раскрытие + autofocus (URL hash `#notes` + `useEffect` на mount).
6. **Email в блоке Личное** — модель `Client` имеет `email: string`. Подтвердить что это нужно (бриф ставит Email в Личное, OK).
7. **Дать ли `/clients/new` шаг «Добавить объект»?** Бриф говорит «опционально». **Рекомендация:** одна кнопка `+ Добавить объект` показывает раскрывающийся `LocationEditor` inline; пропуск разрешён.

## 12. Risks

### Risk 1 — `ClientPanel.tsx` (1700 строк) остаётся
- **Опасность:** двойное хранение логики карточки клиента (старая в ClientPanel, новая в ClientCardPage). Расхождение поведения в чатах vs `/clients/[id]`.
- **Митигация:** в STORY-035 заменить ClientPanel на новый компонент. До тех пор — короткий комментарий в шапке `ClientPanel.tsx`: `// LEGACY: see STORY-034. Used only by /chats side-panel until STORY-035 ports it.`
- **Откат:** удаление новых компонентов и rollback `[id]/page.tsx` к `ClientProfileView`.

### Risk 2 — Текущий `ClientProfileView.tsx` не тривиальный
- ~700 строк, уже использует `buildMapUrl`, `useClients`, `groupAppointmentsByLocation`. Полностью переписать = риск регрессий.
- **Митигация:** не удаляем сразу. Group 1 создаёт `ClientCardPage.tsx` рядом, switcher в `[id]/page.tsx` рендерит новый. Через 24-48 часов в проде — удаляем `ClientProfileView.tsx`.

### Risk 3 — Inline-pane в `/dashboard/clients?id=X`
- 4 callsite навигируют через `?id=X`. Если переключаемся на `/clients/[id]` сейчас — все надо обновить и ломаем длинные deeplink-и из чатов.
- **Митигация:** `?id=X` оставляем работать (inline-pane через `ClientPanel`). Прямой `/clients/[id]` — новый путь, доступный через будущий рефакторинг навигации.

### Risk 4 — iOS Safari Apple Maps
- `maps://` deep-link не работает в `<a href>` без user gesture, но `https://maps.apple.com/?q=...` работает. `buildMapUrl("apple", ...)` уже возвращает второй вариант. Подтвердить на физическом iPhone в Group 1.

### Risk 5 — localStorage open-state засоряет ключи
- 7 блоков × N клиентов = 6300+ ключей при 900 клиентах. Quota — нет, но мусор.
- **Митигация:** хранить один ключ на kind: `babun-block-open:{kind}` (без clientId) — глобальное состояние раскрытости блоков. Пользовательский выбор переживает между разными клиентами.

## 13. Не трогать

- `ServiceWorkerRegister.tsx` — dev/prod разрыв (CLAUDE.md Golden Rule #4).
- Swipe edge guards v328 в `SwipeableCalendar` — не наш файл.
- 1px nudge на календаре v326 — не наш файл.
- iOS pinch-zoom (`userScalable: false`, gesture events) — не наш файл.
- `MOCK_APPOINTMENTS` seed с `client_id: null` — `client-stats.ts` уже умеет fallback по имени, не ломаем.
- `app/dashboard/chats/page.tsx` — side-panel рендеринг ClientPanel не меняем.
- `lib/clients.ts` модель — никаких новых полей в этой стори.
- Существующий `ClientPanel.tsx` — не удалять и не редактировать.
- `BUILD_TAG` / `CACHE_VERSION` bump-ить ровно по разу на группу коммитов (всего 4), не на каждый файл.

---

**Stop here.** Жду апрува плана от пользователя перед хэндофф к `developer` агенту.
