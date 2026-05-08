# STORY-056 — Unified EventSheet с compact-mode и presets

**Status:** in_progress
**Estimate:** 8 points
**Dependencies:** STORY-055 (RLS-паттерн `created_by` + `current_tenant_id()`), STORY-001 (Supabase подключён), STORY-039 (роли).
**Branch:** `claude/unified-eventsheet-67sPQ`

## User story

Как **мастер/диспетчер**, я хочу одну форму создания/редактирования события (рабочее или личное) с быстрыми пресетами и компактным mobile-first видом, чтобы добавить запись на 1–2 тапа без дрейфа двух разных форм.

## Why now

Сейчас в `dashboard/page.tsx` живут **две** формы: `AppointmentSheet` (1307 строк, work) и `PersonalEventSheet` (480 строк, personal, v454+). Они разъехались по UX и копи: жёсткий focus outline в Hero, статусные карточки Push/Повтор тратят высоту, нет presets, нет smart-defaults. Дублирование = двойная стоимость каждой будущей фичи. До раскатки personal calendar на других тенантов нужно сшить формы в одну.

## Acceptance criteria

1. `AppointmentSheet.tsx` (`components/appointment/`) и `PersonalEventSheet.tsx` (`components/calendar/`) удалены. Везде `EventSheet`.
2. На вкладке «Личный» tap на пустой слот открывает `EventSheet` в `mode='create'`, `defaultKind='event'`. На вкладке «Работа» — `defaultKind='work'`.
3. В `mode='create'` toggle «Личное · Работа» в top-bar переключает `kind` без потери совместимых полей (`title`, `time_start`, `time_end`, `date`).
4. В `mode='edit'` toggle **скрыт**, вместо него статичный badge с текущим kind в top-bar.
5. 6 системных preset-ов (Звонок 📞 15м, Встреча 🤝 1ч, Работа 💼 2ч, Обед 🍽️ 1ч, Тренировка 💪 1.5ч, Дорога 🚗 30м) видны строкой при `kind='event'`. Тап → автозаполнение `title`, `color`, `time_end = time_start + duration`, `event_push_offset_min`.
6. Раздел «Шаблоны событий» в `/dashboard/settings/templates` позволяет CRUD кастомных пресетов.
7. Кастомные пресеты появляются в строке после системных в порядке `sort_order`.
8. Кастомные пресеты приватные per-user (RLS через `created_by = auth.uid()`).
9. Hero card (title input) — без жёсткого focus outline; фокус только меняет caret + цвет текста.
10. Save справа сверху, дизейблится при пустом title (для `kind='event'`) или отсутствии client/service (для `kind='work'`); под disabled — hint курсивом.
11. Push (🔔) и Повтор (🔁) в одну строку в expanded-mode; тап → bottom-sheet picker.
12. Виртуальная клавиатура iOS не накрывает кнопку Save (Save sticky в top-bar).
13. Layout проверен на iPhone SE (375×667) — нет горизонтального скролла; preset chips имеют `overflow-x-auto + snap-x`.
14. `npx tsc --noEmit` зелёный, `npx eslint src` без новых предупреждений.

## Architecture

### Component contract

```ts
type EventKind = 'work' | 'event';

interface EventSheetProps {
  open: boolean;
  mode: 'create' | 'edit';
  defaultKind: EventKind;
  initialDate?: string;        // YYYY-MM-DD
  initialTime?: string;        // HH:MM
  initialTeamId?: string | null;
  initialMasterId?: string | null;
  appointment?: AppointmentRow; // database.types Row, не ad-hoc
  onClose: () => void;
  onSaved: (apt: AppointmentRow) => void;
  onDeleted?: (id: string) => void;
}
```

`AppointmentRow` импортируется из `@babun/shared/db/database.types` — когда добавим колонку, типы автоматически догонят.

При переключении `kind` сохраняются общие поля: `title`, `dateTime`, `allDay`, `notes`. Kind-specific (payments / photos / client / service / push / repeat) теряются с тостом.

В `mode='edit'` toggle не показывается; вместо него `<Badge>{kind === 'work' ? 'Работа' : 'Личное'}</Badge>` в центре top-bar.

### Файлы

| Файл | Действие | Заметки |
|---|---|---|
| `babun-crm/apps/web/src/components/calendar/EventSheet.tsx` | Create | ~400 строк, оркестрация |
| `babun-crm/apps/web/src/components/calendar/EventPresetChips.tsx` | Create | h-scroll, system+custom |
| `babun-crm/apps/web/src/components/calendar/EventTimePicker.tsx` | Create | Date+time bottom sheet |
| `babun-crm/apps/web/src/components/calendar/EventColorPicker.tsx` | Create | 8 dots inline + «ещё» → `ColorPickerModal` |
| `babun-crm/apps/web/src/components/calendar/EventPushPicker.tsx` | Create | Bottom sheet: Нет / 0 / 5 / 15 / 30 / 60 / 1 день |
| `babun-crm/apps/web/src/components/calendar/EventRepeatPicker.tsx` | Create | Bottom sheet: Нет / День / Неделя / Месяц / Год |
| `babun-crm/apps/web/src/lib/eventPresets.ts` | Create | 6 системных + helper `applyPreset` |
| `babun-crm/apps/web/src/lib/eventTemplates.ts` | Create | Supabase CRUD + типы |
| `babun-crm/apps/web/src/app/dashboard/settings/templates/page.tsx` | Create | List + add + edit + delete |
| `babun-crm/apps/web/src/app/dashboard/settings/page.tsx` | Modify | Ссылка «Шаблоны событий» |
| `babun-crm/apps/web/src/app/dashboard/page.tsx` | Modify | Замена двух sheet-импортов на один EventSheet, удаление дубля create+edit |
| `babun-crm/apps/web/supabase/migrations/20260509_001_event_templates.sql` | Create | Таблица + RLS + индексы + grants + 2 trigger-а |
| `babun-crm/packages/shared/src/db/database.types.ts` | Modify | Регенерация после миграции |
| `babun-crm/packages/shared/src/common/utils/version.ts` | Modify | `BUILD_VERSION = "v460-event-sheet"` |
| `babun-crm/apps/web/public/sw.js` | Modify | `CACHE_VERSION = "babun-v460"` |
| `babun-crm/apps/web/src/components/appointment/AppointmentSheet.tsx` | Delete | После grep на оставшиеся импорты |
| `babun-crm/apps/web/src/components/calendar/PersonalEventSheet.tsx` | Delete | После grep на оставшиеся импорты |
| `docs/stories/STORY-056.md` | Create | Этот файл |

### Schema (per-user, без master_id)

```sql
-- supabase/migrations/20260509_001_event_templates.sql
CREATE TABLE public.event_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  emoji           text CHECK (emoji IS NULL OR length(emoji) <= 8),
  color           text NOT NULL,                                -- hex (#RRGGBB)
  duration_min    int  NOT NULL CHECK (duration_min BETWEEN 5 AND 1440),
  push_offset_min int  CHECK (push_offset_min IS NULL OR push_offset_min BETWEEN 0 AND 1440),
  sort_order      int  NOT NULL DEFAULT 0,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX event_templates_tenant_creator_sort_idx
  ON public.event_templates (tenant_id, created_by, sort_order);

ALTER TABLE public.event_templates ENABLE ROW LEVEL SECURITY;

-- BEFORE INSERT: auto-fill created_by (паттерн из STORY-055)
CREATE OR REPLACE FUNCTION public.set_event_template_created_by()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_event_templates_set_created_by
  BEFORE INSERT ON public.event_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_event_template_created_by();

-- BEFORE UPDATE: bump updated_at (без extension, универсально)
CREATE OR REPLACE FUNCTION public.touch_event_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_event_templates_touch_updated_at
  BEFORE UPDATE ON public.event_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_event_template_updated_at();

-- RLS: per-user privacy
CREATE POLICY event_templates_select ON public.event_templates FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id() AND created_by = auth.uid());

CREATE POLICY event_templates_insert ON public.event_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (created_by IS NULL OR created_by = auth.uid())
  );

CREATE POLICY event_templates_update ON public.event_templates FOR UPDATE
  TO authenticated
  USING      (tenant_id = public.current_tenant_id() AND created_by = auth.uid())
  WITH CHECK (tenant_id = public.current_tenant_id() AND created_by = auth.uid());

CREATE POLICY event_templates_delete ON public.event_templates FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id() AND created_by = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_templates TO authenticated;
```

### Системные пресеты (хардкод, не в БД)

```ts
// lib/eventPresets.ts
export const SYSTEM_PRESETS: EventPreset[] = [
  { id: 'sys.call',     name: 'Звонок',     emoji: '📞', color: '#3B82F6', durationMin: 15,  pushOffsetMin: 5 },
  { id: 'sys.meeting',  name: 'Встреча',    emoji: '🤝', color: '#10B981', durationMin: 60,  pushOffsetMin: 15 },
  { id: 'sys.work',     name: 'Работа',     emoji: '💼', color: '#6366F1', durationMin: 120, pushOffsetMin: 15 },
  { id: 'sys.lunch',    name: 'Обед',       emoji: '🍽️', color: '#F59E0B', durationMin: 60,  pushOffsetMin: null },
  { id: 'sys.workout',  name: 'Тренировка', emoji: '💪', color: '#EF4444', durationMin: 90,  pushOffsetMin: 30 },
  { id: 'sys.commute',  name: 'Дорога',     emoji: '🚗', color: '#6B7280', durationMin: 30,  pushOffsetMin: null },
];
```

### Compact mode

```
┌─────────────────────────────────────────────┐
│  ✕    [ Личное · Работа ]    ✓ Save        │
│  Название события                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━                │
│  ● ● ● ● ● ● ● ● + ещё                     │
│  📅 9 мая · 15:30 → 16:00 (30 мин)   ›    │
│  ⊙ Весь день                          ⃝   │
│  [📞 Звонок 15м] [🤝 Встреча 1ч] [💼…] →  │
│           ⌃ Больше деталей                  │
└─────────────────────────────────────────────┘
```

### Expanded mode

```
│  Заметка (auto-grow textarea)              │
│  📍 Место (адрес)                  🗺      │
│  🔗 Ссылка                            ⤴   │
│  🔔 Push: 15 мин   |   🔁 Повтор: Нет     │
│           ⌄ Свернуть                       │
```

### Work-mode (гибрид)

`client / service / master` — compact-row в стиле time-row. Тап → существующие `ClientPickerSheet` / `ServicePickerSheet` / `TeamPickerSheet`. `payments / photos / discount` — без изменений, через существующий `FinanceSheet`. AppointmentSheet НЕ переписываем построчно, а оркестрируем заново в EventSheet.

## Out of scope (V2)

- Toggle системных пресетов (hide built-ins)
- Autocomplete title из истории
- Smart push/duration по типу
- Привязка клиента к event
- Сохранённые места
- Conflict detection
- Поделиться событием
- Drag-sort пресетов в Settings (V2.1)
- Emoji-picker для кастомных (V2 — пока emoji-input текстовый)

## Risks

1. **AppointmentSheet 1307 строк → orchestration replay в EventSheet 400 строк.** Митигация: гибрид — тяжёлые модалы (FinanceSheet, ClientPicker и т.д.) не трогаем; оркестрируем поверх. Smoke-test на staging с реальным appointment.
2. **iOS keyboard + Save sticky top-bar.** Тестируем на real device. Fallback — `interactive-widget=resizes-content`.
3. **Toggle `kind` в edit-mode** — намеренно скрыт, чтобы не путать с payments-логикой work-записи.
4. **moddatetime** не используем — обычный trigger BEFORE UPDATE на `updated_at`. Универсально.
5. **EventColorPicker dot row + ещё** — переиспользуем `ColorPickerModal` для full picker, dots row inline.
6. **Stray imports после удаления.** После удаления `AppointmentSheet`/`PersonalEventSheet` прогоняем `grep -rn "AppointmentSheet\|PersonalEventSheet" babun-crm/apps/web/src` — закрываем всё.
7. **Migration block by hook on prod.** Если `mcp__supabase__apply_migration` упрётся в хук — сообщаем Артёму, он передаст другой сессии Claude через Claude.ai.
8. **Generate types** требует Supabase MCP. Если недоступно — запросить у Артёма.

## Verification plan

1. `npx tsc --noEmit`
2. `npx eslint src`
3. Apply migration → `mcp__supabase__list_tables` → проверка `event_templates` колонок и RLS.
4. Smoke:
   - Tab «Работа» → tap слот → kind=work → выбрать клиента+услугу → Save → запись.
   - Tab «Личный» → tap слот → kind=event → ввести title → Save → запись.
   - Preset «Звонок» → title/duration/push заполнены.
   - Settings → Шаблоны событий → создать «Йога 🧘 60м» → вернуться → новый chip есть.
   - Edit-mode → toggle скрыт, badge показан.
   - Master B login → не видит кастомных пресетов Master A.
5. Lighthouse mobile: no regressions on `/dashboard`.
6. Bump versions + commit + push в `claude/unified-eventsheet-67sPQ`.

## Build order

1. STORY file (this) → migration → types → lib (presets/templates) → pickers → EventSheet → settings page → dashboard wiring → grep+delete legacy → bump versions → push.
