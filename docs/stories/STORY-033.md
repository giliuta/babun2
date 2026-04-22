# STORY-033 — Sprint 033: Brigade as the central hub

**Status:** in-progress
**Branch:** `master`
**Scope:** XL — бригада становится агрегатом всего контекста работы
(календарь, услуги, города, мастера, время, доступ).

---

## 1. Intent

Сделать бригаду **полноценным хабом** — при переключении в календаре
всё на экране (услуги, города, рабочие часы, стартовое время,
подсветка) подстраивается под выбранную бригаду.

Текущая страница `/dashboard/teams` — это маленькая форма-модалка
только с именем/цветом/лидом. Её нужно заменить на **full-page
editor** с набором секций, чтобы CEO кликнул по карандашу и попал в
«настоящий кабинет бригады».

## 2. Data model — Team (extend, non-breaking)

Все новые поля `optional` — существующие записи парсятся без миграции.

```ts
export interface Team {
  // ...existing fields
  cities?: string[];                  // Города, где работает бригада
  service_ids?: string[];             // Какие услуги делает (пусто = все)
  default_scroll_time?: string;       // "14:00" — открытие календаря
  calendar_window_start?: string;     // "06:00" — начало сетки календаря
  calendar_window_end?: string;       // "23:30" — конец сетки календаря
}
```

`default_city` уже есть — остаётся. `cities[]` — массив всех городов
(включая default_city). Если массив пуст — показываем все города.

## 3. New routes

- `/dashboard/teams/new` — создание бригады (пустая модель + defaults)
- `/dashboard/teams/[id]` — редактирование существующей бригады

Страница — прокручиваемая, c 6 секциями-карточками:

1. **Информация** — имя, регион, цвет, статус (Активна / Архив),
   базовый город
2. **Города** — чипами выбираем где бригада работает, базовый выделен
3. **Мастера** — бригадир (select) + помощники (checkbox list)
4. **Услуги** — какие услуги эта бригада делает (checkbox list,
   группировка по категориям)
5. **Расписание** — часы работы по дням недели + перерывы (существующий
   `TeamSchedule` модуль, только вынести виджет)
6. **Календарь бригады** — сетка видимая
   с `calendar_window_start`–`calendar_window_end`, стартовый скролл
   `default_scroll_time`
7. **ЗП и доступы** — `payout_percentage` + бригадные доступы (чужие
   бригады, финансы, чаты)

Низ страницы — sticky footer: **«Сохранить»** + **«Удалить бригаду»**
(с confirm).

## 4. Calendar bridge

В `/dashboard/page.tsx`:

- При смене `activeTeamId`: scroll-to `team.default_scroll_time` (если задан).
- Grid render: высота = `calendar_window_end - calendar_window_start`
  (если заданы); иначе 00:00–24:00 как раньше.
- Working-hours подсвечиваются внутри окна согласно team schedule.
- `ServicePickerSheet`: если у активной бригады `service_ids` не
  пустой — фильтруем.
- `CityPickerModal`: если у бригады `cities[]` не пусто — показываем
  сначала их, потом остальные (с разделителем).

## 5. Phased execution

### Phase A (этот коммит)
- Extend `Team` interface + default filler.
- New routes `/dashboard/teams/new` и `/dashboard/teams/[id]`.
- Full-page editor с 6 секциями (сначала статичный UI: сохраняет то,
  что уже есть в Team; нового calendar-binding пока нет).
- Кнопка «+ Новая бригада» на `/dashboard/teams` → `/new`.
- Pencil-edit → навигация на `/[id]` (вместо модалки).
- Bump v233.

### Phase B
- Calendar-brigade bridge:
  - Scroll-to `default_scroll_time` при смене activeTeamId.
  - Grid window с `calendar_window_start/end`.
- Service filter в AppointmentSheet.
- City hint в CityPickerModal.
- Bump v234.

### Phase C
- Seed data: AirFix команды заполнить реальными услугами.
- Access matrix в секции «Доступы» — расширить `visible_team_ids`
  и бригадные toggle.
- Bump v235.

## 6. Acceptance

- [ ] Кнопка «+ Новая бригада» на списке открывает new-page.
- [ ] Pencil-edit открывает /[id] с текущими данными.
- [ ] Полноценная прокручиваемая страница с 6 секциями-карточками.
- [ ] Save → возврат на список с обновлёнными данными.
- [ ] Delete с confirm + cascade masters (как раньше).
- [ ] Календарь реагирует на default_scroll_time и calendar window.
- [ ] Service picker фильтруется по service_ids (если заданы).
- [ ] `tsc --noEmit` = 0 errors.
