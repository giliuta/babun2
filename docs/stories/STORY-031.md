# STORY-031 — Sprint 031: Telegram redesign (full app)

**Status:** planning → awaiting approval
**Branch:** `master` (фиксируем по фазам, каждая фаза = 1 коммит)
**Scope size:** XL (полная смена визуального языка)

---

## 1. Intent

Полностью перевести Babun2 с iOS-HIG языка (Sprint 029–030) на **Telegram-стиль**.
Сохраняем всё поведение, ломаем только внешний вид — токены, примитивы, chrome, каждый экран и модал.

### Темы
- **Light** — основная (тёмный текст на белых карточках поверх светло-серого фона, как в Telegram iOS 10+).
- **Dark** — вторая (чистый чёрный фон `#000`, графитовые карточки `#1C1C1E`).
- Переключение по `prefers-color-scheme` + `<html class="theme-dark">` override для ручного тоггла в Настройках (позднее).

### Accent
Telegram blue `#3E88F7` (светлая) / `#47A3FF` (тёмная). Pressed `#2D7BE5`. Красный destructive `#FF3B30`. Token уже на `#2AABEE` в globals.css — обновим на актуальный `#3E88F7` (более тёплый Telegram blue из новых версий).

### Tile palette (colored icon tiles рядом с ListRow)
- red `#F5483F`, orange `#F59E0B`, yellow `#F4C430`, green `#4CAF50`, mint `#10B981`, teal `#14B8A6`, cyan `#3EB8E5`, blue `#3E88F7`, indigo `#5E72E4`, purple `#9B59B6`, pink `#EC407A`, gray `#8E8E93`.

### Typography
Убираем HIG letter-spacing trick (−0.02em / −0.01em) — Telegram использует нейтральный трекинг. Шрифт: SF Pro → Inter fallback.

---

## 2. Non-goals

- **Не меняем** бизнес-логику, data-слой, lib/*, API routes.
- **Не трогаем** ServiceWorkerRegister.tsx (только bump CACHE_VERSION).
- **Не ломаем** iOS pinch-zoom на календаре (keep `userScalable: false`, gesture events).
- **Не переписываем** AppointmentSheet touch-logic — только стили.
- **Не добавляем** новые фичи под соусом редизайна.

---

## 3. Phased execution

Каждая фаза — 1 коммит, `npx tsc --noEmit` зелёный, bump `BUILD_TAG` + `CACHE_VERSION`, push в master.

### Phase 0 — Tokens (globals.css)
- Переписать `:root` под Telegram light:
  - `--surface-grouped: #EFEFF4` (фон экрана), `--surface-card: #FFFFFF`
  - `--separator: rgba(0,0,0,0.08)`
  - `--label: #000`, `--label-secondary: #8E8E93`
  - `--accent: #3E88F7`, `--accent-pressed: #2D7BE5`, `--accent-tint: rgba(62,136,247,0.12)`
  - `--radius-card: 10px`, `--radius-pill: 999px`, `--radius-sheet: 14px`
- Добавить Telegram dark palette в `@media (prefers-color-scheme: dark)` и `html.theme-dark`:
  - `--surface-grouped: #000000`, `--surface-card: #1C1C1E`, `--separator: rgba(255,255,255,0.08)`, `--label: #FFF`, `--label-secondary: #8E8E93`
- Добавить `--tile-*` палитру (12 цветов).
- Убрать HIG letter-spacing в body/h1-h3.
- Убрать/переработать `.glass-surface` под Telegram (плотнее, меньше блюра — Telegram редко использует blur).

### Phase 1 — Primitives (`components/ui/*`)
- **Button**: pill-shape (radius-pill), primary = filled accent + white text, secondary = fill-tertiary + label, destructive = red bg + white. Min-height 48px для primary, 36px для secondary.
- **Input**: вложенный fill `#F2F2F7` (light) / `#1C1C1E` (dark), rounded 10px, плейсхолдер grey.
- **ListGroup**: белая карточка, radius 10px, separator между строками 0.5px, left/right padding 16px.
- **ListRow**: slot для colored tile (28×28, radius 7px) + label + right accessory + chevron.
- **SectionHeader**: uppercase, 13px, tracking-wider, color `--label-secondary`, margin 16px 16px 6px.
- **SheetShell**: slide-up с radius-sheet 14px сверху, drag-handle, close-button справа (circle 32px grey).
- **ConfirmDialog**: центрированная карточка 280px wide, заголовок 17px semibold, сабтекст 13px, 2 кнопки снизу (разделитель hairline между ними).
- **Chip**: pill с fill-tertiary bg, accent text для selected.
- **IOSSwitch**: accent-on, gray-off (Telegram switch = accent, не iOS green).
- **SegmentedControl**: Telegram style — внешняя pill-обёртка, внутренний selected = белая (light) / graphite (dark) карточка с тенью.
- **UndoToast**: pill с тёмным фоном (Telegram toast) всегда тёмный независимо от темы.
- **Skeleton**: shimmer перекрасить под surface-card.

### Phase 2 — Chrome (`components/layout/*`)
- **BottomTabBar**: floating pill-row с 4–5 табами. Active tab — pill-shape fill-primary с accent icon + accent label; inactive — только icon + label grey. По скриншотам: закруглённая «шайба» снизу с отступами по краям, shadow-sheet снизу.
- **Header / PageHeader**: floating circle buttons (40px) слева/справа, centered bold title 17px. Убрать glass-blur — сплошной surface-card.
- **Sidebar**: list-group drawer с colored tiles, profile-header сверху (avatar + name + @username).
- **NowPill / TodayGlance / DaySummaryStrip**: перерисовать под rounded card с tile-иконкой.
- **CreateMenu**: bottom-sheet с colored tiles (вместо iOS list).
- **GlobalSearch**: grouped-list search bar (fill-tertiary pill input).
- **MorningBriefing / EndOfDayBanner**: карточка на surface-card с accent tile.

### Phase 3 — Auth + app-level
- `app/login/page.tsx` — крупная primary pill-кнопка, minimal form, accent-tinted bg-hero.
- `app/not-found.tsx` — centered card.
- `app/layout.tsx` + `app/manifest.ts` — `theme_color = #3E88F7`, fonts.
- `app/b/*` — клиентское бронирование, тот же стиль.
- `sw.js` — bump `babun-v215`.

### Phase 4 — Dashboard / Calendar
- `app/dashboard/page.tsx` — перерисовать шапку (city accent, today chip), убрать iOS underline, подогнать под Telegram.
- `components/calendar/*`:
  - `AppointmentBlock` — tile-like card с domain color left-bar + content, текст адаптируется под светлый/тёмный fill.
  - `WeekView`, `DayColumn`, `TimeColumn`, `TimeGrid`, `MonthView` — сетка на hairline separator, now-line accent.
  - `SwipeableCalendar` — не трогать touch-logic, только цвета.
  - `MiniCalendar`, `TodayChip`, `ActionMenuModal`, `CityPickerModal`, `ColorPickerModal`, `RepeatCopyModal`, `RescheduleSheet`, `SpecialScheduleModal`, `DayFinanceModal`.
- `components/appointment/*` (26 файлов): AppointmentSheet + все Block-и + Picker-ы + Popup-ы под Telegram sheet-style.

### Phase 5 — Clients
- `app/dashboard/clients/page.tsx` — grouped list клиентов с avatar tile, search sticky.
- `components/clients/*`: ClientPanel, CreateClientModal, ClientProfileView, ClientPicker.

### Phase 6 — Masters & Teams
- `app/dashboard/masters/page.tsx` + `MasterSheet`.
- `app/dashboard/teams/*`.
- `components/master/MasterProfileDialog`.

### Phase 7 — Services
- `app/dashboard/services/page.tsx` — grouped list услуг с иконкой-tile, цена справа.

### Phase 8 — Finances
- `app/dashboard/finances/*`, `income`, `close-day`, `analytics`, `recurring`.
- `components/finance/{ExpensesDialog, IncomeDialog, DayFinanceModal}`.
- `components/reports/ReportsDialog`.

### Phase 9 — Chats
- `app/dashboard/chats/page.tsx` — реальный Telegram-style chat list (как на референсе!): avatar 54px, name bold, preview grey, timestamp right, unread badge accent pill.

### Phase 10 — Settings + SMS templates
- `app/dashboard/settings/{booking, calendar, cities, company, import, page}.tsx` — каноничный Telegram «Настройки»: grouped list с colored tiles (звонилки — красный, данные — зелёный, оформление — голубой, язык — фиолетовый).
- `app/dashboard/sms-templates/*`.
- `components/settings/SettingsDialog`.

### Phase 11 — PWA, Waitlist, polish
- `components/pwa/InstallPrompt` — Telegram-style promo card.
- `components/waitlist/WaitlistDialog`.
- Финальный проход по всем `.tsx` которые использовали `bg-white`, `border-gray-*`, `text-gray-*` напрямую — заменить на token-классы.
- Full `npx tsc --noEmit` + `npx eslint src` зелёные.
- Финальный bump `BUILD_TAG = "v216-tg"`, `CACHE_VERSION = "babun-v216"`.
- `git push origin master`.

---

## 4. Visual reference (из скриншотов)

| Элемент | Telegram |
|--|--|
| Фон экрана | light: `#EFEFF4` / dark: `#000` |
| Карточка-группа | light: `#FFF` / dark: `#1C1C1E`, radius 10 |
| Separator внутри карточки | 0.5px `rgba(0,0,0,0.08)` / `rgba(255,255,255,0.08)`, inset 56px слева (под иконкой) |
| Section header | UPPERCASE 13px `#8E8E93`, 16px inset |
| Colored tile | 28×28 quadrant, radius 7, сплошной fill из палитры, icon white |
| Primary button | pill 48h, filled accent, white text 17semibold |
| Destructive row | red icon tile + red label |
| Header buttons | circle 40px, fill-primary bg, icon label |
| Bottom nav | floating pill, 4–5 табов, active = pill-fill с accent |
| Chat row | 54px avatar, bold name, grey preview, right timestamp + unread badge pill |
| Sheet | slide-up, radius 14 сверху, drag handle 36×4 |

---

## 5. Risk & rollback

- **Риск 1:** 150+ файлов под правку — легко пропустить местечко с hard-coded `bg-white` или `#111`. Митигация: финальный grep-audit по `phase 11` + ручной проход по каждому экрану.
- **Риск 2:** AppointmentSheet имеет тонкую touch-logic; стилистические правки могут сломать pointer-events. Митигация: не трогать handlers, только Tailwind classes.
- **Риск 3:** dark theme — много экранов никогда не тестировались в dark. Митигация: светлую выкатываем первой, dark — в конце как «bonus», fallback = свет.
- **Rollback:** каждая фаза = отдельный коммит, `git revert <sha>` откатывает 1 фазу независимо.

---

## 6. Acceptance

- [ ] Все 12 фаз замёрджены в master, Vercel deploy зелёный.
- [ ] `npx tsc --noEmit` без ошибок.
- [ ] Каждый экран под iPhone 375px выглядит как Telegram (light и dark).
- [ ] Кнопки pill-shape, tiles цветные, separator hairline, nav floating.
- [ ] Accent `#3E88F7` виден везде: primary buttons, active tab, links, toggles.
- [ ] `BUILD_TAG` bumped, `CACHE_VERSION = "babun-v216"`, PWA подхватывает новую версию.
- [ ] Ни одна бизнес-фича не сломалась — запись, финансы, клиенты, чаты работают как до редизайна.

---

## 7. Open questions (ответить до старта Phase 0)

1. **Ручной тоггл light/dark в Настройках** — сразу делаем, или оставляем на `prefers-color-scheme` на Sprint 031, а тоггл в 032?
2. **Bottom nav табы** — сколько? Сейчас: Календарь, Клиенты, Мастера, Услуги, Финансы (5). Telegram обычно 4. Оставляем 5 или режем до 4 + «ещё»?
3. **Accent на запись** — в календаре AppointmentBlock красится в domain-color (бригада/статус). Оставляем доменные цвета как есть, или переделываем под Telegram tile-палитру?
4. **Чаты** — реально делаем Telegram-style chat list (как в WhatsApp/Telegram приложении), или это просто «список бесед» в CRM-стиле?

Жду ответов — и запускаем Phase 0.
