# Sprint 033 Phase I — Telegram light polish, итог

**Дата:** 2026-04-22
**Версии:** v245-tg-polish (tokens) + v246-tg-flatten (shadows)
**Запрос пользователя:** «переделай всю срм в стиль telegram, только светлая тема»

---

## Что изменилось

### Tokens (`globals.css`)

| Параметр | Было | Стало |
|---|---|---|
| `--accent` | iOS systemBlue `#007AFF` | **Telegram blue `#3E88F7`** |
| `--accent-pressed` | `#0062CC` | `#2D7BE5` |
| `--surface-grouped` | `#F2F2F7` (холодный iOS) | `#EFEFF4` (теплее — Telegram) |
| `--separator` | `rgba(60,60,67,0.12)` | `rgba(60,60,67,0.10)` (тоньше) |
| `--shadow-card` | 2-stop lift | **только hairline ring 0.5px** |
| `tile palette` | iOS system 12 colors | **Telegram saturated 12** |
| `theme_color` (PWA) | `#007AFF` | `#3E88F7` |

### Flatten shadows (`scripts/tg-flatten*.mjs`)

- **34 файла, 55 замен** — все hardcoded Tailwind `shadow-sm/md/lg/xl/2xl` и `shadow-[0_1px_...]` заменены на `shadow-[var(--shadow-card|sheet|fab)]`.
- **Интенционально сохранены**: hero accent glow на `/login` и `/404`, `SuccessOverlay`, UndoToast pill, IOSSwitch knob, Sidebar drawer drop.
- **Header.tsx active-team-tab** — принципиальный фикс: custom shadow → `shadow-card`.

---

## Ключевые экраны после правок

### Календарь ([phase033i-final-dashboard.png](phase033i-final-dashboard.png))
- Telegram-blue accent на активном табе «Y&D»
- Синий FAB с Telegram glow (shadow-fab)
- Flat tabs + chips

### Страница бригады ([phase033i-final-brigade.png](phase033i-final-brigade.png))
- 6 ListRow с цветными tile-иконками (orange calendar, red pin, indigo users, purple wrench, orange calendar, green clock)
- Flat cards, только hairline separators
- Центрированный title + dot-badge бригадного цвета

### Финансы ([phase033i-final-finances.png](phase033i-final-finances.png))
- 4 KPI pills с Telegram blue outline на selected
- Telegram semantic colors на числах (зелёный +, красный −, синий ₀, warm-orange долги)
- СЧЁТ ЗАПИСЕЙ / СВЕРКА КАССЫ — чистые ListGroup с разделителями

### Чаты ([phase033i-final-chats.png](phase033i-final-chats.png))
- Flat iOS nav bar
- Avatars + canal-icon badge (phone / paperplane / Instagram)
- Filter chips snapshot: Все blue / Без ответа orange / WhatsApp / Telegram (scrollable)
- Badge unread зелёная

### Настройки ([phase033i-final-settings.png](phase033i-final-settings.png))
- Полная копия Telegram Settings: 3 секции (РАЗДЕЛЫ / УЧЁТНАЯ ЗАПИСЬ / ПОЛЯ ЗАПИСИ)
- Coloured tile icons 12-цветная палитра Telegram
- iOS switches зелёные

### Клиенты ([phase033i2-clients.png](phase033i2-clients.png))
- Compact list с avatar-tile (iOS bright via avatar-color.ts)
- Blue FAB edit снизу-справа
- Chip-filter «Все / VIP / B2B / …» scrolls horizontal

---

## Что уже было Telegram-готово до Phase I (заслуги Sprint 032/033)

- BottomTabBar с icon+label в pill — Telegram iOS mobile nav
- ListGroup + ListRow + 56px separator — Telegram Settings pattern
- SheetShell bottom-sheet — Telegram modal
- Compact brigade index + 6 subroutes — Telegram Settings subsection flow
- Inline service edit, cities inline-add, multi-lead — все в Telegram UX стиле

---

## Commits этого спринта

| Version | Commit | Что |
|---|---|---|
| v245-tg-polish | `cd08bea` | accent → Telegram blue, tile palette, theme_color, flat shadow tokens |
| v246-tg-flatten | `32b03e0` | mass flatten 34 files (scripts + header + settings) |

+ все предыдущие Sprint 033 фазы (A..H2): структурный Telegram-skeleton.

---

## Что НЕ менял (объяснение)

1. **Dark mode** — пользователь явно сказал «только светлая»
2. **Bottom tab bar «Ещё»** — ведёт в Sidebar (не в CreateMenu) — осознанное решение Sprint 027
3. **Chat banner** — уже flat после Sprint 032 Phase 3
4. **Типографика** — уже Telegram-style (Inter/SF Pro, 11-17px scale)
5. **Hero glows** на login + 404 — намеренный brand-lift, не плоский shadow

---

## Что ещё можно доработать (опционально)

- **Dark mode** — токены готовы (`html.theme-dark` empty hook), нужен toggle + заполнение
- **Page transitions** — между табами пока instant; можно добавить fade/slide
- **Pull-to-refresh** на списках Clients/Chats
- **Long-press FAB** → CreateMenu (запись/событие/клиент/расход)
- **Supabase backend** (STORY-001) — для cross-device realtime
