# STORY-056 — Desktop adaptation (PWA → полноценный веб-CRM)

**Статус:** Phase 1–4 shipped (commit `feat(desktop): adaptive layout, calendar shortcuts, client preview dialog`)
**Ветка:** `claude/desktop-pwa-adaptation-MeJNy`
**Приоритет:** высокий — пользователь использует CRM на компе и многое не работает

## Итог первого захода (что реально вошло)

✅ **Phase 1 — layout shell**: `useIsDesktop` хук, скрытые на десктопе `InstallPrompt`, `IOSInstallPrompt`, `EnableNotificationsPrompt`, `SplashScreen`, `OfflineIndicator`, `EdgeGuard` (40 px swipe-back-strips на краях). Sidebar шириной 280→240 px на lg+ для совпадения с `main lg:ml-[240px]` (был зазор 40 px перекрытия), плюс `lg:border-r` вместо offscreen-shadow.

✅ **Phase 2 — модалы для десктопа**: `components/ui/Sheet.tsx` создан как универсальная оболочка (mobile fullscreen ↔ desktop centred modal с Esc + backdrop-click). Добавлено `lg:max-h-[720px]` в `SheetShell`, `AppointmentSheet`, `PersonalEventSheet` чтобы 92 vh не растягивался почти на весь 1080-px экран. Большинство `*Sheet` в кодовой базе уже были `max-w-lg` центральными модалами — массовая миграция не понадобилась.

✅ **Phase 3 — календарь под мышь и клавиатуру**:
- `SwipeableCalendar` на lg+ скипает touch-handlers и 3-page virtual track, рендерит только `renderPage(0)` в normal flow.
- В `Header` на lg+ появились явные кнопки `<` / `>` (prev/next period).
- В `dashboard/page.tsx` добавлен глобальный `keydown` listener: `←` `→` (prev/next), `T` (today), `1`/`2`/`3`/`4` (day/3days/week/month), `N` (новая запись). Игнорируется когда фокус во вводном поле.
- Mouse drag для appointment'ов уже работал через `@dnd-kit` с `MouseSensor` — это desktop-only так что оставлено как есть.

✅ **Phase 4 — клиенты**: на lg+ при клике на клиента вместо `router.push("/dashboard/clients/[id]")` открывается **большой центральный диалог** (`max-w-[820px]`, `min(85vh, 760px)`) с `ClientPanel` внутри. На мобиле сохранён старый push на `/[id]` (нужен для iOS back-gesture). Полноценный split-view (список слева, профиль справа без модала) **отложен в STORY-057** — `clients/page.tsx` 2110 строк и оборачивать его в split-flex рискованно одним заходом.

✅ **Версии**: `BUILD_VERSION` → `v460-desktop-phase1`, `CACHE_VERSION` (sw.js) → `babun-v460`.

## Сознательные сокращения / отложено в STORY-057

- ❌ **Полноценный split-view для clients** (список слева, профиль справа без backdrop). Сейчас вместо него preview-in-dialog. Нужна реструктуризация `clients/page.tsx` (вырвать PageHeader выше split, обернуть list в `lg:w-[440px]` колонку, добавить правую панель). Делать аккуратно отдельной story.
- ❌ **Глобальный desktop top-bar с Cmd+K, "+ Новая запись" и аватаром** — Sidebar и так несёт навигацию + есть `Cmd+K` через GlobalSearch (BottomTabBar, скрыт но keydown listener висит на window). Не критично, отложено.
- ❌ **Right-click context menu** для appointments. Long-press на appointments на мобиле работает через timer, на десктопе мышью long-press невозможен. Можно открыть контекстное меню через `onContextMenu`. Не критическое — на десктопе клик по записи открывает sheet, оттуда доступны все действия.
- ❌ **Tooltip-ы на иконки** на mouse hover. Полировка, отложено.
- ❌ **`?` помощник со списком шорткатов** — будет добавлен в STORY-057.
- ❌ **Migration существующих `*Sheet` на новый `<Sheet>` API** — большая часть уже центральные модалы, поэтому массовое переписывание не оправдано. Новый `<Sheet>` доступен для будущих компонентов.

## Что нужно проверить руками

1. На 1440×900 в Chrome: открыть `/dashboard` — нет `OfflineIndicator` пилюли наверху, нет `EdgeGuard` (можно навести мышь на самый край — клики по элементам у края должны работать). Sidebar 240 px и не перекрывает контент.
2. В календаре: нажать `←` → переход на предыдущую неделю; `→` следующая; `T` → сегодня; `1`/`2`/`3`/`4` → переключение видов; `N` → открывается форма новой записи; в textarea клавиши не должны page-flip календарь.
3. Кликнуть по клиенту на `/dashboard/clients` — открывается центральный диалог 820 px, не fullscreen. Esc закрывает. Backdrop-клик закрывает.
4. На мобиле (DevTools 390×844): всё работает как раньше — клик по клиенту → `/dashboard/clients/[id]` route, swipe в календаре, BottomTabBar виден, InstallPrompt по-прежнему появляется.

---

## Original plan (для истории)


---

## Цель

Перевести весь функционал, который сейчас работает на PWA (телефон), в полноценное веб-приложение для компьютера. Сохранить визуальный язык (iOS-стиль, Liquid Glass), но адаптировать макет, интеракции и формы под мышь + клавиатуру + большой экран.

## Что НЕ работает на десктопе сейчас (gap-аудит)

### Критические блокеры
1. **`SwipeableCalendar`** — переключение недели/дня работает только через `onTouchStart/Move/End` (`SwipeableCalendar.tsx:95–213`). На мыши через drag не свайпит — перехода между неделями нет. На десктопе нужны кнопки навигации (← →) и/или клавиши.
2. **Bottom sheets всегда fullscreen** — `AppointmentSheet`, `PersonalEventSheet`, `RescheduleSheet`, `ClientPicker`, `ServicePicker`, `RepeatCopyModal`, `SpecialScheduleModal`, `ColorPickerModal`, `CityPickerModal`, `ActionMenuModal`, `DayFinanceModal` — все полноэкранные. На 1920×1080 это выглядит как растянутая мобилка. Нужен `lg:` modal-вариант (центральный, ограниченная ширина, dark backdrop). Эталон уже есть — `CreateClientModal.tsx:92–93`.
3. **PWA-only UI рендерится на десктопе** — `InstallPrompt`, `IOSInstallPrompt`, `EnableNotificationsPrompt`, `SplashScreen`, `EdgeGuard` (40px swipe-back-блокеры) — не нужны на десктопе. Скрыть через `useMediaQuery('(min-width:1024px)')` или `lg:hidden` контейнер.
4. **Контент центрирован в одну колонку** — на 1440px+ пустые поля по бокам. Нет two-column layout для clients/finances/chats.

### Средние проблемы
5. **Header/PageHeader** — мобильный паттерн (back button, гамбургер меню). На десктопе при наличии Sidebar back-arrow часто избыточен.
6. **Touch-only жесты** в списках — `SwipeableRow` (свайп-на-удалить у клиента/записи). На десктопе нужен hover-actions или контекстное меню.
7. **Long-press handlers** — на десктопе не работают (нет touch). Нужен right-click fallback. Часть уже есть (`onContextMenu` в `BottomTabBar.tsx:192`) — нужно по всем местам пройти.
8. **iOS-specific touch logic в календаре** — pinch-zoom через JS, gestureend (см. `app/dashboard/page.tsx`). На десктопе можно отключить.
9. **`maximumScale: 1, userScalable: false`** в `app/layout.tsx` viewport — на десктопе не вредит, но лучше проверить, не блокирует ли Ctrl+± зум в браузере (он работает независимо).

### Мелкие
10. `BottomTabBar` имеет `lg:hidden` — рендерится правильно. Но `pb-[60px] lg:pb-0` paddings раскиданы по компонентам — есть риск что где-то осталось.
11. Кнопки FAB/«+» внизу справа — должны быть кнопкой в Sidebar или в Header на десктопе.
12. `Cmd+K` / `Ctrl+K` поиск уже есть (`BottomTabBar.tsx:51–60`) — но привязан к BottomTabBar, который скрыт на десктопе. Перенести в layout-level.

## Архитектура решения

### Подход: **adaptive responsive** через `useMediaQuery`
- НЕ создаём отдельный route `/desktop` — это удвоит код и поломает SSR.
- Используем существующий `useMediaQuery('(min-width: 1024px)')` (lib/useMediaQuery.ts) + Tailwind `lg:` классы.
- Breakpoint = 1024px (Tailwind `lg`). До этого — мобильный layout (как сейчас). После — десктопный.

### Новые/изменённые компоненты
```
src/
├── lib/
│   └── useIsDesktop.ts            ← NEW. Тонкая обёртка над useMediaQuery
├── hooks/
│   └── useKeyboardShortcuts.ts    ← NEW. Cmd+K, ←/→ для календаря, Esc для модалов
├── components/
│   ├── layout/
│   │   ├── DashboardClientLayout.tsx   ← скрыть PWA-prompts, EdgeGuard, BottomTabBar на desktop
│   │   ├── Sidebar.tsx                  ← всегда expanded на lg+, без overlay
│   │   ├── Header.tsx                   ← desktop top-bar с Cmd+K, профилем, FAB
│   │   ├── PageHeader.tsx               ← скрыть back-arrow на lg+
│   │   └── DesktopShell.tsx            ← NEW. Опционально — centered max-w container
│   ├── ui/
│   │   ├── Sheet.tsx                    ← NEW. Универсальный Sheet → Modal на lg+
│   │   └── Modal.tsx                    ← NEW. Центральный модал с backdrop + Esc
│   ├── calendar/
│   │   ├── SwipeableCalendar.tsx        ← добавить mouse drag (PointerEvents) + кнопки
│   │   └── WeekView.tsx                 ← кнопки prev/next недели на lg+
│   ├── appointment/
│   │   └── AppointmentSheet.tsx         ← обернуть в новый <Sheet>
│   ├── calendar/PersonalEventSheet.tsx  ← обернуть в <Sheet>
│   └── ... (все остальные sheets)
└── app/dashboard/page.tsx               ← клавиатурная навигация календаря
```

### Паттерн `<Sheet>` (главный helper)
Универсальный компонент:
- На мобиле — fullscreen bottom sheet с swipe-down-to-dismiss (как сейчас).
- На lg+ — центральный модал, ширина 480/640/720 px (через prop `size`), backdrop `bg-black/40`, animation fade+scale, закрытие по Esc и клику на backdrop.
- Сохраняет API существующих sheets, чтобы переезд был механическим.

### Клавиатурные шорткаты
- `Cmd/Ctrl + K` — глобальный поиск (есть)
- `Esc` — закрыть открытый sheet/modal (частично есть)
- `←` / `→` в календаре — предыдущая/следующая неделя (или день в Day-режиме)
- `T` — Today
- `1`/`2`/`3` — переключение Day/Week/Month view
- `N` — новая запись
- `?` — показать список шорткатов (helper sheet)

## План реализации (по фазам)

### Фаза 1 — Layout shell + скрытие PWA UI (S, ~2ч)
- [ ] `useIsDesktop` хук
- [ ] `DashboardClientLayout`: завернуть `InstallPrompt`, `IOSInstallPrompt`, `EnableNotificationsPrompt`, `SplashScreen`, `EdgeGuard`, `OfflineIndicator` в `lg:hidden` или условный render
- [ ] `BottomTabBar` уже скрыт через `lg:hidden` — проверить
- [ ] `Sidebar`: на lg+ всегда expanded, не overlay — уже есть (`lg:ml-[240px]`)
- [ ] `Header`: на lg+ показывать top-bar (логотип/tenant, поиск Cmd+K, кнопка «Создать», профиль)
- [ ] `PageHeader`: скрыть back-arrow на lg+ (`lg:hidden`)
- [ ] Bump `BUILD_TAG` + `CACHE_VERSION`

### Фаза 2 — Универсальный `<Sheet>` + миграция (M, ~6ч)
- [ ] Создать `components/ui/Sheet.tsx` (mobile bottom-sheet ↔ desktop modal)
- [ ] Создать `components/ui/Modal.tsx` (для случаев когда mobile тоже модал)
- [ ] Перевести по очереди (один коммит на каждый):
  - [ ] `AppointmentSheet`
  - [ ] `PersonalEventSheet`
  - [ ] `RescheduleSheet`
  - [ ] `ClientPicker`
  - [ ] `ServicePicker`
  - [ ] `RepeatCopyModal`
  - [ ] `SpecialScheduleModal`
  - [ ] `ColorPickerModal`
  - [ ] `CityPickerModal`
  - [ ] `ActionMenuModal`
  - [ ] `DayFinanceModal`
- [ ] Audit — все остальные `*Sheet`/`*Modal` файлы

### Фаза 3 — Календарь: mouse + клавиатура (M, ~4ч)
- [ ] `SwipeableCalendar`: добавить кнопки prev/next + клавиши `←`/`→` на lg+
  - сохранить touch-handlers для мобилы
  - на lg+ скрыть pinch-zoom JS (он мешает скролу мышью)
- [ ] `WeekView`: на lg+ показать колонки с большим запасом ширины (или fit-to-screen)
- [ ] `dashboard/page.tsx`: keyboard navigation (`useKeyboardShortcuts`)
- [ ] Появление дропа appointment'а через mouse drag — отдельная задача (если @dnd-kit уже есть — проверить)

### Фаза 4 — Списки + двухколоночные экраны (M, ~4ч)
- [ ] `dashboard/clients` — на lg+ split-view: слева список, справа профиль выбранного клиента (как Telegram desktop)
- [ ] `dashboard/chats` — уже использует `useMediaQuery` (есть split). Проверить
- [ ] `dashboard/finances` — на lg+ контент в `max-w-screen-xl` + dashboard cards в grid
- [ ] `dashboard/settings/*` — на lg+ left-nav (категории) + right-pane (содержимое)
- [ ] `SwipeableRow`: на lg+ заменить swipe на hover-actions (3 точки справа)

### Фаза 5 — Полировка (S, ~2ч)
- [ ] Глобальный help: `?` показывает шорткаты
- [ ] `<Header>` на lg+ — добавить «+ Новая запись» кнопку (заменяет FAB)
- [ ] Tooltip-ы на иконки (только на mouse hover)
- [ ] Right-click контекстное меню для appointments на десктопе
- [ ] Проверить все `onTouchStart` — где нет `onPointerDown`/onClick fallback, добавить

### Фаза 6 — Тесты + smoke (S, ~1ч)
- [ ] `npx tsc --noEmit` зелёный
- [ ] `npx eslint src` без новых ошибок
- [ ] Прогон по основным экранам в браузере (Chrome desktop 1440×900): календарь, клиент-профиль, создание записи, финансы, настройки
- [ ] Прогон в режиме телефона (DevTools 390×844) — убедиться что мобилка не сломана
- [ ] Bump `BUILD_TAG` + `CACHE_VERSION` финально

---

## Open вопросы / решения нужны от пользователя

1. **Breakpoint** — 1024px (Tailwind `lg`) ок? Или другой (например 1280px `xl`)?
2. **Sidebar поведение** — на lg+ всегда видимый (240px) — сейчас так. Делать collapsible (пиктограммами) на md? Или просто скрыть на mobile?
3. **Drag & drop appointment'ов мышью** — нужно? Или достаточно edit через клик-открыть-форма?
4. **Split-view для clients** — как Telegram (список слева, профиль справа)? Или модалка как сейчас?
5. **Какой phase начинаем первым?** — рекомендую 1+2 (получаем визуально нормальный десктоп) → 3 (календарь живой) → 4+5 (полировка).

---

## Чек-лист «готово»
- [ ] На 1440×900 в Chrome всё, что работает на мобиле, работает на десктопе мышью + клавой
- [ ] Все sheets выглядят как модалы, а не как растянутая мобилка
- [ ] Календарь свайпится / переключается через ← → клавишы или кнопки
- [ ] PWA-prompts не лезут на десктопе
- [ ] Sidebar постоянный, BottomTabBar скрыт
- [ ] Cmd+K работает, Esc закрывает модалы
- [ ] Мобильный UX не сломан
