# Babun2 — сводный UX-аудит

**Дата:** 2026-04-20
**Метод:** 6 параллельных агентов прошли по 15+ экранам + модалкам, оценивая каждый элемент по семи осям (clarity / thumb zone / cognitive load / typography / feedback / error recovery / emotional tone).
**Persona:** диспетчер AirFix на скутере в Лимассоле, +35 °C, одна рука, iPhone 14, LTE прыгает, AirPods. Нужно за 20 секунд — найти/создать/переместить запись.

Всего собрано **≈130 findings**. Ниже — приоритизированный план и полные списки по экранам.

---

## Топ-20 для немедленной атаки

Порядок = **частота использования × цена ошибки**. Начинать сверху.

| # | Скор | Где | Что не так | Как чинить |
|---|------|-----|-----------|-----------|
| 1 | **🔥 data-loss** | `teams/page.tsx:187` | Удаление команды оставляет orphan `appointments.team_id`; `route` показывает призраков | Каскад: обнулить `team_id` у всех записей удалённой команды, как делает masters |
| 2 | **🔥 data-loss** | `ClientPanel.tsx:201` | Каждый символ в inline-полях = полный `upsertClient` + write в localStorage (903 × символ) | Локальный state + onBlur, либо debounce 300ms |
| 3 | **🔥 data-loss** | `AppointmentSheet.tsx:657` | close-confirm: primary «Сохранить» при `!canSave` молча закрывает форму + flash-toast, пользователь думает что сохранилось | Disable primary когда `!canSave`, или переставить: primary=«Продолжить редактирование», danger=«Удалить черновик» |
| 4 | **🔥 data-loss** | `IncomeBlock:184`, `ServiceRow:173`, `ClientPicker new-client form` | Backdrop-tap на sub-popups = тихая потеря введённого | Guard dirty sub-popups как AppointmentSheet |
| 5 | **🔥 data-loss** | `ClientProfileView:266`, `waitlist:54`, `cities:84`, `booking:73`, `expenses:305`, `payroll:58` | Удаление заметок/городов/типов/расходов/зарплат/waitlist — один тап, без confirm, без undo | Унифицировать: undo-toast 5 сек или modal confirm. Выбрать **один** паттерн для всего CRM |
| 6 | **🔥 ship-block** | `login/page.tsx:14` | Логин полностью фейковый — игнорирует email/password, любое нажатие → /dashboard | До SaaS-запуска: реальный Supabase Auth (STORY-002) |
| 7 | **🚧 dead weight** | `app/dashboard/master-profile/page.tsx` | Стаб: hardcoded «Кипр/EUR», local-only поля, MOCK_SERVICES, дубль /schedule | **Удалить** маршрут целиком |
| 8 | **🚧 dead weight** | `ClientsDialog.tsx`, `ClientCard.tsx`, `ClientPanel.tsx` | Три разные карточки клиента в bundle, первые две на MOCK_CLIENTS (~300 строк dead code) | Удалить ClientsDialog + ClientCard. Для ClientPanel — решить и унифицировать с ClientProfileView |
| 9 | **🚧 orphan UI** | `settings/page.tsx:87-213` | 4 toggle'а (шрифт записей / шрифт времени / 12h / первый день недели) — чистый useState без localStorage, сбрасываются | Либо persist в FormSettings/localStorage, либо удалить UI |
| 10 | **🚧 orphan UI** | `finances/page.tsx:433` | Блок «Сверка кассы» с текстом «в следующем обновлении» — главный вопрос владельца | Убрать секцию до готовности или добавить поле «факт в кассе» сейчас |
| 11 | **⚠ math-trust** | `finances` vs `reports` | Два разных расчёта прибыли (appointments+extras vs payments+expenses) — цифры расходятся | Один источник истины в `lib/finance/*`, оба экрана читают оттуда |
| 12 | **⚠ id-leak** | `payroll/page.tsx:90,204`, `brigades/page.tsx:241,287` | `masterId` (`mst_123`) показывается в UI как имя мастера | Резолвить через `loadMasters()` → `master.name` |
| 13 | **UX** | `BottomTabBar.tsx:65` | Нет центральной «+ Запись» — главный action требует hamburger → New... = 3 тапа | Floating pill `+` 56×56 violet-600 z=50 в центре таб-бара |
| 14 | **UX** | `page.tsx:538` (calendar) | Тап по слоту → `Math.floor(totalMinutes/60)` округляет до часа → для 10:30 надо создать на 10:00 + отредактировать | `Math.floor(totalMinutes/30)*30` — snap к 30 мин (соответствует `CalendarSettings.gridStep`) |
| 15 | **UX** | `dashboard/page.tsx:596` | Touch drag-drop записей полностью отключён, только mouse | TouchSensor с `delay: 250, tolerance: 8` — конфликт с long-press разрешается задержкой |
| 16 | **typography** | `AppointmentBlock:157,180`, `DayColumn:236,246`, `MonthView:119` | text-[7px]..[9px] для времени/услуги/города/weekday/дохода — субпиксельный текст, под солнцем нечитаемо | Минимум 11px для tabular, 12px для текста (Apple HIG floor) |
| 17 | **search** | `clients/page.tsx:272` | Поиск по 903 клиентам только по phone/tg/ig — нельзя найти по комментарию/адресу/тегам | Расширить filter на `comment`, `sms_name`, `locations[].address/label`, теги |
| 18 | **consistency** | 4 экрана (finances/expenses/payroll/reports) | 4 независимые копии tab-bar'а бригад, одинаковая логика | Вынести в `components/finance/BrigadeTabs.tsx` |
| 19 | **consistency** | 4-5 экранов | Три паттерна удаления (native `window.confirm`, silent swipe, soft archive) + два primary-цвета (`indigo-600`, `violet-600`) + два способа navigation (custom header vs `PageHeader`) | Задокументировать design tokens в `docs/design-system.md`, рефакторить по ходу |
| 20 | **consistency** | z-index ladder (70..95, разбросано) | AppointmentSheet 70, ServicePicker?, IncomePopup 85, PriceEditor 80, MapNav 85, ClientActionMenu 90, SendMsg 90, close-confirm 90, ClientProfile 95 | `lib/z-index.ts` с именованными уровнями |

---

## План атаки — 3 фазы

### Фаза 1: «остановить кровь» (1-2 дня, без переделок)
Только fixes, не меняющие logic/flow:
- **#5** — удаления везде через undo-toast (один хук в `lib/undo-toast.ts` + подмена 6 мест)
- **#1** — cascade delete для team (2 строки в `teams/page.tsx`)
- **#3** — disable «Сохранить» в close-confirm когда `!canSave`
- **#9, #10** — удалить мёртвые toggle'ы настроек и блок «Сверка кассы»
- **#7, #8** — удалить `master-profile/page.tsx`, `ClientsDialog`, `ClientCard`
- **#12** — 2 lookup'а `masterId → name` в brigades и payroll (по 3 строки каждый)

Суммарно **≈10-12 файлов**, ноль новых компонентов, ноль тестов на перерисовку. Одна story, один PR.

### Фаза 2: «основные боли на мобилке» (3-4 дня)
Требуют переработки:
- **#13** — Floating `+` в BottomTabBar, замена hamburger → sidebar
- **#14** — snap к 30 мин для tap-create
- **#15** — включить TouchSensor для drag-drop
- **#16** — поднять все text-[7..9px] до 11-12 min в AppointmentBlock / DayColumn / MonthView
- **#17** — поиск клиентов по всем полям
- **#2** — debounce/onBlur в ClientPanel

### Фаза 3: «полировка и tokens» (1-2 дня, без риска)
- **#18** — вынести BrigadeTabs в общий компонент
- **#19** — `docs/design-system.md` + первые 3 token'а (confirm pattern, primary color, z-index)
- **#20** — `lib/z-index.ts`
- **#11** — унифицированный финансовый расчёт (внимание: трогает `lib/finance/*`)

### После фазы 3: SaaS-подготовка
- **#6** — реальный логин (это уже STORY-002 в roadmap)
- Оставшиеся P1/P2 из экранных списков ниже
- Remove AirFix hardcodes (footer login, currency/country в master-profile)

---

## Полные списки по экранам

### Календарь (dashboard/page.tsx + calendar/*)

**P0:**
- `BottomTabBar.tsx:65` — нет центральной кнопки «+ Запись». **Fix:** floating pill `+` 56×56 violet-600 z=50
- `Header.tsx:71` — hamburger в верхнем-левом углу недосягаем правой рукой на 6.7" iPhone. **Fix:** меню в BottomTabBar, убрать hamburger из Header на mobile
- `AppointmentBlock.tsx:157,180` — time/service `text-[8px]` нечитаемо под солнцем. **Fix:** минимум 11px для времени, 12px для клиента
- `DayColumn.tsx:236-246` — город/weekday `text-[7px]`. **Fix:** 10px weekday, 11px city
- `page.tsx:538` + `DayColumn.tsx:159` — tap по слоту snap'ит к часу, не к 30-мин

**P1:**
- `page.tsx:596-598` — touch-drag отключён (только mouse)
- `AppointmentBlock.tsx:47` — long-press 550ms конфликтует с Safari context menu (600ms)
- `Header.tsx:121` — Today-иконка выглядит как view-mode
- `DayColumn.tsx:200-221` — long-press на day-header неочевиден на mobile
- `page.tsx:862` — vertical rule absolute left-12 перекрывает клики в первой колонке
- `Header.tsx:140-171` — view-mode dropdown 4 опции — slowest path
- `WeekView.tsx:57` — setInterval 60s не реагирует на visibilitychange
- `AppointmentBlock.tsx:72` — min-height 18px меньше 44px touch target

**P2:**
- `page.tsx:868` — BUILD_VERSION chip в production bundle
- `AppointmentBlock.tsx:186` — emoji warning icons ломают baseline
- `DayColumn.tsx:296` — today vs weekend colors неразличимы на солнце
- `MonthView.tsx:119` — income `text-[9px]`
- `Header.tsx:204` — team tabs без fade-mask индикатора
- `DayColumn.tsx:328` — break overlay `text-[9px]` обрезается в week-view
- `page.tsx:798` — «+ Расход» pill h-7 ниже 44 min
- `SwipeableCalendar.tsx:17` — SWIPE_COMMIT_RATIO 0.25 = 98px на 390px viewport

### Форма записи (appointment/*)

**P0:**
- `AppointmentSheet.tsx:657` — close-confirm позволяет empty save через primary button
- `IncomeBlock:184`, `ServiceRow:173`, new-client form — backdrop-tap = data loss
- iOS keyboard covers Save (`CommentBlock:29`, `LocationsBlock:309`, event name)
- `ServicePickerSheet.tsx:160` — disabled confirm button выглядит identical к active
- `AppointmentSheet.tsx:609` — «Создать запись · €0» без warning если все `pricePerUnit=0`

**P1:**
- `AppointmentSheet.tsx:331` — Клиент/Событие toggle занимает премиум-слот (85%+ = Клиент)
- `TimeBlock.tsx:156` — нет «+15 / +30 / +1h» чипов у длительности
- `AppointmentSheet.tsx:705` — modal-on-modal «Выбрать клиента сейчас?» вместо disable+helper
- `AppointmentSheet.tsx:514` — rose switch «Запись отменена» = silent destructive без confirm
- `IncomeBlock.tsx:58` — disabled state визуально идентичен enabled
- `AppointmentSheet.tsx:498` — «Фото · скоро» placeholder в hot zone
- `CommentBlock.tsx:33` — rows=2 → internal scrollbar на длинных заметках
- `ClientBlock.tsx:40` — «+ Выбрать клиента» без required-маркера

**P2:**
- Микрокопия 11-12px ниже 13px floor (address note, duration, comments fallback)
- Z-index ladder не задокументирован
- 3 разных primary цвета (violet-600, indigo-600, sky-500)
- `TimeBlock:183` — нет tabular-nums на duration
- ClientActionMenu emoji icons (платформа-зависимые)
- LocationsBlock «Навигация» disabled = dashed empty state
- «Событие» preset grid — inconsistent emoji
- ServicesBlock price @ 4-digit € вытесняет name truncation

### Клиенты (clients/*)

**P0:**
- `ClientPanel.tsx:201` — onChange = полный upsertClient на каждый символ
- 3 конкурирующие карточки клиента (ClientPanel / ClientProfileView / ClientCard)
- `ClientProfileView.tsx:266` — удаление заметки без confirm/undo
- `clients/page.tsx:272` — поиск по 903 только по phone/tg/ig
- `ClientPanel.tsx:243` — ЧС toggle без confirm

**P1:**
- `clients/page.tsx:247` — cyclic sort без визуального меню
- `ClientProfileView.tsx:482` — EditableName blur без trim-guard
- 2 конкурирующих header при profile-in-overlay
- `ClientPanel.tsx:113` — 4-табный header уезжает за viewport на 375px
- `ClientProfileView.tsx:447` — История записей свёрнута по умолчанию (критичная инфа)
- `clients/page.tsx:162` — sticky action bar 4 кнопки по 84px
- `ClientPanel.tsx:197` — onChange весь client перезапись
- type="tel" без inputMode="tel"
- ClientsDialog + ClientCard + MOCK_CLIENTS = dead code

**P2:**
- empty state «Пусто» слабый
- 4 badge-линии раздувают карточку до 120px
- violet-700 sub-filter chips ломают hierarchy
- preset tag chips hardcoded в 3 местах
- formatShortDate без года (проблема к 2027)
- 2 разных create-client формы
- date input без «убрать день рождения»
- phone/SMS buttons 32px < 44min
- aria-label missing на tel-button

### Настройки (settings/*, brigades, services, sms-templates)

**P0:**
- 4 orphan toggle'а на settings/page.tsx
- дубль «Первый день недели» (мёртвый/живой)
- удаление city/booking-type без confirm (inconsistent vs brigades)
- нет кнопки «Сохранить» для фонт/12h/день
- settings/booking back-nav ведёт на calendar (nav-card на главной нет)

**P1:**
- «Финансовые бригады» vs «Расписание команд» — семантический дубль
- toggle «активен» без подписи (cities)
- ID мастера free-text (brigades:287)
- masterId raw в UI (brigades:241)
- дубль «Отправлять автоматически» (sms-templates)
- Save disabled без объяснения причины (calendar)
- `window.confirm` в iOS PWA (services, sms)
- empty states без CTA

**P2:**
- inconsistent padding/shadow main vs subpages
- text-[11px] text-gray-400 < 3:1 contrast
- inline-edit vs add-form почти identical
- tabs 2px underline touch target
- emoji в «⚙️ Категории»
- dual-click entry в sms templates
- «Типы объектов» в calendar settings (логически про booking)
- info-плашка `text-[11px]` (brigades)
- «+ Добавить» inconsistent (mobile vs lg)
- collapse-индикатор ▲/▼ Unicode pixelated

### Финансы / отчёты / расходы / выплаты

**P0:**
- 4 KPI grid-cols-4 на 375px — €1,234 обрезается
- finances vs reports — две «правды» о прибыли
- «Сверка кассы — в следующем обновлении» stub
- masterId как имя мастера (payroll)
- percentDelta без базы сравнения

**P1:**
- conic-gradient pie без легенды (expenses)
- хрупкий regex parsing cumulative (expenses:104)
- `confirm("Удалить...")` iOS native
- сырой ISO date `{e.date}` vs formatDateLongRu
- 4-col table обрезается (reports)
- SMS-текст €1234.56 без тысяч-разделителя
- только ±1 неделя navigation (payroll)
- isoWeekRange от current day, не monday
- 4 разных brigade-tab реализации

**P2:**
- KPI `text-[13px]` иерархия слабая
- progress-bar h-1 теряется
- reports date без weekday/месяца
- emoji icons в FinanceTabs
- 3 метрики одной типографикой
- «% от выручки» без числа
- period/payroll sticky overflow
- AddExpenseForm inline раскрытие теряет место в списке
- SummaryCard text-[15px] wrap
- master resolver несогласован
- payroll `{l.masterId}` raw

### Второстепенные (chats, waitlist, route, masters, teams, schedule, login)

**chats P0:** нет PageHeader, тупик без back-кнопки
**chats P1:** `contact_phone.includes(q)` crash на undefined

**waitlist P1:** swipe-delete без confirm. **P2:** мастер/бригада free-text, дедлайн free-text без date picker

**route P1:** маршрут хронологический, не геооптимальный; нет deep-link. **P2:** «⚠ адрес не указан» passive, не CTA

**masters P1:** `window.confirm` delete. **P2:** «Неактивные» empty section, phone без mask/E.164

**teams P0:** delete team orphanит appointments. **P1:** дублирует masters page. **P2:** lead dropdown позволяет украсть из другой команды без warning

**schedule P1:** empty state dead end без кнопки «Создать бригаду». **P2:** нет save feedback, общие «Перерывы» vs per-weekday без пояснения precedence

**master-profile P0:** стаб, hardcoded «Кипр/EUR», MOCK_SERVICES, дубль /schedule — **удалить**

**login P0:** фейковый. **P1:** no forgot password, loading без cleanup. **P2:** indigo logo vs violet app, hardcoded AirFix footer

---

## Системные паттерны (встречается в N экранах)

| Паттерн | Встречается в | Действие |
|---------|--------------|----------|
| Удаление без confirm/undo | clients, notes, cities, booking-types, expenses, payroll, waitlist, services | Унифицировать: undo-toast 5 сек (`lib/undo-toast.ts`) |
| ID в UI как имя | brigades, payroll, FinanceTabs | `lib/resolvers.ts` + audit всех `{.*Id}` в JSX |
| Native `window.confirm()` в PWA | services, sms-templates, expenses, payroll, masters, teams, clients | Custom modal по центру (правило приложения) |
| Dead code / stubs | master-profile, ClientsDialog, ClientCard, MOCK_* в production bundle, «Сверка кассы», orphan toggles | Одна story «Сleanup dead code», удалить ~400 строк |
| Цветовая фрагментация | indigo-600 vs violet-600 vs sky-500 для primary | Design token `brand-primary: violet-600` |
| Header-стратегия фрагментирована | chats custom vs PageHeader в остальных | Все через PageHeader, chats переделать |
| Шрифты < 13px floor | все карточки списков/карт, AppointmentBlock, MonthView, info-плашки | Audit: grep `text-\[[0-9]+px\]` для значений < 13 |
| Z-index ad-hoc | 9 модалок с 70..95 | `lib/z-index.ts` + 5 именованных уровней |

---

## Дальше

1. **Апрувнуть** этот документ / скорректировать приоритеты
2. Сделать Phase-1 («остановить кровь») одним PR — разгружает 8 из 20 пунктов за 1-2 дня
3. После Phase-1 — решить порядок Phase-2/3 по твоим реальным сценариям

Все findings и их file:line — в секциях выше. Если что-то в топ-20 кажется не главным — поменяем.
