# Babun2 — свежий аудит после Sprint 031

**Дата:** 2026-04-22
**Билд:** v226-tg-release (Sprint 031 Phase 11, commit aa18f78)
**Метод:** обход в Chrome (390×844 мобильный, iPhone-like), Lighthouse mobile, typecheck + eslint, чтение кода.
**Persona:** диспетчер AirFix на скутере в Кипре, iPhone PWA, +35 °C на солнце.

Это **не** замена существующему [UX_AUDIT.md](../UX_AUDIT.md) от 20 апреля — это проверка, что изменилось после редизайна Telegram-style (Sprint 031), плюс то, что ловится только в рантайме.

---

## TL;DR

**Хорошее:**
- Telegram-редизайн доведён до 11 фаз. Визуально цельно: light + dark темы, токены, colored tiles, pill-кнопки — всё на месте.
- `npx tsc --noEmit` — **0 ошибок**.
- Lighthouse mobile: **Best Practices 100, SEO 100, Accessibility 89**.
- **Стабы из прошлого аудита удалены:** orphan toggles в Настройках, блок «Сверка кассы — в следующем обновлении» (теперь реальные числа: «В кассе должно быть +€2 485»). Login форма теперь уважает Supabase-режим (когда он включён — реальная аутентификация).
- Консоль чистая на прогулке (один file:// 404 от Lighthouse-отчёта — не про код).
- Stories docs/stories/STORY-001 (Supabase) уже в коде: `@supabase/ssr`, `@supabase/supabase-js`, `SupabaseProvider.tsx`, `lib/supabase/import.ts` (367 строк импорта).

**Плохое (требует атаки):**
- **eslint: 42 errors + 28 warnings** — в основном React-19 правила (`react-hooks/set-state-in-effect`, `Cannot call impure function during render`, `Cannot access refs during render`). `npm run lint` красный.
- **FAB «+ новая запись» только на desktop** (`hidden lg:flex`). На 390 viewport мобилке **нет** ни FAB-а, ни центральной `+` в BottomTabBar. Комментарий в `dashboard/page.tsx:1131` врёт: «mobile uses the centre action in BottomTabBar». Комментарий в BottomTabBar говорит, что FAB **удалён** в Sprint 027-hotfix. Мобильный путь к созданию записи: только тап по пустой ячейке календаря, либо «Ещё» → sidebar → … (но «создать» в sidebar-е тоже нет).
- **Lighthouse: 3 accessibility-фейла** — color-contrast (hour labels `text-[11px]`, header button), label-content-name-mismatch, meta-viewport user-scalable=no.
- **window.confirm() всё ещё в 8 файлах** (masters, teams, services, close-day, sms-templates, recurring, ServiceRow, AdminActions) — при том что `components/ui/ConfirmProvider.tsx` **существует**. Раскатка не завершена.
- **Микротипографика < 11px** — всё ещё 7× `text-[9px]`, 2× `text-[8px]`, 43× `text-[10px]` в UI (FinanceTabs KPI labels, TimeGrid hour labels, service chips, tag badges, today-circle number в Header). На солнце на iPhone — нечитаемо.
- **Touch targets < 44px** на главных кнопках шапки календаря: Меню 40×40, «Сегодня» 40×40, «Вид» 40×40, brigade tabs 181×32.
- **Chats page** всё ещё без PageHeader / back-кнопки (UX_AUDIT P0 — не закрыт).
- **404 на `/dashboard/appointment/new`** — страница удалена (форма теперь in-page sheet), но ни один редирект не настроен. Любая старая закладка / share-ссылка → 404.

---

## Что закрылось со Sprint 031

Сверяя с UX_AUDIT от 2026-04-20:

| # (из UX_AUDIT) | Было | Сейчас | Статус |
|--|--|--|--|
| #9 | 4 orphan toggle на `settings/page.tsx` (шрифт записей / 12h / …) | Удалены | ✅ closed |
| #10 | «Сверка кассы — в следующем обновлении» | Живые числа (+€2 485 в кассе) | ✅ closed |
| #6 | login фейковый | Теперь уважает Supabase — если env-переменные живые, реальная auth; иначе всё равно bypass. Частично. | 🟡 partial |
| #19 (design tokens) | Нет docs/design-system.md | Нет, но CSS-переменные `--accent`, `--surface-*`, `--label-*` в `globals.css` фактически работают как token-слой | 🟡 unofficial |
| Sprint 031 Telegram | — | 11 фаз, bump v215→v226, `theme_color=#3E88F7`, colored tiles, pill buttons, ListGroup/ListRow | ✅ done |

---

## Новые/подтверждённые находки (приоритизированные)

### 🔥 P0 — ship-блоки или ежедневная боль

1. **Нет способа создать запись с мобилы кроме тапа по пустой ячейке**
   [BottomTabBar.tsx:24-26](../../../babun-crm/apps/web/src/components/layout/BottomTabBar.tsx#L24-L26) декларирует «+ FAB removed, create starts from grid or from Ещё → создать», но Ещё открывает Sidebar, где пункта «создать» нет. [dashboard/page.tsx:1130-1137](../../../babun-crm/apps/web/src/app/dashboard/page.tsx#L1130-L1137) ставит FAB как `hidden lg:flex`.
   **Фикс:** либо вернуть FAB на мобилке (`fixed bottom-24 right-4` над BottomTabBar + safe-area), либо реально сделать пункт «Новая запись» в Sidebar / CreateMenu и повесить на «Ещё»-long-press.

2. **`/dashboard/appointment/new` → 404**
   Путь был в architecture.md, удалён при редизайне без редиректа. Сломаны закладки и share-ссылки.
   **Фикс:** добавить в `next.config.ts` redirect `/dashboard/appointment/new → /dashboard?new=1`, и в dashboard ловить `?new=1` → открыть AppointmentSheet. 5 строк.

3. **eslint красный (42 errors)**
   Большинство — `react-hooks/set-state-in-effect` (React 19 правило) в `SupabaseProvider`, `useMediaQuery`, `WeekView`, `SwipeableCalendar`, `AppointmentSheet`, и ещё ~30 местах. Плюс несколько `Cannot call impure function during render` и `Cannot access refs during render` — это уже риск (в Concurrent Rendering может дать двойные вызовы).
   **Фикс:** одним PR — либо прогнать `--fix` (4 авто-чинятся), либо переписать useEffect-ы: вместо `if (cond) setX(true)` использовать `useSyncExternalStore` / derive в рендере / `useMemo`. Это не косметика — React 19 в Strict Mode может ломать UI.

4. **Lighthouse a11y = 89 (3 фейла)**
   - `color-contrast` — hour labels `text-[11px]` на `--label-tertiary` не проходят WCAG AA; header button иконки тоже слабые
   - `label-content-name-mismatch` — где-то div с visible text имеет неподходящий `aria-label`
   - `meta-viewport` — `user-scalable=no` (осознанное решение ради pinch-zoom календаря, но Lighthouse не знает). Можно подавить audit или добавить `user-scalable=yes, maximum-scale=5` в основном manifest и отдельный override на `/dashboard`.

5. **window.confirm() всё ещё в 8 файлах**
   `masters`, `teams`, `services`, `close-day`, `sms-templates`, `recurring`, `ServiceRow`, `AdminActions` — при живом `ConfirmProvider`. На iOS PWA нативный confirm выглядит как системный алерт с URL в заголовке = ломает ощущение «нативного приложения».
   **Фикс:** sed по `window.confirm` → `confirm()` из `useConfirm()` + удалить native. Один PR.

### 🚧 P1 — частая боль, одна смена

6. **Микротипографика < 11px** (UX_AUDIT #16 не закрыт)
   - `text-[9px]` — 7 мест: `FinanceTabs.tsx:420` (KPI labels), `TimeGrid.tsx:23` (hour labels), `services/page.tsx:145` (tag chips), `Header.tsx:154` (today-circle «22»)
   - `text-[8px]` — 2 места, оба в календаре
   - `text-[10px]` — 43 места: BottomTabBar labels, finance percentDelta, ClientPanel счётчики, Sidebar version, TodayGlance accent headers
   **Фикс:** поднять floor до 11px для tabular/label-tertiary, 12px для обычных надписей. Исключение только `text-[10px]` в badge-counters (16×16 circle). Grep-based migration.

7. **Touch targets 40×40 на critical actions**
   - `Header.tsx` hamburger «Меню»: 40×40
   - «Сегодня, 22»: 40×40
   - «Вид: День»: 40×40
   - Brigade tabs (`Юра + Даня · Пафос`): 181×**32**
   Apple HIG: 44×44 min. Диспетчер в перчатке на солнце промахнётся.
   **Фикс:** `h-11 min-w-[44px]` на эти три круглые кнопки; brigade tabs `h-11 py-2.5`.

8. **Chats page без back-кнопки** (UX_AUDIT P0 — не закрыт)
   [chats/page.tsx](../../../babun-crm/apps/web/src/app/dashboard/chats/page.tsx) не использует `PageHeader`, только StaticText «Чаты (2)». Если пользователь попал через deeplink (/dashboard/chats открыт в новой вкладке) — тупик.
   **Фикс:** обернуть в `<PageHeader title="Чаты" />` как все остальные страницы.

9. **Filter bar в Чатах скроллится горизонтально** (scrollWidth 603 vs clientWidth 390 на 390 viewport)
   6 табов «Все (4) · Без ответа (2) · WhatsApp · Instagram · Telegram · SMS» — пользователь не видит, что есть Telegram/SMS, без горизонтальной прокрутки. Нет fade-mask индикатора.
   **Фикс:** добавить fade-маску справа через `mask-image: linear-gradient(to right, black 85%, transparent)`, или сделать pill-row шире с `scroll-snap`.

10. **Sidebar всегда в DOM (off-screen `left: -280`)**
    На мобилке (390×844) `<aside>` занимает 280×844 и держит состояние — 7 навигационных кнопок + email + версия. Для разовой замены на `<aside hidden>` при `!open` — экономия ~5 hydration-шагов и несколько листенеров.
    **Фикс:** conditional-render Sidebar content, не просто translate. Минорный win.

### 💅 P2 — полировка

11. **Month button «Апрель2026»** без пробела между словом и годом. [dashboard](http://localhost:3000/dashboard) button text = `Апрель2026`. Копипаст-глитч от sprint 031.

12. **PWA InstallPrompt показывается на первом заходе** без cooldown. Уже на /login и /dashboard обе. Если пользователь закрыл — должен не появляться минимум сутки.

13. **Нет индикатора версии на мобилке** — `v226-tg-release` чип есть только в Sidebar. На мобильном экране непонятно, какая версия живёт (CLAUDE.md требует видимый BUILD_TAG). Актуально для отладки по скриншотам.

14. **Sidebar drawer 280px на iPhone 14 (390 wide)** — остаётся полоса 110px справа, но она прозрачная и не кликается. Можно либо сделать drawer 85% ширины, либо добавить visible backdrop с close-on-tap.

15. **tabular-nums missing в суммах** — `€3 550`, `€2 485` в finances — monospace только из-за цифр, но без `tabular-nums` кнопки на разных суммах «прыгают» шириной. `app/dashboard/finances/page.tsx:321` использует `tabular-nums`, но остальные KPI — нет.

---

## Техническое состояние

| Метрика | Значение | Порог | Вердикт |
|--|--|--|--|
| `npx tsc --noEmit` | 0 errors | 0 | ✅ |
| `npx eslint src` | 42 errors + 28 warnings | 0 errors | ❌ |
| Lighthouse Accessibility | 89 | 90+ | 🟡 |
| Lighthouse Best Practices | 100 | 90+ | ✅ |
| Lighthouse SEO | 100 | 90+ | ✅ |
| Console errors (dev) | 0 (кроме Lighthouse file://) | 0 | ✅ |
| Network errors | 0 | 0 | ✅ |
| Bundle — крупные файлы | `dashboard/page.tsx` 1235, `ClientPanel.tsx` 1177, `AppointmentSheet.tsx` 1176, `MasterSheet.tsx` 1138 | max 400 (CLAUDE.md) | ❌ 4 файла > 1000 строк |
| `any` в коде | — | запрещено | не проверял в этом заходе |

### Файлы, превышающие лимит 400 строк (Golden Rule #7)

```
1235  src/app/dashboard/page.tsx                          ← 3× лимит
1177  src/components/clients/ClientPanel.tsx              ← 2.9× лимит
1176  src/components/appointment/AppointmentSheet.tsx     ← 2.9× лимит
1138  src/app/dashboard/masters/MasterSheet.tsx           ← 2.8× лимит
 929  src/app/dashboard/chats/page.tsx                    ← 2.3× лимит
 865  src/components/clients/ClientProfileView.tsx        ← 2.2× лимит
 820  src/lib/masters.ts                                  ← 2× лимит
 745  src/app/dashboard/layout.tsx                        ← 1.9× лимит
 690  src/app/dashboard/services/page.tsx                 ← 1.7× лимит
 582  src/lib/appointments.ts                             ← 1.5× лимит
```

Не горит — но CLAUDE.md чёткий: «Максимум 400 строк на компонент». Это 10 нарушений, причём `dashboard/page.tsx` растёт (был 862 на момент UX_AUDIT).

---

## Рекомендованный план (3 PR-а)

### PR 1 — «dev hygiene» (1 день, низкий риск)
- Починить 42 eslint errors (в основном `set-state-in-effect` → `useSyncExternalStore` или derive-в-рендере)
- Убрать неиспользованные warnings (`onBack`, `hasDebt`, `cityBg`, `recenter`, `_onPrevWeek`...)
- Добавить redirect `/dashboard/appointment/new → /dashboard?new=1`
- Починить `Апрель2026` → `Апрель 2026`

### PR 2 — «мобильный онбординг» (2 дня)
- Вернуть mobile FAB либо пункт «Новая запись» в Ещё/Sidebar (выбрать один паттерн)
- Touch targets на header календаря (44 min)
- PageHeader в Чатах
- Микротипографика ≥ 11px по grep-листу выше
- Ещё-drawer conditional-render
- Fade-mask на chat filters

### PR 3 — «ConfirmProvider rollout» (1 день)
- Заменить 8 файлов с `window.confirm()` на `useConfirm()`
- Унифицировать destructive-паттерн (undo-toast для undoable + modal confirm для destructive)

### Долг

- Разбить `dashboard/page.tsx`, `ClientPanel.tsx`, `AppointmentSheet.tsx`, `MasterSheet.tsx` на sub-components по 400 строк. Это отдельная story — не спринт, а рефакторинг по ходу.

---

## Screenshots

- [01-login.png](01-login.png) — Telegram-style login
- [02-dashboard-390.png](02-dashboard-390.png) — Calendar day view, 390×844
- [03-clients.png](03-clients.png) — Clients list, grouped
- [04-finances.png](04-finances.png) — Finances (full page)
- [05-chats.png](05-chats.png) — Chats (no PageHeader)
- [06-settings.png](06-settings.png) — Settings grouped list
- [07-services.png](07-services.png) — Services catalog
- [08-drawer-native.png](08-drawer-native.png) — Sidebar drawer open
- [09-appointment-new.png](09-appointment-new.png) — 404 на /dashboard/appointment/new
- [10-dashboard-dark.png](10-dashboard-dark.png) — Dark mode dashboard

## Исходный UX_AUDIT

[docs/audit/UX_AUDIT.md](../UX_AUDIT.md) — 2026-04-20, ≈130 findings по 6 осям, плюс топ-20. Этот документ сверяется с ним и фиксирует, что закрылось/осталось.
