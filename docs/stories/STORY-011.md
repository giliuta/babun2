# STORY-011 — Calendar v2: доработка до операционной полноты

**Status:** proposed (не начата; коммиты с тегом STORY-011 от 17.04.2026 фактически относятся к STORY-012)
**Priority:** HIGH (блокирует комфортное ежедневное использование)
**Estimated scope:** ~10-14 файлов, 1.5-2 дня
**Depends on:** —
**Blocks:** ничего (STORY-001 можно начинать параллельно, модели данных совместимы)
**Date:** 2026-04-11
**Last reviewed:** 2026-04-17

---

## User story

> Как диспетчер/мастер я хочу видеть пересекающиеся записи, замечать конфликты, быстро менять длительность встречи, прыгать на «сегодня», и видеть месячный обзор с телефона — чтобы календарь можно было использовать в полевых условиях так же уверенно, как Bumpix.

## Problem

Сейчас на календаре Babun2 нельзя:
1. Увидеть две записи на одно и то же время — они визуально накладываются, видна только последняя.
2. Заметить, что новая запись создаётся на уже занятый слот — нет никакой обратной связи.
3. Изменить длительность записи быстро — только через форму.
4. Прыгнуть на «сейчас» одним тапом — если уехал на другую неделю, возвращаться неудобно.
5. Посмотреть обзор месяца — только недельный вид.
6. Тапнуть по заголовку дня, чтобы провалиться в day-view.
7. Понять, куда именно ткнуть в зуме — видны только часовые линии, нет получасовых/15-минутных.

Всё это — базовая операционная гигиена для CRM бригад, которые работают с календарём десятки раз в день.

---

## Acceptance criteria

### 1. Overlapping appointments (column split)
- Две записи с пересекающимся временем на одном дне и одной команде делят ширину колонки пополам, три — на три, и т.д.
- Алгоритм: стандартный **interval graph coloring** (жадное назначение колонок слева направо по `time_start`).
- Работает на любой ширине `hourHeight`, на всех режимах (1/3/7 дней).
- На ширине колонки < 60px (день-view с 3-days на iPhone) колонки сжимаются равномерно, текст внутри блоков остаётся читаемым.

### 2. Conflict highlight
- Когда создаётся или перетаскивается запись на слот, где уже есть ≥1 запись той же команды — группа пересекающихся блоков получает красную рамку `ring-2 ring-red-400` пока пересечение не разрешено.
- Форма создания записи не блокирует конфликт, но показывает предупреждение «⚠ пересекается с: {время} {клиент}» под полем времени.
- Причина: в реальной работе иногда нужно перезаписать — бригада работает на двух квартирах в одном доме.

### 3. Resize duration (drag bottom edge)
- У каждого `AppointmentBlock` нижние 8px являются resize-ручкой (курсор `ns-resize` на desktop, touch-handler на mobile).
- При тапе и ведении вниз/вверх время окончания изменяется с шагом 15 минут (или 5 при `hourHeight >= 180`).
- Минимум 15 минут, максимум до конца рабочего дня.
- На тач-устройствах требуется `long-press 200ms` перед resize, чтобы не конфликтовать с tap-to-open.
- Сохраняется через существующий `updateAppointment()`.

### 4. "Now" button — jump to today
- Плавающая кнопка внизу справа (над safe-area) с иконкой ⏱ и подписью «Сейчас».
- Показывается только когда видимая неделя ≠ неделя `now` ИЛИ когда `scrollTop` отстаёт от текущего времени > 2 часа.
- Тап → смена `mondayDate` на текущую неделю + smooth-scroll к `currentTimeMinutes * pxPerMinute - viewport/3`.

### 5. Month view — вертикальный список дней (mobile-first)
- Новый ViewMode `"month"` в `Header`, переключается в выпадашке после `day / 3days / week`.
- Layout: вертикальный список карточек по дням месяца.
- Каждая карточка: `{день недели} {число} {месяц}`, количество записей, суммарный доход за день, первые 3 записи (время + клиент), бейдж «+N ещё» если больше.
- Тап на карточку → переход в day-view этого дня.
- Sticky-хедер месяца сверху, листание между месяцами свайпом (reuse `SwipeableCalendar` pattern или отдельный handler).
- Рабочие дни белые, выходные слегка серые. Дни без записей серым текстом.

### 6. Tap day header → day view
- В WeekView тап по шапке дня (`div` с числом + днём недели) → переключение в day-view этого дня + скролл к текущему времени.
- Сохраняется текущий `hourHeight` — масштаб не теряется.

### 7. Вспомогательная сетка (15/30-min lines)
- При `hourHeight >= 120`: добавляются тонкие 30-мин линии `border-t border-gray-100` стилем dashed.
- При `hourHeight >= 180`: добавляются 15-мин линии ещё тоньше.
- Не добавлять DOM-элементы — использовать CSS `background-image` с `linear-gradient`, чтобы не раздувать рендер при 7×24 колонках.

---

## Technical plan

### Файлы, которые меняются

| Файл | Изменение |
|------|-----------|
| `src/lib/calendar-layout.ts` | **NEW**. Функция `computeOverlapColumns(appointments): Record<string, { col: number, cols: number }>`. Алгоритм: сортировка по start, жадное назначение колонок, ограничение по cluster. Pure, тестируемая. |
| `src/lib/appointments.ts` | Добавить helper `hasConflict(apt, allOnDay): Appointment[]` возвращающий список пересекающихся. |
| `src/components/calendar/DayColumn.tsx` | Вызвать `computeOverlapColumns` перед рендером. Передать `col/cols/conflict` в `AppointmentBlock`. |
| `src/components/calendar/AppointmentBlock.tsx` | Новые props `col`, `cols`, `conflict`. Расчёт `left = col/cols * 100%`, `width = 100/cols%`. Красная рамка при `conflict`. Добавить resize-handle внизу 8px. |
| `src/components/calendar/ResizeHandle.tsx` | **NEW**. Pointer/touch handlers, вызывает callback `onResize(appointmentId, newEndTime)`. |
| `src/app/dashboard/page.tsx` | Prop-drill `onAppointmentResize` через WeekView→DayColumn→Block. Обновление через `updateAppointment()`. Добавить Now-кнопку + её show-logic. |
| `src/components/calendar/NowButton.tsx` | **NEW**. Floating fixed `bottom-20 right-4`. |
| `src/components/calendar/MonthView.tsx` | **NEW**. Вертикальный список дней месяца. |
| `src/components/calendar/DayColumn.tsx` | Header — сделать clickable, `onClick` → `setViewMode("day")`. |
| `src/components/calendar/TimeGrid.tsx` | Helper `getGridBackground(hourHeight)` → CSS background-image. |
| `src/components/calendar/DayColumn.tsx` | Применить грид-фон через style вместо HOURS.map. |
| `src/components/layout/Header.tsx` | Добавить ViewMode `"month"` в выпадашку. |
| `src/components/appointments/AppointmentForm.tsx` | Добавить inline-warning о конфликте. |
| `public/sw.js` | Bump CACHE_VERSION → babun-v16. |
| `src/app/dashboard/page.tsx` | Bump BUILD_TAG → v16-calendar-v2. |

### Порядок работы
1. `calendar-layout.ts` (чистая логика, можно проверить вручную)
2. `appointments.ts` helper `hasConflict`
3. Прокинуть в `DayColumn` и `AppointmentBlock` → визуально проверить overlap
4. Добавить conflict-рамку
5. `ResizeHandle` + wire-up
6. `NowButton`
7. `MonthView` + ViewMode enum
8. Tap day header → day view
9. Grid background 15/30-min
10. Bump версии, `tsc --noEmit`, коммиты по шагам, push.

### Дизайн-решения

- **Overlap алгоритм:** interval graph coloring > offset-cascade. Причина: у AirFix одна бригада физически не может быть в двух местах, поэтому визуальная разделённость важнее компактности.
- **Conflict UI:** красная рамка + inline warning в форме, но НЕ блокирующая валидация. Причина: реальные кейсы перекрытия существуют (две квартиры в доме), блокировка только мешает.
- **Resize handle 8px + long-press 200ms:** совпадает с TouchSensor delay в dnd-kit, не конфликтует.
- **Month view как вертикальный список:** выбрано пользователем как самый удобный для мобильного формата. Сетка 5×7 на iPhone даёт <50px на клетку — нечитаемо.
- **Multi-team side-by-side:** отложено до STORY-001. Сейчас есть team-switcher в хедере, этого достаточно.
- **Recurring appointments:** отложено до STORY-001. Без Postgres правила повторения в localStorage — мина (сбросится при clear storage, нет FK на exceptions).

### Риски
- **Overlap рендер с zoom:** позиции пересчитываются на каждый изменённый `hourHeight`. Убедиться, что `computeOverlapColumns` вызывается один раз на рендер, а не на каждый пиксель (memo по `appointments + date`).
- **Resize + dnd-kit конфликт:** resize-handle должен иметь свой pointer-capture и `stopPropagation`, иначе dnd-kit начнёт drag.
- **MonthView производительность:** 30+ карточек с appointment-lookups. Группировать заранее в `useMemo` по `dateKey`.
- **Regression риск:** изменения в `AppointmentBlock` — проверить, что drag-reschedule всё ещё работает. Проверить зум на всех режимах.

---

## Out of scope (в эту story НЕ входит)
- Recurring appointments
- Multi-team side-by-side view
- Keyboard shortcuts (desktop)
- Анимации переключения недель
- Copy/duplicate appointment
- iCal export, print view
- Offline queue

Эти пункты живут в backlog; большинство ждёт STORY-001 (Supabase).

---

## Definition of done
- [ ] Все 7 acceptance criteria выполнены
- [ ] `npx tsc --noEmit` чистый
- [ ] `npx eslint src` без новых ошибок
- [ ] Вручную проверено на desktop + iPhone PWA:
  - [ ] Две записи на одно время видны параллельно
  - [ ] Конфликт подсвечивается красным
  - [ ] Resize нижнего края меняет время
  - [ ] Кнопка «Сейчас» появляется/прячется корректно
  - [ ] Month view открывается, листается, тап ведёт в day
  - [ ] Tap по шапке дня переключает в day view
  - [ ] Сетка 30/15 мин видна при зуме
  - [ ] Drag-reschedule всё ещё работает
  - [ ] Pinch-zoom всё ещё работает
- [ ] `BUILD_TAG = "v16-calendar-v2"`, `CACHE_VERSION = "babun-v16"`
- [ ] Коммиты логически разделены (6-10 штук)
- [ ] Запушено в `origin/master`
- [ ] Status story → `done`, добавлена секция Notes

---

## Notes

### 2026-04-17 — Аудит перед реализацией

**Что НЕ сделано (все 7 acceptance criteria):**
- [ ] Overlapping appointments (column split) — в `DayColumn.tsx` нет `computeOverlapColumns`
- [ ] Conflict highlight — нет `ring-2 ring-red-400` логики ни в блоке, ни в форме
- [ ] Resize duration — нет resize-handle внизу `AppointmentBlock`
- [ ] NOW button — нет компонента `NowButton.tsx`
- [ ] Month view — нет `MonthView.tsx`
- [ ] Tap day header → day view — header в `DayColumn` не кликабелен
- [ ] 15/30-min gridlines — `TimeGrid.tsx` рисует только часовые линии

**Путаница с коммитами:** коммиты от 15-17.04.2026 с тегом "STORY-011" и "STORY-010"
в описаниях (`comment always visible`, `locations card`, `compact TimeBlock`)
относятся к STORY-012 (phone-first appointment sheet) — это UI-улучшения
AppointmentSheet, TimeBlock и LocationsBlock, а не Calendar v2.
STORY-011 как таковая ещё не начата.

**Готово к старту:** зависимостей нет, можно начинать после чистки технического долга.
