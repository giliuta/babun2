# Babun2 Agents — когда и кого звать

Специализированные Claude-агенты для Babun2. Каждый знает доменную область, правила проекта, invariants, и возвращает целевой output-формат.

Вызываются через `Agent({ subagent_type: "<name>" })`. В UI Claude Code доступны как subagent.

## Экранные эксперты

| Имя | Когда звать |
|-----|-------------|
| `babun-calendar-expert` | Любые правки в `dashboard/page.tsx` или `components/calendar/*`. Знает iOS pinch-zoom, gesture conflicts, swipe/pinch/long-press, TimeColumn invariants |
| `babun-appointment-form-expert` | AppointmentSheet + TimeBlock + ClientBlock + LocationsBlock + ServicesBlock + IncomeBlock + все popup'ы. Знает правило «все попапы по центру», memoized blank seed |
| `babun-client-domain-expert` | `clients/*`, ClientProfileView, tags, notes, equipment, 903-клиента search, inline-edit storm |
| `babun-finance-expert` | Finances + expenses + payroll + reports + brigade splits. Один источник правды для прибыли — его работа |
| `babun-brigades-expert` | Brigades vs Teams (два разных концепта!), schedules, payroll lines, cascade при удалении команды |
| `babun-settings-expert` | Settings hub + calendar/cities/booking subsections + reference books. Следит чтобы каждая настройка реально персистилась |

## Cross-cutting эксперты (знают всё приложение)

| Имя | Когда звать |
|-----|-------------|
| `babun-design-system-keeper` | Перед любой UI-правкой. Токены: violet-600 primary, 13px floor, z-index ladder 10→95, centered popups only |
| `babun-data-loss-guardian` | Любой код работы с close/dismiss/delete/backdrop/cascade. Ищет silent data loss и предлагает undo-toast или confirm |
| `babun-mobile-ux-auditor` | Перед каждым merge UI-изменения. 44×44 тап, thumb zone, iOS safe-area, visualViewport keyboard, контраст под солнцем |
| `babun-copy-keeper` | Любой user-visible текст. RU в UI / EN в коде, tone, empty states, SMS templates, destructive confirms |
| `babun-hvac-domain-expert` | Проектирование фич про A/C units, recurring cleaning, crew workflow, Cyprus specifics |
| `babun-release-captain` | В конце каждой фичи. typecheck + BUILD_VERSION + CACHE_VERSION + clean commit + push |

## Существующие универсальные

| Имя | Назначение |
|-----|-----------|
| `architect` | Architecture decisions, ADRs, без кода |
| `developer` | Implementation по story |
| `tester` | Тесты (когда будут) |
| `reviewer` | Diff review перед push |

## Пример workflow для одной фичи

```
/clarify <идея>                   → понять что хочет пользователь
Agent(babun-hvac-domain-expert)   → проверить что фича имеет смысл
/plan <feature>                   → STORY-NNN.md
Agent(babun-design-system-keeper) → валидация UI до написания
Agent(babun-<screen>-expert)      → реализация
Agent(babun-data-loss-guardian)   → проверка delete/close путей
Agent(babun-copy-keeper)          → вычитка копирайта
Agent(babun-mobile-ux-auditor)    → аудит на мобилке
/second-opinion                   → независимое мнение
Agent(babun-release-captain)      → bump + commit + push
```

## Правило использования

**Не зови агента ради агента.** Если изменение — 10 строк в одном месте, делай сам. Агенты экономят твой контекст только когда:
- Задача big-picture и нужен широкий аудит
- Нужна специализация (HVAC, design system, mobile)
- Требуется independent opinion

**Параллельный запуск** — когда нужно 5-6 аудитов по разным экранам разом, запускай в одном сообщении с `run_in_background: true`, потом собирай в итоговый документ.
