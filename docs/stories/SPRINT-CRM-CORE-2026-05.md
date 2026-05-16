---
name: SPRINT-CRM-CORE-2026-05
status: in_progress
started: 2026-05-16
brief: "Спринт #3 «CRM Core» — синхронизация ядра CRM"
---

# Sprint #3 — CRM Core (55-item brief → status map)

Triage of the user's 55-item brief from 2026-05-16. Each item is mapped to one
of: **DONE** (already shipped), **READY** (ships this sprint, localStorage-era),
**BLOCKED** (waits for Supabase / an existing STORY-NNN), or **DROP** (reject
or rescope). Goal of this doc: never re-discuss an item — point at this map.

## Guiding principles (from brief)
1. Money never disappears — completed+paid appointment → finance row.
2. Service hierarchy — Client → Object → Equipment → Service history.
3. One source of truth — SMS templates, master role, owner ≠ master.
4. No "coming soon" labels for missing functionality. Build or remove.
5. Safe deletes — always confirm, always show dependencies.

---

## 🔴 P0 — 20 items

| # | Topic | Status | Notes |
|---|-------|--------|-------|
| 1 | Client card `overflow-y: hidden` → auto + sticky header/footer | READY | Audit `ClientCardPage`/`ClientProfileView`. Use `max-h-[90vh]` + scrollable middle. |
| 2 | Client card load skeleton | **DONE** | Commit `38eb9fe` — replaces «не найден» flash with skeleton. |
| 3 | `+` Add-client button reacts on first tap (overlay leak) | READY | `CreateClientModal` exit transition leaves `pointer-events: auto` on root. Fix with `inert` + transition cleanup. |
| 4 | Дубль услуги в Активности клиента (DISTINCT join) | BLOCKED → STORY-042 | localStorage join already de-dupes; bug is Supabase-only. |
| 5 | «Мастер:» vs «Команда:» в Активности | **DONE** | Commit `03dddac` — truthful crew label. |
| 6 | Единая `<ObjectForm />` для `/clients/new` + карточки | READY | Extract from `LocationEditor` + `InlineLocationForm`. Reference `equipment_types` from settings dictionary (already exists). |
| 7 | Календарь рисует appointments всех бригад (фильтр чипа) | READY | Audit `useCalendarEvents`. Filter must include `team_id ∈ visibleTeams`, не требовать `master_id`. |
| 8 | Конфликт чипов «Мой календарь» + «Бригада» → диалог выбора | READY | Tri-button mini-dialog. Persist `last_choice` in `localStorage:babun-tap-default`. |
| 9 | Тип «Выезд в офис» во всех формах (event_types не хардкод) | READY | Pull list from existing `event-types.ts`; remove the inline arrays in create-event sheets. |
| 10 | CSV import — реализовать ИЛИ убрать оба входа | BLOCKED → STORY-046 | Story already scoped. Until shipped: hide the banner + header button (READY part). |
| 11 | Публичная страница `/book/[slug]` | BLOCKED → STORY-045 | Landing+booking story. Out of localStorage scope. |
| 12 | 404 CTA «Открыть клиентов» → «На главную сайта» | **DONE (working tree)** | `not-found.tsx` already rewritten; commit pending. |
| 13 | Auto-sync appointment → finance_transaction | BLOCKED → STORY-042 | DB triggers + unique constraint on `appointment_id`. |
| 14 | `payment_status` + `payment_method` + `paid_amount` columns | BLOCKED → STORY-042 | Schema is in this doc § DB schema. |
| 15 | Manual FAB → bottom-sheet «Новая транзакция» | READY | localStorage version using extra-income+expense stores. Connects to Supabase later. |
| 16 | Категории доходов (2nd tab) | **DONE (working tree)** | `FinanceTabs.tsx` + `income-categories.ts` in working tree. |
| 17 | «Подключить канал» на `/chats` | BLOCKED → STORY-047 (WA), STORY-048 (Realtime) | Integration page already a stub (commit `e7579ec`). |
| 18 | Привязка чатов к клиентам по phone/handle | BLOCKED → STORY-047 | Backend feature. |
| 19 | Manual reminder `+` button + create form | READY | `recurring` list page exists; add FAB + sheet. Persist in `babun-reminders` until STORY-050. |
| 20 | Master role = position-in-team (1 поле, не 2) | READY | Tighten `lib/masters.ts`: drop separate `position`, use `role_id` everywhere. Migrate stored objects on load. |

## 🟡 P1 — 15 items

| # | Topic | Status | Notes |
|---|-------|--------|-------|
| 21 | «Babun App» убрать из списка мастеров | READY | Filter out `owner_id` row in `/masters`. Owner already on `/settings/team`. |
| 22 | Action-bar показывать только при выборе | **DONE (already gated)** | Audit `app/dashboard/clients/page.tsx`: per-row [Закрепить/Записать/Напомнить/Удалить] live inside `<SwipeableRow>` (swipe-gated); bulk bar [Выбрать всех/SMS/Удалить] is wrapped in `{isSelecting && …}`. Brief was written against older state. |
| 23 | Status badges в форме `/clients/new` | READY | Reuse `ClientStatusBadges` in editable mode in create form. |
| 24 | Источник заявки на create клиента | **DONE** | Commit `d8cea33` adds it to appointment create. Client-create parity → still READY (small). |
| 25 | Город — справочник, не свободный текст | READY | Use `cities` dict from settings (exists). Auto-suggest brigade by city. |
| 26 | Phone placeholder из `tenant.country_code` | READY | Read `tenant-settings` → derive default prefix. Currently hardcoded `+357`. |
| 27 | Карта в адресе объекта (Google Places) | DROP-for-now | Needs API key + billing. Defer to Supabase era. |
| 28 | Графики в Финансах (Recharts) | BLOCKED → STORY-044b (analytics) | Story exists. |
| 29 | Экспорт CSV/XLSX/PDF | READY (CSV only) | XLSX/PDF defer. CSV is 30 lines for clients + finances. |
| 30 | Per-master зарплата + «Выплатить» | BLOCKED → STORY-057 | Needs payroll closure period in Supabase. |
| 31 | Произвольный период во всех отчётах | READY | Date-range picker already exists in some places; standardize. |
| 32 | `/finances/debts` раздел | READY | Already partly in `FinanceTabs.DebtsTab`. Promote to own route with sort + bulk action. |
| 33 | CSV import flow | BLOCKED → STORY-046 | Same as #10. |
| 34 | `source` per-appointment | READY (already partial) | `appointments.source` already added per `d8cea33`. Make sure all forms surface it. |
| 35 | Touch-only gesture hint | **DONE** | Commit `12d5f85` — desktop-aware. |

## 🟢 P2 — 10 items

| # | Topic | Status | Notes |
|---|-------|--------|-------|
| 36 | «жена/мужа» → «контакт супруга/арендатора/помощника» | **DONE (109a158)** | PHONE_LABEL_OPTIONS + hint copy switched to «Супруг(а) / Арендатор / Помощник» fitting service-business context. |
| 37 | «1 новый в май» → «в мае» | **DONE (109a158)** | Added `getMonthNamePrepositional` helper (Intl returns nominative; prepositional table required for «в …»). |
| 38 | «SMS» chip в фильтре чатов — убрать | **DONE (2fc4788)** | Dropped from filter list. Legacy sms-channel chats still surface under «Все». |
| 39 | «Удалить» в SMS-template create | **DONE (2fc4788)** | `mode` prop on TemplateEditor, derived in parent from `templates.some(t => t.id === editing.id)`. |
| 40 | Пресеты SMS-шаблонов | READY | Add 4 starter templates in empty state. |
| 41 | Переменные SMS на русском | **DONE (2fc4788)** | Palette switched to `[Имя]/[Дата]/[Время]/[Мастер]/[Услуга]/[Адрес]/[День]` + new `[Цена]/[Компания]/[СсылкаНаОтмену]`. Backward-compat via `TOKEN_ALIASES` map; renderTemplate regex now Unicode-aware. |
| 42 | Тестовая отправка SMS | BLOCKED → STORY-047 | Needs SMS provider. |
| 43 | «Сохраняем... / Сохранено ✓» — one state at a time | READY | Reducer `idle / saving / saved / error`. |
| 44 | «Удалить сотрудника» → «⋮» в шапке | READY | Move into kebab menu with confirm + dependency count. |
| 45 | Подписи под €0/€150/€150 в Активности | READY-partial | Already labelled in latest commit. Add tooltips. |

## 🆕 Beta — 10 items

| # | Topic | Status |
|---|-------|--------|
| 46 | Таб «Покупки/Заказы» в карточке клиента | BLOCKED → after STORY-042 |
| 47 | Таб «Финансы» в карточке клиента (LTV) | BLOCKED → after STORY-042 |
| 48 | Таб «История обслуживания» на объекте | BLOCKED → after STORY-042 |
| 49 | Equipment service schedule + auto-reminders | BLOCKED → after STORY-050 |
| 50 | Webhooks для разработчиков | BLOCKED → backend story (new) |
| 51 | Документы мастера | BLOCKED → after STORY-049 (photos storage) |
| 52 | Рейтинг мастера через post-visit SMS | BLOCKED → STORY-047 |
| 53 | Программа лояльности | BLOCKED → after STORY-042 |
| 54 | Маршрут дня (Google Maps) | DROP-for-now (billing) |
| 55 | AI-ассистент «спроси у Babun» | BLOCKED → STORY-010 (roadmap) |

## DB schema additions (brief § «Database schema добавления»)

All schema is captured in:
- `STORY-042` — `payment_status / payment_method / paid_amount` on `appointments`,
  `finance_transactions`, `finance_categories`.
- `STORY-046` — CSV import staging tables.
- `STORY-050` — `recurring_reminders` extensions (`type`, `manual`,
  `notify_channel`).
- New mini-story (TBD) — `client_objects`, `equipment_units`, `equipment_types`.
- New mini-story (TBD) — `online_booking_settings` (called for #11/STORY-045).
- New mini-story (TBD) — `webhooks` (called for #50).

Do **not** apply schema in this sprint. localStorage shapes mirror the brief so
the Supabase migration is mechanical.

---

## Execution batches

**Batch A — already in working tree, commit-and-ship:**
- P0 #12 (not-found CTA) — `not-found.tsx`
- P0 #16 (income categories tab) — `FinanceTabs.tsx` + `income-categories.ts`

**Batch B — UI-only, this session (shipped):**
- ✅ P2 #36 (109a158) — copy: жена/мужа → нейтральное
- ✅ P2 #37 (109a158) — «1 новый в мае» (prepositional month)
- ✅ P2 #38 (2fc4788) — drop SMS chip from chats filter
- ✅ P2 #39 (2fc4788) — hide «Удалить» when creating SMS template
- ✅ P2 #41 (2fc4788) — RU SMS variables (`[Имя]` etc.)
- ✅ P1 #22 — already gated in code (no commit needed)

**Batch B remainder — deferred:**
- P1 #21 — strip owner from `/masters` (parallel session has masters/[id]/access WIP)
- P2 #43 — single-state save indicator (cross-cutting; needs own pass)
- P2 #44 — kebab menu replaces bottom «Удалить сотрудника» (same parallel WIP)

**Batch C — future session, localStorage-era:**
- P0 #1 (overflow), #3 (overlay), #6 (ObjectForm), #7 (calendar team filter),
  #8 (tap-conflict dialog), #9 (event types), #15 (finance FAB), #19 (reminders FAB),
  #20 (master role unification)
- P1 #23, #25, #26, #29 (CSV export only), #31, #32, #34
- P2 #40, #45 (tooltips)

**Batch D — Supabase era:** everything else, tracked under owning STORY-NNN.

## Versioning

- Working tree already bumped `BUILD_VERSION` to `v529-settings-two-col-desktop`
  for a parallel sprint. Don't disturb.
- This sprint bumps from `v530` onwards. CACHE_VERSION on `public/sw.js`
  follows the same number.
