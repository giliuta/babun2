# IDEAS — Fast Booking (5–10 sec target)

> Ускорение создания записи. Персона: диспетчер на скутере, +35°C, одна рука.
> Текущий baseline: тап слота → sheet → клиент → услуги → «Создать» = ~20 сек.
> Цель: **5–10 сек** для 80% записей, при этом не сломав guardrails (close-confirm, dirty-guard, memoized seed).
>
> Scope: только idea-list. Имплементация — отдельные STORY-NNN.

## Legend

- **S/M/L** — разработка: S ≤ 1 день, M = 2–4 дня, L ≥ 1 неделя (с тестами на iOS Safari)
- **Effort × Reward** — 1–10 каждое; приоритет = Reward / Effort

---

## 1. Recent Clients Chip-Row

**Scenario.** Сверху ClientBlock (или в пустом `ClientPickerSheet`) — ряд из 5 последних клиентов чипами «Имя + телефон-tail». 1 тап → клиент выбран, sheet не открывается.

- **Было:** тап ClientBlock → sheet → scroll/search → тап клиента (≈6–8 сек).
- **Стало:** 1 тап в самой sheet (≈1 сек). 4 тапа сразу становятся 0.
- **Сложность:** S. `recentClientIds` уже пропсом приходит в `AppointmentSheet` — просто отрендерить горизонтальный scroll-row над/вместо ClientPickerSheet trigger.
- **Риск:** чипы съедают вертикаль у `ClientBlock`; нужно truncate имени (12 chars max). «Последний» клиент может быть не тот, что для этого слота/города — решаем скорингом (см. №4).
- **Effort × Reward:** 2 × 9 = **18x ROI (ship first).**

---

## 2. Predictive Defaults (city + brigade + last service)

**Scenario.** При тапе пустого слота сразу подставляем: бригада = activeTeam, город = `cityForDate(dateKey)`, услуга = последняя услуга последнего клиента этого дня/бригады, длительность = из услуги. Диспетчер видит почти готовую карточку, ему остаётся только клиент.

- **Было:** 4–5 полей по дефолту пустые, заполняются вручную.
- **Стало:** 3 поля уже заполнены, остаётся клиент + confirm (5–7 сек total).
- **Сложность:** S. Всё данные есть локально: `activeTeam`, `cityForDate`, история — из `loadAppointments()`. Вычислить в `createBlankAppointment()` / seed billback.
- **Риск:** вредный дефолт (услуга от чужой бригады) — диспетчер не заметит и сохранит. Митигация: дефолтная услуга только если повторяется у клиента ≥2 раз; иначе пусто.
- **Effort × Reward:** 3 × 9 = **27x.**

---

## 3. Swipe-to-Create on Calendar Slot

**Scenario.** Горизонтальный swipe (→) на пустом слоте календаря = создать запись с дефолтами из №2 + «последний клиент этой бригады» + услуга = самая частая за 30 дней. Sheet не открывается вообще — появляется toast «Запись создана • Открыть • Отменить».

- **Было:** 20 сек flow для типового «повтор прошлой недели».
- **Стало:** 1 жест (≈1–2 сек) + undo fallback.
- **Сложность:** M. Конфликт с существующим touch-handler в `SwipeableCalendar` (там уже 2+ пальца = pinch guard, одиночный swipe = навигация дней). Нужен distinct gesture: swipe ≥80px горизонтально, старт в пустой cell (не на appointment-block).
- **Риск:** случайные записи от свайпа дня. Митигация: явная длинная дистанция + haptic + visible confirmation strip 3 сек с Undo. **Undo ≠ soft-delete**, а окно, в которое запись не считается за созданную (в память кладём только по истечении 3 сек).
- **Effort × Reward:** 6 × 8 = **13x.**

---

## 4. Smart Client Ranking in Picker

**Scenario.** `ClientPickerSheet` поверх алфавита показывает первыми: (a) клиентов с записями на этот город/день-недели, (b) клиентов бригады `activeTeam`, (c) +recency weight. Поиск стартует сразу с focus — клавиатура уже открыта.

- **Было:** scroll через 903 клиентов или ввод 3+ букв.
- **Стало:** 70% случаев клиент в топ-5 (0 scroll, 1 тап).
- **Сложность:** S (backend в localStorage прост). Логика: `score = 0.5*recency + 0.3*cityMatch + 0.2*teamMatch`.
- **Риск:** алгоритм тихо ошибается и клиента в топе нет — но поиск остаётся fallback, так что worst-case = current behavior.
- **Effort × Reward:** 3 × 8 = **21x.**

---

## 5. Quick Templates (saved booking shapes)

**Scenario.** Long-press на chip «+ Новая запись» (или `/settings/templates`) → список юзер-saved шаблонов: «Чистка 50 €, 2ч, бригада 1». Тап шаблона → открывается sheet с ЭТИМИ дефолтами. Клиент по-прежнему надо выбрать.

- **Было:** каждый раз заполнять 4–5 полей.
- **Стало:** 1 тап шаблона + 1 тап клиента = 2 тапа.
- **Сложность:** M. Нужен CRUD на templates (новый `lib/templates.ts`, 5–6 шаблонов по умолчанию), UI-экран в settings, пикер в ClientPickerSheet header. 4–5 новых файлов.
- **Риск:** feature-creep — диспетчер плодит шаблоны и теряется. Митигация: лимит 5 штук, автопоказ top-3 по usage.
- **Effort × Reward:** 5 × 7 = **14x.**

---

## 6. Duplicate Appointment (long-press repeat)

**Scenario.** Long-press на существующем `AppointmentBlock` → bottom action sheet: «Повторить через неделю / Скопировать сюда / Дублировать на завтра». Тап = создаётся копия на том же месте + N дней, тот же клиент, та же услуга, тот же прайс.

- **Было:** 20 сек на «такой же visit».
- **Стало:** 2 сек (long-press + тап).
- **Сложность:** M. Механика long-press на календаре конфликтует с текущим «tap = open sheet». Нужно таймер 500 мс + haptic + отдельное меню (не `AppointmentSheet`).
- **Риск:** пользователь случайно долго держит палец → дубль, который не нужен. Митигация: confirmation toast с Undo (5 сек).
- **Effort × Reward:** 5 × 7 = **14x.**

---

## 7. Instant Save + Toast Undo

**Scenario.** Убрать CTA «Создать запись». Как только `canSave === true` (клиент + время есть), запись пишется в память **автоматически** по close / backdrop tap, без кнопки. На экране появляется toast «Запись создана • Отменить» (5 сек).

- **Было:** тап большой кнопки внизу = 1 лишний действие + задержка подтверждения.
- **Стало:** swipe-down по sheet → уже сохранено.
- **Сложность:** S. Логика есть (`canSave` + `onSave`). Нужно rewire close-confirm: если запись валидна — просто сохраняем и закрываем; если не валидна — нынешний dirty-guard.
- **Риск:** **двойное сохранение.** Если диспетчер дёрнул sheet два раза — две записи. Митигация: `savedOnceRef` + de-dupe по (client_id, start_time, team_id) в `appointments.ts`.
- **Риск 2:** concept shift — 50% юзер-тестов покажут страх «не знаю, сохранилось ли». Нужна громкая toast-гарантия + haptic.
- **Effort × Reward:** 3 × 7 = **16x.**

---

## 8. Smart Time Snap (14:23 → 14:30)

**Scenario.** Тап по конкретному пикселю слота (например 14:23) → запись снэпится к ближайшим 15/30 мин с визуальным feedback «14:30». Если диспетчер хотел точное время — потянул TimeBlock chip, там ±5 мин шаг.

- **Было:** тап в слот → какой-то odd `start_time` типа 14:23, дальше правка.
- **Стало:** сразу «красивое» время, правка нужна только для нестандартных случаев.
- **Сложность:** S. Логика уже почти есть (gridlines 15/30 мин в STORY-011). Просто `Math.round(pixelToMinutes / snap) * snap` в `onSlotTap`.
- **Риск:** у некоторых клиентов есть реальные 14:23 (следом за другим visit). Митигация: snap только на пустой слот; если существующая запись рядом — fit-in без snap.
- **Effort × Reward:** 2 × 6 = **12x.**

---

## 9. Phone Autocomplete (new-client shortcut)

**Scenario.** В `ClientPickerSheet` → inline «+ Новый клиент» → ввод «+357 99» → autosuggest из: (a) номеров из contacts (если `navigator.contacts` — не у всех iOS), (b) чёрновиков последних набранных (localStorage `recentPhones`), (c) похожих номеров из существующих клиентов (может он уже есть, ошибся именем).

- **Было:** ручной ввод имени + телефона = 15 сек.
- **Стало:** 4 цифры → выбор из suggestions.
- **Сложность:** M. iOS Safari `navigator.contacts` **не поддерживает** Contact Picker API — так что упор на `recentPhones` + дубликат-детектор.
- **Риск:** дубли клиентов (ввёл уже существующего). Митигация: fuzzy match по последним 6 цифрам → «Это Петров? → да / нет, новый».
- **Effort × Reward:** 4 × 6 = **15x.**

---

## 10. Double-Booking Warning (one-tap confirm)

**Scenario.** Тап в занятый слот (или swipe-to-create поверх существующей) → в sheet сверху красная строка: «На это время у бригады уже Петров 10:00–11:00 • Всё равно создать?». Кнопка Save превращается в «Создать с overlap». Один тап — не второй confirm-модал.

- **Было:** диспетчер не видит конфликта, создаёт, потом находит в перекрытии.
- **Стало:** предупреждён до тапа, сознательное решение, 0 лишних тапов если ок.
- **Сложность:** S. Conflict detection: `findOverlappingAppointments(teamId, start, end)` на уровне `appointments.ts`. Рендер warning-strip в `AppointmentSheet` header.
- **Риск:** спам предупреждениями когда overlap легитимен (helper + lead одновременно). Митигация: overlap only if **same team AND same lead**, игнорируем helper-only.
- **Effort × Reward:** 2 × 7 = **14x.**

---

## 11. Copy From Yesterday (day-header action)

**Scenario.** Заголовок дня имеет кнопку «⋯» → меню: «Скопировать вчерашний день» (визиты только этой бригады). Создаются все N записей со смещением +1 день, клиенты и услуги сохраняются. Диспетчер смотрит, ручно правит 1–2 исключения.

- **Было:** 20 сек × 8 записей = 3+ минуты на повторяющийся день.
- **Стало:** 1 тап + 10 сек на ручные правки.
- **Сложность:** M. Bulk-create + undo-all. Нужна preview-модалка «создать 8 записей: Петров 10:00, Иванов 11:30, … ОК / Отмена».
- **Риск:** у клиентов во вчерашнем дне мог быть single-use visit; massивный дубль — много левых записей. Митигация: preview обязателен; opt-in, не default action.
- **Effort × Reward:** 5 × 6 = **12x.**

---

## 12. Bulk Creation Mode (one flow, N clients)

**Scenario.** В header calendar-а переключатель «Bulk» → диспетчер тапает слоты подряд + выбирает одного клиента, одну услугу → применяется ко всем тапнутым слотам. Выход из Bulk = Done.

- **Было:** каждая запись — полный цикл (20 сек × N).
- **Стало:** 5 сек первый setup + 1 сек на последующие.
- **Сложность:** L. Новый stateful mode на Calendar, визуальные индикаторы «выбранные пустые слоты», shared AppointmentSheet на N записей.
- **Риск:** edge-cases (разные бригады в выбранных слотах, конфликты). Митигация: фикс bulk = 1 team; если tap по чужому — ignore с легким shake-feedback.
- **Effort × Reward:** 8 × 6 = **7.5x.** (низкий priority — редкий use-case)

---

## 13. Haptic + Sound Confirmations

**Scenario.** Каждый успешный save/duplicate/swipe-create triggers iOS haptic (`vibrate(10)`) + опциональный звук (toggle в settings). Диспетчер в перчатке на скутере не смотрит на экран — чувствует подтверждение.

- **Было:** зрительная проверка toast = требуется смотреть.
- **Стало:** тактильный ответ без взгляда.
- **Сложность:** S. `navigator.vibrate` работает на Android; iOS — только через CSS `@keyframes` на wrapping div (hack) или Web Haptics API (Safari 16.4+). Звук — `new Audio()` одноразовый.
- **Риск:** звук мешает клиенту в машине. Митигация: по дефолту mute, опция в settings.
- **Effort × Reward:** 2 × 5 = **10x.**

---

## 14. Slot Preview on Touch-Hold

**Scenario.** Палец удерживается на пустом слоте 300 мс → над пальцем всплывает «Ghost preview»: predicted defaults (бригада, город, дефолт-услуга, 60 мин блок). Отпустил = создалось (если swipe-to-create включён) ИЛИ открылась sheet с этими дефолтами уже заполненными.

- **Было:** слепой тап, дефолты скрыты до открытия sheet.
- **Стало:** видно что будет создано ещё до sheet.
- **Сложность:** M. Конфликт с scroll-gesture календаря. Touch-hold 300 мс надо сделать без блокировки скролла.
- **Риск:** зависание UX если hold-timer криво настроен на Safari.
- **Effort × Reward:** 5 × 5 = **10x.**

---

## 15. Keyboard-First Quick-Entry (bar)

**Scenario.** В header calendar-а поле «Быстрая запись» — одна строка: «10:00 Петров чистка Лимассол». Parser разбирает → открывает sheet с заполненными полями или сразу save. Быстрее voice-input (который не работает на части iOS) и не требует жестов.

- **Было:** 4 sheet-этапа.
- **Стало:** 1 inputline + Enter.
- **Сложность:** M. Parser: regex + fuzzy match по clients/services. Поддержка ошибок («петов» → «Петров»).
- **Риск:** ошибки парсера без visual feedback. Митигация: показываем parsed-preview chips над полем ДО save, пользователь видит «10:00 • Петров В. • Чистка кондиционера • Лимассол» и жмёт Enter ещё раз.
- **Учёт iOS:** клавиатура занимает половину экрана, на скутере неудобно. Это идея для **офисной** работы диспетчера, не для поля.
- **Effort × Reward:** 5 × 5 = **10x.**

---

## Priority Ranking (Reward / Effort, descending)

| # | Idea                           | S/M/L | Risk  | ROI   |
| - | ------------------------------ | ----- | ----- | ----- |
| 2 | Predictive Defaults            | S     | low   | 27x   |
| 4 | Smart Client Ranking           | S     | low   | 21x   |
| 1 | Recent Clients Chip-Row        | S     | low   | 18x   |
| 7 | Instant Save + Toast Undo      | S     | med   | 16x   |
| 9 | Phone Autocomplete             | M     | med   | 15x   |
| 5 | Quick Templates                | M     | med   | 14x   |
| 6 | Duplicate Appointment          | M     | med   | 14x   |
| 10| Double-Booking Warning         | S     | low   | 14x   |
| 3 | Swipe-to-Create                | M     | high  | 13x   |
| 8 | Smart Time Snap                | S     | low   | 12x   |
| 11| Copy From Yesterday            | M     | med   | 12x   |
| 13| Haptic + Sound Confirmations   | S     | low   | 10x   |
| 14| Slot Preview on Touch-Hold     | M     | med   | 10x   |
| 15| Keyboard-First Quick-Entry     | M     | low   | 10x   |
| 12| Bulk Creation Mode             | L     | med   | 7.5x  |

## Recommended First Wave (2–3 дня, все S-комплексности)

Shippable together как STORY-NNN «Fast Booking v1»:
- **#2 Predictive Defaults** (seed-level change)
- **#4 Smart Client Ranking** (PickerSheet sort)
- **#1 Recent Clients Chip-Row** (PickerSheet header)
- **#10 Double-Booking Warning** (overlap detector)

Ожидаемый эффект: 20 сек → **8–10 сек** без жестовых новшеств, без риска случайных записей, без `navigator.contacts`, без Supabase. Дальше второй волной #3/#6/#7 как отдельные stories с отдельным тестированием на скутере.
