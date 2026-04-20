# Babun CRM — Полный UX-прогон на prod (mobile 390×844)

**Дата:** 2026-04-20
**Деплой:** https://babun2.vercel.app (v188-perf)
**Окружение:** iPhone 14 viewport 390×844, chrome-devtools + Claude in Chrome MCP
**Метод:** нажатие на каждую страницу + 3 параллельных агента по разрезам UX / дизайн / баги

---

## 🎬 Что сделано

- **26 скриншотов** живого прода в мобильной раскладке (`docs/audit/walkthrough/01-*.png` → `25-*.png`)
- **3 параллельных агента-аудитора** проанализировали screens + source:
  - [REPORT-01-ux-psychology.md](REPORT-01-ux-psychology.md) — первые впечатления, когнитивная нагрузка, keep/cut/merge
  - [REPORT-02-design-system.md](REPORT-02-design-system.md) — типографика, цвет, карты, иконки, модалки
  - [REPORT-03-bugs-features.md](REPORT-03-bugs-features.md) — баги с file:line, недостающие flow
- **3 бага найдены во время клика** + **10 подтверждённых багов** из source review

---

## 🚨 P0 — трест-брейкеры (чиним первыми)

| # | Что | Где | Почему критично |
|---|---|---|---|
| **B1** | FAB → «Запись» меняет URL на `?new=1&kind=work`, но `AppointmentSheet` не открывается | [page.tsx:599-627](babun-crm/apps/web/src/app/dashboard/page.tsx) — `useEffect` деплы `[activeTeamId, router, clients]`, query-param не ретриггер | **Диспетчер на скутере нажимает «Запись» → ничего → жмёт ещё → паника → двойная запись.** Один случай = потеря доверия ко всему приложению |
| **B2** | Добавленная через localStorage запись на сегодня не отрисовалась на screen 25 | Скорее всего `team_id: null` не проходит фильтр по бригаде Y&D | Silent rendering failure — «пусто» вместо реальных данных. Хуже 500-страницы |
| **B3** | CityPicker открывается **снизу** (bottom-sheet), нарушает правило «все попапы по центру» (`feedback_center_modals.md`) | [CityPickerModal.tsx:63](babun-crm/apps/web/src/components/calendar/CityPickerModal.tsx) — `items-end` | Единственный bottom-sheet в приложении. Плюс тап на заголовок дня открывает выбор ГОРОДА — неинтуитивно |
| **B4** | `/dashboard/schedule` показывает «Сначала создайте бригаду», хотя бригады есть | [schedule/page.tsx:21](babun-crm/apps/web/src/app/dashboard/schedule/page.tsx) — lazy init `useState(activeTeams[0]?.id ?? "")` берёт пустой массив до гидратации | Мёртвая страница с ложным empty-state |
| **B5** | `Money.tsx` component при вызове `<Money cents={X} />` умножает на 100 (bug Sprint 011 воскрес в UI) | [Money.tsx:45](babun-crm/apps/web/src/components/ui/Money.tsx) — `formatEUR(cents)` вместо `formatEURFromCents(cents)` | Следующая адоптация Money = €45 000 вместо €450. Футгун на будущее |

---

## ⚠️ P1 — UX-дыры (слишком легко починить, чтоб не чинить)

| # | Находка | Screen | Решение |
|---|---|---|---|
| U1 | **Нет ответа на «что сейчас»** на главном. Пустой grid выглядит как «загружается» | [01-dashboard-week.png](docs/audit/walkthrough/01-dashboard-week.png) | Закрепить сверху `TodayGlance`: `Сегодня · 14:30 Анастасия · Пафос · €50 · 18 мин до выезда` |
| U2 | **«Сколько я заработал сегодня?»** — нельзя узнать без мата с 30-днейный период | 08-finances | Отдельная карточка «Сегодня» в Финансах + та же строка в топ-bar dashboard |
| U3 | **14 `window.confirm`/`alert`/`prompt`** по всему app нарушают правило центрированных модалок | Multiple (см. REPORT-03 BUG #6) | Новый `<ConfirmDialog>` + `useConfirm()` hook; заменить все 14 сайтов |
| U4 | **3 экрана «бригад»**: `/brigades`, `/teams`, `/masters` с пересекающимися моделями. Есть предупреждение-баннер — доказательство, что модель сломана | [18-brigades](18-brigades.png) + [19-teams](19-teams.png) + [24-masters](24-masters.png) | Merge в один экран с табами Финансы / Мастера / Расписание |
| U5 | **Share-link** (Sprint 002) спрятан в `⋯` меню. Диспетчеры забывают что он существует | AppointmentSheet ⋯ menu | Прокинуть pill «Для клиента» рядом с телефоном в `AppointmentSheet` |
| U6 | **Back-кнопка** в Settings sub-pages (Cities, Company, Booking) ведёт на календарь, не в Settings menu | `PageHeader.tsx:34` + все sub-pages | Добавить `backHref?` prop, передать из всех settings/* |
| U7 | **Route-of-the-day** фильтрует `kind === "work"`, скрывая события — если на дне только lunch/break, маршрут пустой | [route/page.tsx:69](babun-crm/apps/web/src/app/dashboard/route/page.tsx) | Убрать фильтр или добавить «+ N событий скрыто» toggle |
| U8 | **Мобильный reschedule** невозможен. Код содержит комментарий «Users can still reorder records via the menu's Перенести запись» — но такого пункта в `ActionMenuModal` нет | page.tsx:650 + ActionMenuModal | Добавить «Перенести» в long-press menu → центрированный date/time picker |
| U9 | **Empty state на /recurring и /waitlist** визуально идентичны — пользователь не различает смысл | 12-recurring + 13-waitlist | Merge в `/dashboard/inbox` с табами |
| U10 | **Валидация company-settings** отсутствует: abc сохраняется в поле VAT без предупреждения | 16-settings-company | `validateCompany()` + inline errors |

---

## 🎨 P2 — Дизайн-долг (не блокер, но стыдно)

| # | Находка | Scale | Решение |
|---|---|---|---|
| D1 | **732 произвольных `text-[Xpx]`** в 84 файлах, 5 разных размеров для «заголовка страницы» | Типографика | Primitive `<Text variant="display|title|h1|h2|body|label|caption" />` + codemod топ-17 файлов |
| D2 | **`<Money>` component orphan** — импортируется ровно в 1 файле (сам себя) | Денежные суммы | Codemod 22 `formatEUR` сайтов на `<Money>` |
| D3 | **Card recipe drift**: `border border-gray-100 shadow-sm` в 9 страницах vs `ring-1 ring-slate-200` в 3 | Карточки | Завершить Sprint 012: тонкий `<Card>` wrapper + миграция 9 страниц |
| D4 | **text-gray-\*** (597 uses) vs **text-slate-\*** (256) | Цвет | Mechanical codemod gray→slate |
| D5 | **159 inline `<svg>`** в 57 файлах. Lucide только в 3 (BottomTabBar/Sidebar/CreateMenu) | Иконки | Миграция `/settings` emoji-ins + `/expenses` category emoji на lucide |
| D6 | **`<EmptyState>` orphan** — используется в 3 файлах, 5 других screens hand-rolled | Empty states | Переписать waitlist/expenses/payroll/schedule на `<EmptyState>` |
| D7 | **orange-\*** в `chats/page.tsx` (Без ответа pill) vs **amber-\*** в `ClientStatusDot` | Статусные цвета | `src/lib/tokens.ts` с `STATUS_TONES` |
| D8 | Stale `color: "emerald" \| "rose" \| "indigo"` union в reports с классом `text-violet-600` | Типы | reports/page.tsx:95 rename |
| D9 | **Tabular-nums** только через `<Money>`. Цифры в Reports/Payroll не выравниваются глифом | Выравнивание чисел | `font-variant-numeric: tabular-nums` в `<body>` (globals.css) |
| D10 | CityPicker + ActionMenu как bottom-sheet (см. B3) | Модалки | `items-end` → `items-center` в обоих |

---

## 🆕 Фичи которых не хватает (с психологией)

| # | Фича | Проблема без неё | Решение |
|---|---|---|---|
| F1 | **Утренний брифинг** (06:00–10:00 one-time) | Дима открывает app в 08:55 на скутере, узнаёт про 09:00 визит когда уже на неправильной дороге | Full-screen sheet: «Доброе утро · 5 записей · €680 план · 2 клиента ждут в чатах · первый выезд через 35 мин». Dismiss сохраняет flag `briefing:YYYY-MM-DD` |
| F2 | **Close-the-day flow** | `EndOfDayBanner` показывает «2 без оплаты» но нет способа «подписать день» — кассу не закрыть, записи без оплаты не закрыть пачкой | `/dashboard/close-day` route — snapshot дня, «Все выполнены», подтверждение кассы, `dayExtras.closed_at` |
| F3 | **Inbox (Recurring + Waitlist)** | Два одинаковых пустых экрана, пользователь не понимает разницу | `/dashboard/inbox` с табами «Напоминания · Лист ожидания · Все» |
| F4 | **Global search / ⌘K** | Вошёл номер телефона в любой экран — некуда вбить. Если звонит клиент которого нет в `/clients`, нельзя найти в чатах | `GlobalSearch.tsx` — реюзит `client-search.ts`, ищет по клиентам + записям + комментам + адресам. Long-press «Календарь» tab или ⌘K |
| F5 | **Today cash ticker** на топбаре всех страниц | Диспетчер открывает Финансы 20 раз в день ради одного числа | Тонкая полоска ⭕️ «+€240 сегодня» на header всех экранов кроме Финансов |
| F6 | **Tap number → drill-down** (аудит) | На /finances все числа display-only. Тап на €3 550 должен вести на список источников | Каждая сумма = tap → Reports с теми же фильтрами |
| F7 | **Маршрут дня как карта** | Сейчас placeholder. Диспетчер использует Google Maps + WhatsApp как shadow CRM | /route — реальная карта с пинами + ETA (требует геокод, L-сложность) |

---

## 📊 Экраны — keep / cut / merge verdict

### ✅ Keep & polish (хорошо как есть)
- **Chats** [07] — добавить «сегодня сверху» grouping
- **Reports** [09] — VAT card — лучшая продающая демонстрация
- **Services** [17] — category stripes + расходники — эталон
- **Waitlist** [13] — лучший empty-state в app, копировать для других
- **SMS templates** [21], **Settings** [15], **Settings/Calendar** [22], **Cities** [23]

### ✂️ Cut / simplify (раздуто)
- **Dashboard** [01] — убрать Y&D/D&K tabs в segmented filter (открывать по тапу), добавить pinned Сегодня
- **Client profile** [06] — collapse empty Telegram/Instagram, hide empty tabs, sticky CTAs внизу (Call/WhatsApp/Новая запись)
- **Finances** [08] — cut «СЧЁТ ЗАПИСЕЙ» блок (перенести в Reports)
- **Brigades/Teams/Masters** — merge в один экран с табами

### ❌ Remove / fix (дедвейт или сломано)
- **CityPicker bottom-sheet** [04] — центрировать
- **Schedule empty state** [20] — починить B4, добавить CTA
- **Recurring** [12] — merge в Inbox (F3)

### 🆕 Add (не теряй)
- Pinned «Сегодня» card на dashboard
- Реальный маршрут карты
- Morning briefing push
- Cash ticker на топбаре

---

## 🗓 Рекомендованный план — Sprint 019 «Bugs-round-2 + Polish + Flows»

### Обязательно (P0 blockers) — 1 день
1. **B1** Fix FAB→Запись opening the sheet — `useSearchParams()` dep на page.tsx:599
2. **B3** Centre CityPicker modal — `items-end` → `items-center`
3. **B4** Fix schedule empty state — sync effect on activeTeams
4. **B5** Fix Money.tsx cents→euro в render
5. **B2** Debug why injected apt didn't render (likely team_id filter)

### Рекомендовано (P1) — 2-3 дня
6. **U3** Centred ConfirmDialog + codemod 14 call sites
7. **U1** Pinned `TodayGlance` на top of [01]
8. **U2** "Сколько сегодня" card в Финансах
9. **U8** Mobile reschedule — «Перенести» в ActionMenu
10. **U6** backHref prop в PageHeader

### Полезно (P2 design) — 1.5 дня
11. **D9** Tabular-nums на body (одна строчка CSS, весь app выравнивается)
12. **D1** Добавить `<Text>` primitive + codemod 17 файлов
13. **D2** Codemod 22 `formatEUR` → `<Money>`
14. **D4** gray→slate mechanical codemod
15. **D8** Rename stale "indigo" union в reports

### Фичи (если бюджет) — 3 дня
16. **F1** Morning briefing (M-complexity, 1 день)
17. **F2** Close-the-day route + sheet (M, 1 день)
18. **F5** Today cash ticker на topbar (S, 0.5 дня)
19. **F4** Global search ⌘K (M, 1.5 дня)

### Backlog (требуют L-сложности или бэкенд)
- **F7** Real route map — требует геокодинг API
- **U4** Brigades/Teams/Masters merge — data migration
- **F3** Inbox merge — легче, но меняет IA

**Total:** 6–9 дней работы. **Начинать с B1+B2** — иначе текущий FAB-flow бесполезен.

---

## 🎯 Мой совет CEO

**Sprint 019 priority order:**
1. **Чини B1–B5** (1 день). Без этого FAB + главный flow сломаны.
2. **P1 U1+U2+U3+U8** (2 дня). Эти 4 вещи — разница между «CRM работает» и «CRM помогает».
3. **D9 tabular-nums** (10 минут). Один CSS-правило, визуально апгрейд всех чисел.
4. **F1 Morning briefing** (1 день). Единственная фича которая меняет отношение к app: «я не один с календарём, app думает за меня».
5. Остальное — бэклог.

**Следующий audit-прогон:** через 1 сп-т (после B1-B5 и U1), повтор с прода, проверка что трест-брейкеры ушли.
