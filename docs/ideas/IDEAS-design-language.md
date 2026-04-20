# IDEAS — визуальный язык Babun2

Генератор идей по improve визуала без редизайна и без слома правил (violet-600 primary, center modals only, 13 px floor, phone-first).

Каждая идея — конкретная. «Где», «что», «сложность», «риск». Ничего абстрактного.

---

## 1. Тактильная «тяжесть» тапа на primary CTA

**Что именно.** Все основные кнопки (Создать, Сохранить, Записать) — при нажатии: `scale: 0.96` (150 ms, ease-out) + `haptic("tap")` + мягкая inner-shadow на active-frame. Сейчас active-состояния неравномерно распределены: некоторые кнопки вообще без feedback (см. `BottomTabBar.tsx` TabButton — только цвет, без scale).

**Где в коде.** Создать wrapper `components/ui/PressableButton.tsx` на основе `<button>`, заменить им primary-кнопки в:
- `components/appointment/AppointmentSheet.tsx` (Сохранить)
- `components/clients/CreateClientModal.tsx`
- `components/layout/BottomTabBar.tsx` (TabButton)
- `components/layout/Header.tsx` (9h × 9h кнопки)

**Сложность.** S
**Риск.** low

---

## 2. Long-press hint ripple на календарной сетке

**Что именно.** Когда пользователь тапает и держит пустой слот в `WeekView` / `DayColumn` (создание записи через long-press), вокруг пальца должна появляться расходящаяся violet-volна (300 ms, opacity 0→0.4→0) + `haptic("select")` через 250 ms, чтобы сразу понятно: «да, я зарегистрировал жест, сейчас откроется». Сейчас `AppointmentBlock` имеет long-press, но визуальной реакции нет — только внезапно открывается попап.

**Где в коде.** `components/calendar/DayColumn.tsx`, `components/calendar/AppointmentBlock.tsx` — добавить absolute-positioned `<div>` с радиальным градиентом и keyframe анимацией. В `globals.css` — `@keyframes pressRipple`.

**Сложность.** M
**Риск.** low

---

## 3. Typography hierarchy через `tabular-nums` + weight-контраст для денег

**Что именно.** В карточках клиентов/записей есть пары «доход €775 · 14 A/C · последний визит 3 дня назад». Сейчас все написано одинаковым weight-слабым слэт-серым. Правило: число дохода — `text-[17px] font-semibold tabular-nums text-slate-900`, остальное — `text-[12px] text-slate-500`. Глаз сразу находит «сколько».

**Где в коде.**
- `app/dashboard/clients/page.tsx` — рендер клиента в списке
- `app/dashboard/finances/*` — финансовые ряды
- `components/calendar/AppointmentBlock.tsx` — итоговая сумма внутри блока
- `app/dashboard/payroll/page.tsx`, `app/dashboard/expenses/page.tsx`

**Сложность.** S
**Риск.** low (только tailwind-классы)

---

## 4. Empty state = иконка + 1 строка + CTA

**Что именно.** Заменить «Нет записей» / «Пусто» на трёхчастный шаблон: outline-иконка 48 × 48 (slate-300), 1 строка объяснения (что тут обычно бывает), primary CTA (как это появляется). Сейчас найдено минимум 4 места с плоским текстом: `IncomeDialog.tsx:114`, `ExpensesDialog.tsx:116`, `ClientProfileView.tsx:252`, `sms-templates/page.tsx:92`.

Пример для финансов: «Пока ни одной оплаты · Оплаты появятся, когда бригада закроет визит · [Открыть календарь]».

**Где в коде.** Создать `components/ui/EmptyState.tsx` с props `{icon, title, hint, cta?}`, заменить строки во всех местах выше + на пустых финансовых страницах / waitlist / chats.

**Сложность.** M
**Риск.** low

---

## 5. Skeleton → content cross-fade (не pop-in)

**Что именно.** Сейчас `Skeleton.tsx` рендерится, потом резко заменяется данными (jarring). Правильно: обёртка, которая держит оба слоя 200 ms, fade-out skeleton + fade-in content одновременно. + обязательно skeleton при каждом async-лоаде `useEffect(loadClients)`, а не только на `SkeletonRow`.

**Где в коде.**
- Создать `components/ui/FadeSwap.tsx` (children vs placeholder)
- Применить в списочных страницах: `dashboard/clients/page.tsx`, `dashboard/chats/page.tsx`, `dashboard/waitlist/page.tsx`, `dashboard/expenses/page.tsx`
- Добавить в `globals.css`: `@keyframes fadeOutScale { from{opacity:1;transform:scale(1)} to{opacity:0;transform:scale(0.995)} }`

**Сложность.** M
**Риск.** med (надо не порушить hydration в Next 16 — проверить Client/Server boundary)

---

## 6. Дизайн-брендинг: литера «B» → «B」» (угловая скобка)

**Что именно.** Сейчас в `Sidebar.tsx:101-103` логотип — просто «B» в `violet-700` круге. Это читается как плейсхолдер. Не меняя форму, добавить: литера Inter ExtraBold, курсив minus-2°, и правее — тонкая `|` высотой 65% от буквы в `violet-300`. Это даёт иллюзию «монограммы» без найма дизайнера. Такой же знак — в `src/app/icon.tsx` и `apple-icon.tsx` (PWA иконка) + splash screen при открытии приложения (новый `app/loading.tsx`).

**Где в коде.**
- `components/layout/Sidebar.tsx` — замена текста «B» на `<LogoMark />` компонент
- `src/app/icon.tsx`, `src/app/apple-icon.tsx` — отрисовать тот же glyph через `next/og` ImageResponse
- Создать `components/brand/LogoMark.tsx` — единый источник

**Сложность.** S
**Риск.** low

---

## 7. Systematic иконочная система: lucide-react вместо микса

**Что именно.** Сейчас 15+ inline `<svg>` в `Header.tsx`, `BottomTabBar.tsx`, `Sidebar.tsx` + emoji в `ClientActionMenu.tsx`, `SendMessagePopup.tsx`, `AppointmentSheet.tsx` labels. Выглядит как три разных приложения в одном. Правило: **эмоджи только внутри `comment` / текста пользователя**, в UI-chrome — строго lucide-react (strokeWidth 2, 20×20 для tab bar, 18×18 для меню). Никаких inline SVG.

**Где в коде.**
- `npm i lucide-react`
- Замена во всех layout-компонентах: Calendar, Users, MessageSquare, DollarSign, Menu, ArrowLeft, Plus, Check, X, Edit, Trash
- Запретить emoji в action-labels (AppointmentSheet `✅ Выполнена` → `<Check /> Выполнена`)

**Сложность.** L (много мест, но механический)
**Риск.** med (bundle size +12 КБ, но tree-shakeable; проверить что Vercel deploy не лагает)

---

## 8. Card design: `shadow-xs` + `ring-1` вместо `border-slate-200`

**Что именно.** Сейчас белые карточки клиентов / записей с `border border-slate-200`. На кипрском солнце через PWA эта линия едва видна, карточки «растекаются». Замена: `bg-white ring-1 ring-slate-900/5 shadow-[0_1px_0_0_rgba(15,23,42,0.04)]`. Плюс на нажатие — `active:shadow-[inset_0_0_0_1px_rgba(124,58,237,0.2)]` (violet ring внутрь).

**Где в коде.**
- `app/dashboard/clients/page.tsx` (строки списка)
- `app/dashboard/expenses/page.tsx` (карточки операций)
- `app/dashboard/payroll/page.tsx`
- `components/waitlist/WaitlistDialog.tsx`
- `components/appointment/*Block.tsx` (carded blocks в AppointmentSheet)

**Сложность.** M
**Риск.** low (покрасить)

---

## 9. Auto-dark mode через `@media (prefers-color-scheme: dark)` — только для iOS Safari PWA

**Что именно.** НЕ делать ручной toggle (user memory: phone-first + simplicity). Просто добавить darkmode-branch в `globals.css` через CSS-переменные, активный только ночью в PWA. Карточка становится `slate-900` (не чёрный — чёрный режет), violet-600 остаётся primary, border → `slate-700/50`. **Не трогать AppointmentSheet и календарь** в v1 — там много edge cases со статусами-цветами. Начать с Clients + Finances + Sidebar.

**Где в коде.**
- `globals.css` — ввести `:root` + `@media (prefers-color-scheme: dark) :root` с `--bg-card`, `--text-primary`, `--border-subtle`
- Переписать Tailwind-хардкоды в 4-5 ключевых страницах на var-based классы через `bg-[var(--bg-card)]`
- `apple-icon.tsx` — проверить что иконка читается на тёмном home screen

**Сложность.** L
**Риск.** high (тестировать на реальном iPhone в PWA режиме; легко сломать цветной календарь)

---

## 10. Pro-signal: живой build-version chip + online dot в header

**Что именно.** Сейчас `BUILD_VERSION` тихо сидит в `lib/version.ts`. Выставить: в верхнем правом углу Sidebar (где `airfix.cy@gmail.com`) — `•v47` малым `text-[10px] text-violet-300`, + зелёный 6px dot с пульсацией (`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`) — «сервер живой, данные синхронизированы». Это серьёзный tool-signal для AirFix: видно, что софт реально обновляется.

**Где в коде.**
- `components/layout/Sidebar.tsx:104-107` — блок с email
- `globals.css` — `@keyframes livePulse`
- Reuse `BUILD_VERSION` из `lib/version.ts`

**Сложность.** S
**Риск.** low

---

## 11. Number morph на суммах через FLIP

**Что именно.** Когда юзер добавляет service в AppointmentSheet и итог меняется `€60 → €95`, сейчас цифры перескакивают. Нужно: цифры «проматываются» (tabular digit slides вверх/вниз, 250 ms). Уже есть `components/ui/AnimatedNumber.tsx` — но проверить что он применён **везде**, где сумма меняется реактивно: AppointmentSheet total, PayrollPage итоги, ExpensesDialog sum, ReportsDialog KPI, FinanceTabs. Это один из главных pro-signals.

**Где в коде.** Grep `formatEUR\(` — все 20+ вызовов, где значение может измениться внутри lifetime компонента, обернуть в `<AnimatedNumber value={...} />`.

**Сложность.** M
**Риск.** low

---

## 12. Onboarding: «coach marks» на первом запуске с dismiss-persist

**Что именно.** При первом открытии (checked через `localStorage.getItem("babun-onboarded")`) — полупрозрачный violet-600 overlay с 3 speech-bubble (не bottom sheet!) которые по кругу показывают: «1. Свайп вправо = следующая неделя», «2. Long-press на записи = меню», «3. Долгий тап на пустом слоте = новая запись». Каждая — по центру, `p-4 rounded-2xl bg-white shadow-2xl`, overlay `bg-violet-950/70`, кнопка «Понял» — и следующая. После 3-й — `localStorage.setItem("babun-onboarded", "1")`. Сотрудник нового мастера включил — сразу понимает основные жесты.

**Где в коде.**
- Новый компонент `components/onboarding/FirstRunCoach.tsx`
- Mount в `app/dashboard/layout.tsx` (условно через LS)
- Settings page — кнопка «Показать подсказки снова» (сбрасывает ключ)

**Сложность.** M
**Риск.** med (не вываливать это в PWA-update юзерам, которые уже работают полгода — использовать отдельный ключ по версии)

---

## 13. Spring animation на drag-drop записи в календаре

**Что именно.** Сейчас drag-and-drop (dnd-kit) в `AppointmentBlock` — CSS `translate`. При drop блок «плюхается» без physics. Добавить spring на drop-end: блок оверштуут на ±4 px и возвращается (stiffness 300, damping 25, используя Framer Motion `layout` prop или ручной `transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)`). На long-press подхват — `scale: 1.03` + тень `shadow-lg shadow-violet-500/20`, сигнал «я живой, я отрываюсь от сетки».

**Где в коде.**
- `components/calendar/AppointmentBlock.tsx:74-82` — `useDraggable` transform
- Стиль `isDragging` уже есть — расширить
- `globals.css` — `cubic-bezier` утилита `.ease-spring`

**Сложность.** M
**Риск.** med (перформанс на слабом iPhone — тестить на 8+ блоках drag'ом)

---

## 14. Status-dot language унифицировать: 6 px цветная точка перед каждым клиентским именем

**Что именно.** Сейчас метки клиента разбросаны: VIP — оранжевый chip, B2B — синий, в календаре цветные полоски слева от блока, в чате — ничего. Единая конвенция: перед именем клиента в любом списке — 6 px dot от его главного тега (если есть несколько — приоритет VIP → Проблемный → B2B → Постоянный → Новый). В списке клиентов, в календаре (рядом с client name в AppointmentBlock), в чатах. Один сигнал → пользователь за 0.2 с сканирует список.

**Где в коде.**
- Создать util `lib/client-status-color.ts` — возвращает tailwind-класс по tag_ids
- `app/dashboard/clients/page.tsx` — рядом с `full_name`
- `components/calendar/AppointmentBlock.tsx:83-88` — рядом с `clientName`
- `app/dashboard/chats/page.tsx` — в ChatRow

**Сложность.** S
**Риск.** low

---

## Приоритезация (если делать по одной)

| # | Название | Impact | Effort |
|---|----------|--------|--------|
| 3 | Typography hierarchy for money | high | S |
| 10 | Live build-version + online dot | med | S |
| 1 | PressableButton wrapper | high | S |
| 6 | Logo mark upgrade | med | S |
| 14 | Unified client status dot | high | S |
| 4 | Empty state component | high | M |
| 8 | Card shadow/ring instead of border | med | M |
| 11 | Number morph everywhere | med | M |
| 7 | lucide-react migration | high | L |
| 2 | Long-press ripple | med | M |
| 13 | Spring drag on calendar | med | M |
| 5 | Skeleton cross-fade | low | M |
| 12 | First-run coach marks | high | M |
| 9 | Auto-dark mode (scope-limited) | high | L |

Начинать с top-5 строк таблицы — они дают 70% визуального апдейта за 1 день работы без риска сломать runtime.
