# STORY-032 — Sprint 032: Old Money Telegram redesign

**Status:** in-progress
**Branch:** `master` (фиксируем по фазам, каждая фаза = 1 коммит, push)
**Scope:** XL — полная замена палитры и вычистка dark-mode-специфики. Структура Telegram-компонентов остаётся.

---

## 1. Intent

Sprint 031 дал Telegram-скелет (ListGroup, ListRow, SheetShell, BottomTabBar, pill buttons, colored tiles), но палитра — тот же голубой `#3E88F7` + белый/чёрный. На iPhone в dark-режиме это выглядит холодно и «как мессенджер», а не как CRM-инструмент для сервисного бизнеса.

Новая цель — **«Old Money» light**:
- Тёплые кремовые / бежевые фоны (cream, ivory, bone).
- Приглушённый Hermes-forest-green как primary accent.
- Dusty navy / burgundy / warm gold для semantic-слоя.
- Muted Old Money tiles вместо crayon-bright пометок.
- Свет — канонично. Dark — выключен (автоматический `prefers-color-scheme` уже снят в uncommitted diff, закоммитим).
- Шрифт — оставляем Inter/SF Pro. Никаких серифов в MVP.

## 2. Non-goals

- **Не меняем** бизнес-логику, data-слой, `lib/*`, API-роуты, seed-данные.
- **Не трогаем** `ServiceWorkerRegister.tsx` (только `CACHE_VERSION` bump).
- **Не ломаем** iOS pinch-zoom на календаре (`userScalable: false`, gesture events).
- **Не переписываем** touch-логику (drag-drop, swipe pages, long-press).
- **Не добавляем** новые фичи под соусом редизайна.
- **Не вводим** dark mode в этом спринте — он отдельная история.

## 3. Палитра — «Old Money» токены

### Surfaces
```css
--surface-grouped:          #F4EEE3  /* warm ivory, screen bg */
--surface-card:             #FBF7EC  /* cream paper, cards */
--surface-card-secondary:   #F0E9DB  /* slightly darker cream, zebra */
--surface-overlay:          rgba(40, 32, 22, 0.45)
--surface-nav-blur:         rgba(251, 247, 236, 0.88)
--surface-tint-accent:      rgba(45, 74, 61, 0.08)
```

### Text
```css
--label:                    #2A241D  /* warm charcoal, not pure black */
--label-secondary:          #86796A  /* warm taupe-gray */
--label-tertiary:           rgba(42, 32, 22, 0.45)
--label-quaternary:         rgba(42, 32, 22, 0.25)
--label-on-accent:          #FBF7EC
```

### Separators / fills
```css
--separator:                rgba(42, 32, 22, 0.09)
--separator-opaque:         #E2DACC
--fill-primary:             rgba(134, 118, 90, 0.16)
--fill-secondary:           rgba(134, 118, 90, 0.11)
--fill-tertiary:            rgba(134, 118, 90, 0.07)
--fill-quaternary:          rgba(134, 118, 90, 0.04)
```

### Accent — Hermes forest green
```css
--accent:                   #2D4A3D
--accent-pressed:           #1F3A2F
--accent-tint:              rgba(45, 74, 61, 0.10)
--accent-on:                #FBF7EC
```

### Semantic system
```css
--system-red:               #8C3F38  /* burgundy (destructive) */
--system-orange:            #B07A36  /* warm gold (warning) */
--system-yellow:            #C9A74B  /* mustard */
--system-green:             #5E7D5E  /* muted sage (positive) */
--system-mint:              #6D8C7F
--system-teal:              #517E7C
--system-cyan:              #5E8AA8
--system-blue:              #3F5A76  /* dusty navy (info) */
--system-indigo:            #4F5478
--system-purple:            #6B4B74  /* plum */
--system-pink:              #9A6277  /* dusty rose */
```

### Tiles — muted Old Money (для ListRow иконок-плиток)
```css
--tile-red:                 #A55A50
--tile-orange:              #B0814E
--tile-yellow:              #C9A860
--tile-green:               #6C8A68
--tile-mint:                #7CA08A
--tile-teal:                #6C8B89
--tile-cyan:                #6B87A0
--tile-blue:                #5D7A94
--tile-indigo:              #6A6E8D
--tile-purple:              #87688B
--tile-pink:                #A47888
--tile-gray:                #948A7C
```

### Shadows / radii
Радиусы оставляем как в Sprint 031 (`--radius-card: 10px`, `--radius-sheet: 14px`, `--radius-pill: 9999px`). Тени чуть теплее:
```css
--shadow-card:              0 0 0 0.5px rgba(42, 32, 22, 0.05), 0 1px 2px rgba(42, 32, 22, 0.04)
--shadow-sheet:             0 -6px 32px -12px rgba(42, 32, 22, 0.18)
--shadow-float:             0 10px 28px -14px rgba(42, 32, 22, 0.20)
```

## 4. Фазы (каждая = 1 коммит, `tsc --noEmit` зелёный, bump BUILD_TAG/CACHE_VERSION, push в master)

### Phase 0 — Tokens + kill dark auto
- `globals.css` полностью перезаписать под Old Money палитру выше.
- Убедиться, что `prefers-color-scheme: dark` удалён (уже в uncommitted diff).
- `html.theme-dark` оставляем как структурный hook, но значения **не заполняем** — dark-mode станет отдельной story.
- Bump: `BUILD_VERSION = "v227-oldmoney-tokens"`, `CACHE_VERSION = "babun-v227"`.
- Проверка: все экраны, использующие `var(--accent)` / `bg-surface-card` / `text-label` автоматически перекрашиваются.
- **Ожидаемый эффект:** легаси-компоненты с `bg-sky-*`, `bg-white`, `text-gray-*` НЕ меняются — это добиваем в Phases 1+.

### Phase 1 — Primitives (`components/ui/*`)
Перекрасить руками:
- `Button` — primary accent forest green + `--label-on-accent`, secondary fill-tertiary, destructive system-red, ghost label.
- `Input` — fill `--surface-card-secondary`, placeholder `--label-tertiary`.
- `ListGroup` / `ListRow` — `--surface-card`, 56px inset separator, tile-slot.
- `SectionHeader` — `--label-secondary` uppercase 13px tracking-wider.
- `SheetShell` — `--shadow-sheet`, radius 14px, drag-handle `--label-quaternary`.
- `ConfirmDialog` — Old Money серый overlay.
- `Chip` — fill-tertiary bg, accent text for selected.
- `IOSSwitch` — accent-on/off грейскейл.
- `SegmentedControl` — external pill fill-tertiary, inner selected `--surface-card` with shadow-card.
- `UndoToast` — dark независимо от темы (остаётся тёмная шайба — single source of truth).
- `Skeleton` — shimmer на `--surface-card-secondary`.

### Phase 2 — Chrome (`components/layout/*`)
- `BottomTabBar` — accent-tint pill на активном табе (forest green tint).
- `Header` / `PageHeader` — `--surface-card`, центрированный title 17px.
- `Sidebar` — grouped list с colored tiles, avatar сверху (деловой).
- `NowPill` / `DaySummaryStrip` / `EndOfDayBanner` / `MorningBriefing` — card `--surface-card`, accent tile.
- `GlobalSearch` — fill-tertiary pill input.
- `CreateMenu` — bottom-sheet с Old Money tiles.
- `InstallPrompt` — card-based, менее кричащий.

### Phase 3 — Auth + app-level
- `app/login/page.tsx` — большой accent pill button, минимализм, bg `--surface-grouped`.
- `app/not-found.tsx` — centered card на cream bg.
- `app/layout.tsx` — `theme_color = #2D4A3D` (forest green).
- `app/manifest.ts` — то же `theme_color`.
- `app/b/*` — booking page под Old Money.

### Phase 4 — Calendar
- `dashboard/page.tsx` header: «Апрель 2026» чистый, today-chip forest-green tint.
- `AppointmentBlock` — левый домен-бар forest/burgundy/navy/gold, cream fill, label 11px.
- `WeekView`, `DayColumn`, `TimeColumn`, `TimeGrid`, `MonthView` — hairline `--separator`, now-line `--accent`.
- `SwipeableCalendar` — touch-logic не трогаем, только фон.
- `MiniCalendar`, `TodayChip`, `ActionMenuModal`, `CityPickerModal`, `ColorPickerModal`, `RepeatCopyModal`, `RescheduleSheet`, `SpecialScheduleModal`, `DayFinanceModal`.
- Городские чипы — muted tile palette.
- **FAB `+` вернуть на мобилке** — `fixed bottom-[72px] right-4 w-14 h-14 rounded-full bg-[var(--accent)]` + safe-area.

### Phase 5 — Appointment sheet
Все `components/appointment/*` (26 файлов): Sheet + Blocks + Pickers + Popups под Old Money sheet-style. Цвет primary-кнопки «Сохранить» — accent.

### Phase 6 — Clients
- `clients/page.tsx` — grouped list, avatars tile-palette.
- `ClientPanel`, `CreateClientModal`, `ClientProfileView`, `ClientPicker` — cream cards.
- «Должен €300» — burgundy pill вместо красного.

### Phase 7 — Masters, Teams, Brigades
- Permission-matrix grouped list.
- Team cards с tile-palette brigade-цветами.
- Schedule grid.

### Phase 8 — Finances, Expenses, Reports, Payroll, CloseDay
- KPI grid — cream cards, tabular-nums.
- Pie-chart — Old Money palette (muted).
- `BrigadeTabs` общий компонент.

### Phase 9 — Chats
- **Убрать синий banner** в шапке.
- `PageHeader` единообразный с остальными.
- Channel chips — tile-palette (WhatsApp tile-green, Instagram tile-pink, Telegram tile-cyan, SMS tile-gray).
- Conversation list — cream cards.

### Phase 10 — Settings, Services, SMS templates, sub-settings
- Grouped list с colored tiles.
- SMS templates preview — cream bg.
- Services list — tile-palette категории.

### Phase 11 — Walkthrough + release
- Playwright walkthrough 390×844 по всем экранам.
- Lighthouse mobile — accessibility ≥ 92.
- UX_AUDIT update: пройтись по топ-20 старого аудита, отметить что закрылось.
- `BUILD_VERSION = "v237-oldmoney-release"`, `CACHE_VERSION = "babun-v237"`.
- Merge story status → done.

## 5. Риски и mitigation

| Риск | Mitigation |
|--|--|
| Легаси-компоненты с хардкод `bg-white`/`text-gray-*` после Phase 0 смотрятся «не в стиле» | Phases 1–10 добивают по зонам |
| `tsc` падает на непонятной ошибке после массового редактирования | Каждая фаза = 1 коммит + `tsc` перед коммитом |
| Пропустим хоть один компонент — тема «порвётся» на одном экране | Walkthrough в Phase 11 покрывает все 15+ экранов |
| Пользователь скажет «не тот зелёный» через 3 фазы | Phase 0 — сразу показать палитру и ждать ОК до Phase 1 |
| CACHE_VERSION не bump'нут — пользователь не увидит новое | Golden Rule #3 + release-captain agent в Phase 11 |

## 6. Agents

- `babun-design-system-keeper` — per-phase review токенов/z-index/spacing
- `babun-copy-keeper` — после Phases 2, 6, 9 (там больше всего copy меняется по ходу)
- `babun-mobile-ux-auditor` — Phase 4 и 11 (критичные surface'ы)
- `babun-release-captain` — Phase 11 (bump + push)

## 7. Acceptance

- [x] Всё в light теме, dark отключён.
- [x] Акцент = forest green `#2D4A3D`.
- [x] Surface = cream/ivory.
- [x] FAB `+` на мобилке есть.
- [x] Chats header единообразный с остальными.
- [x] Нет элементов с `bg-sky-*` / `bg-white` / `text-gray-9*` (кроме явных tabular-nums / `--label` deriv).
- [x] `npx tsc --noEmit` — 0 errors.
- [x] `npx eslint src` — 0 errors (по возможности, React-19 rules отдельным PR).
- [x] Lighthouse accessibility mobile ≥ 92.
