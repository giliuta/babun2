# Babun2 — Home Experience Ideas

**Date:** 2026-04-19
**Context:** `/dashboard` = календарь (главный экран). Диспетчер в поле, не владелец. BottomTabBar: Календарь / Клиенты / Чаты / Финансы / Ещё. Persona: см. `.claude/agents/babun-mobile-ux-auditor.md` (iPhone 14, одна рука, +35 °C, скутер, 20 сек на задачу).

**Принцип:** календарь — король. Любой widget — сверху или снизу, но **не поверх сетки**. BottomTabBar уже переполнен (5). Floating `+` — кандидат, не факт.

**Легенда:** `Где` / `Когда полезно` / `Сложность` (S <4ч, M 1-2д, L 3-5д) / `Conflict risk` (скрывает ли сетку календаря).

---

## 1. Sticky «Сейчас» pill
Поверх Header-а узкая плашка 28 px: `13:42 · через 18 мин → Иванов, Limassol 14:00`. Тап = scroll-to + open AppointmentSheet. Когда запись в прошлом, но не `completed` — оранжевый бордер «не закрыто».
- **Где:** между Header и календарной сеткой, sticky top
- **Когда:** весь день; особенно за 30 мин до события
- **Сложность:** S
- **Conflict risk:** низкий (28 px над сеткой — не крадёт viewport, сам скроллится вместе с неделей)

## 2. Day summary strip
Одна строка 24 px сразу под датой: `Сегодня · 6 записей · €450 · 3 в работе · 1 без оплаты`. Цифры кликабельны, тап «без оплаты» фильтрует календарь на красные записи. В week/3days виде скрывается.
- **Где:** ниже Header только в Day view, между датой и сеткой
- **Когда:** утром (план), вечером (checklist)
- **Сложность:** S
- **Conflict risk:** низкий, только в Day view

## 3. Quick-action FAB с bottom-sheet
Floating `+` над BottomTabBar (right thumb zone, 56×56, 20 px над баром). Тап → bottom-sheet 280 px: **Запись / Расход / Событие / Лид из чата**. Долгое нажатие → сразу последнее действие. Заменяет центральный «+Запись» если тот есть в баре.
- **Где:** bottom-right, `z-40`, над FAB safe-area
- **Когда:** всегда — главный write-path
- **Сложность:** M (bottom-sheet уже есть паттерн для AppointmentSheet)
- **Conflict risk:** средний — закрывает правый нижний угол сетки; решается автопрозрачностью при скролле

## 4. Auto-scroll to «now line»
При открытии `/dashboard` в Day/3days — сетка скроллится так, чтобы текущее время было на 30 % высоты экрана (не в самый верх — чтобы видеть «что было 2 часа назад»). Сохраняем scroll-intent: если юзер скроллит вручную, не возвращаем.
- **Где:** логика в `useLayoutEffect` при mount
- **Когда:** каждое открытие PWA
- **Сложность:** S (добавить ref на now-line, scrollIntoView с `block: "center"`)
- **Conflict risk:** нулевой — меняет только initial scroll

## 5. Unread chats badge + приоритет
Красная циферка на иконке «Чаты» в BottomTabBar (уже есть `unreadChats`, но только dot — заменить на число до 9, потом `9+`). Бонус: тап на Календарь когда есть непрочитанные → toast «3 новых сообщения, открыть?» (dismissable, 1 раз в сессию).
- **Где:** BottomTabBar → TabButton → добавить `count` prop
- **Когда:** весь день, особенно после перерыва
- **Сложность:** S
- **Conflict risk:** нулевой

## 6. End-of-day red-flag banner
После 19:00 если есть записи с `status=completed` но без `payment` — sticky banner снизу-над-TabBar: `2 записи без оплаты → закрыть`. Тап → модал-список с inline `PaymentSheet`. Если всё закрыто — banner исчезает.
- **Где:** 48 px полоска над BottomTabBar, scarlet/amber
- **Когда:** вечер (18:00-23:00)
- **Сложность:** M
- **Conflict risk:** низкий (появляется только если есть незакрытое, и только вечером)

## 7. Morning briefing (first-open-of-day)
Раз в день при первом открытии утром (до 10:00) — full-screen sheet: `Доброе утро · 5 записей · €680 план · 2 клиента ждут в чатах · Погода +38° — чистки актуальны`. 3 primary CTA: «К календарю / Ответить в чатах / Посмотреть маршрут». Dismiss сохраняет flag `briefing:YYYY-MM-DD=seen`.
- **Где:** overlay при первом mount дня
- **Когда:** утро (04:00-10:00), 1 раз в день
- **Сложность:** M
- **Conflict risk:** временный — overlay, но легко dismissable (свайп вниз)

## 8. Upcoming-gap hints (inline в сетке)
Пустые слоты ≥ 60 мин в рабочих часах бригады показываются полупрозрачной штриховкой с лейблом `Свободно · 1ч 30м`. Тап = pre-filled AppointmentSheet с этим слотом. Не подсвечиваем все пустоты — только те где «слева и справа есть запись» (между ними окно).
- **Где:** внутри DayColumn, behind AppointmentBlock
- **Когда:** весь день, особенно когда звонит срочный клиент
- **Сложность:** M (нужна функция `findGaps(appointments, workHours)`)
- **Conflict risk:** встроено в сетку, дополняет, не закрывает

## 9. Brigade status rail (top)
Узкая горизонтальная плашка 36 px между Header и сеткой: `Y&D · Limassol · до 15:00 · 3 выезда` / `Team B · Larnaca · до 17:00 · 2 выезда`. Цветной dot = статус (on-route/at-site/free). Тап = фильтр календаря на эту бригаду. В week-view не показывается (нет места).
- **Где:** под Header, над (или вместо) «Сейчас» pill в Day view
- **Когда:** днём, когда планируешь вставить срочную запись
- **Сложность:** M (нужны поля `Team.current_city`, `Team.status` + симуляция)
- **Conflict risk:** конфликтует с идеей 1 — либо sticky-пилл, либо rail; идеально через settings toggle

## 10. Weather-aware suggestion chip
Утром + днём в жару: мягкий chip сверху `+38° сегодня · 3 клиента просили чистку — позвонить?`. Тап = список клиентов с тегом `maintenance_due` отсортированный по последнему визиту. Не alarm, не red — amber. Зимой заменяется `Сезон обслуживания — 12 записей на неделю?`.
- **Где:** вариант «Сейчас» pill — subtle hint mode
- **Когда:** утро при первом открытии жаркого дня; 1 раз в сутки
- **Сложность:** L (нужна погода API + recall HVAC-клиентов)
- **Conflict risk:** низкий, если dismissable

---

## Recommended phasing

**Phase 1 (ship в 2 спринта) — wins без рисков для сетки:**
- #4 auto-scroll to now (S, 0 risk)
- #5 unread chats count (S, 0 risk)
- #2 day summary strip (S, Day view only)
- #1 sticky «Сейчас» pill (S, 28 px)

**Phase 2 — поведенческие улучшения:**
- #3 FAB с bottom-sheet
- #6 end-of-day red-flag banner
- #8 gap hints

**Phase 3 — personality:**
- #7 morning briefing
- #9 brigade rail (требует `Team.status` поля)
- #10 weather-aware (после backend + weather API)

## Conflict matrix (что нельзя ставить вместе)

- #1 + #9 — оба хотят space под Header → выбрать один default, второй через settings
- #3 FAB + центральный «+Запись» в BottomTabBar → выбрать одну primary write-surface
- #6 + #10 — обе amber-полоски; разводить по времени суток (weather=утро, red-flag=вечер)

## Anti-ideas (осознанно НЕ делаем)

- KPI-dashboard «revenue this month» — это для владельца, не диспетчера. Живёт в `/dashboard/finances`, не на home
- Карусель карточек вместо календаря — ломает главное
- Виджет «свободные мастера» как отдельный таб — превращаем в rail (#9), не воруя табы
- Onboarding tour на каждое открытие — одноразово, потом `briefing` (#7)
