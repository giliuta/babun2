# Operations Handbook

Как устроен sprint от идеи до ship.

## Sprint lifecycle

```
Idea (seed)
  ↓ (Chief of Staff drafts 1-page brief)
Brief
  ↓ (parallel workup: Product / Design / Eng / QA / Copy)
Decision Document
  ↓ (CEO: Да / Нет / Иначе)
Execution
  ↓ (Engineering team builds; QA verifies)
Ship Review
  ↓ (release-captain)
Shipped
  ↓ (retro + memory update)
```

## 1. Brief (1 страница)

Создаёт **Chief of Staff**. Содержит:
- **Цель** — что даёт пользователю в одном предложении
- **Кому** — persona, сценарий, боль
- **Scope** — что IN, что OUT
- **Зависимости** — от каких других фич / данных
- **Risk** — что может пойти не так

Файл: `docs/sprints/SPRINT-NNN-<slug>/BRIEF.md`

## 2. Parallel workup

Chief of Staff запускает 5-8 агентов одновременно, каждый в своём файле:

| Агент | Выход |
|-------|-------|
| `babun-hvac-domain-expert` или `researcher` | `PRODUCT.md` — валидация идеи с точки зрения домена |
| `babun-design-system-keeper` | `DESIGN.md` — визуальная спека, токены, z-index, варианты |
| `babun-mobile-ux-auditor` | `MOBILE.md` — thumb zone, 44px check, iOS quirks |
| `babun-<screen>-expert` | `ENGINEERING.md` — план файлов, компонентов, invariants |
| `babun-data-loss-guardian` | `DATA_SAFETY.md` — cascade, undo, dirty guards |
| `babun-copy-keeper` | `COPY.md` — все русские строки в одном месте |
| `tester` | `QA.md` — чек-лист что проверить |

**Параллельно** — все в одном сообщении с `run_in_background: true`. Chief of Staff ждёт завершения всех, потом консолидирует.

## 3. Decision Document

Chief of Staff собирает в **один** файл для CEO:

`docs/sprints/SPRINT-NNN-<slug>/DECISION.md`

Структура:
```
# Sprint NNN — <slug>

## TL;DR (3 строки)
<что делаем, зачем, оценка работы>

## Что увидит пользователь
<текстовое описание flow + ссылка на ASCII-mockup или HTML-макет ниже>

## Что получим
- боль X решена (метрика если есть)
- Y сэкономили  
- Z новая возможность

## План работ
1. <step 1> — <файл> — <кто делает>
2. ...

## Что меняется в коде
- новые файлы: ...
- правленые файлы: ...
- удалённые файлы: ...

## Риски
- риск 1 → митигация

## Mockup / визуал
<ASCII или ссылка на HTML файл>

## Решение CEO
[ ] Да, делаем как задумано
[ ] Да, но с правкой: ...
[ ] Нет
[ ] Подождать — сначала фича Y

## Подписи команд
- Product: ...
- Design: ...
- Engineering: ...
- QA: ...
```

CEO ставит одну галочку → Chief of Staff переходит к execution.

## 4. Execution

- Engineering team создаёт branch `feature/SPRINT-NNN-<slug>`
- Commits маленькие, по одному логическому изменению
- QA проверяет промежуточно
- В конце: `babun-release-captain`

## 5. Ship Review

Чек-лист перед `git push`:
- [ ] typecheck
- [ ] eslint без новых ошибок
- [ ] BUILD_VERSION + CACHE_VERSION подняты
- [ ] commit message по стилю
- [ ] UX_AUDIT.md обновлён (findings закрыты)
- [ ] нет мусорных файлов (`git status --short`)
- [ ] `/second-opinion` если фича критичная

## 6. Retro

После ship'а:
- Что узнали → memory (`feedback_*.md`)
- Что в процессе сломалось → `CHARTER.md` / `OPERATIONS.md` уточняем
- Что теперь знает `<screen>-expert` → его prompt обновляем

## Правила параллелизации

- Агентов спавним параллельно только если они работают с **разными** файлами или задачами. Иначе — последовательно.
- Каждый агент получает **узкую** задачу (1 абзац), а не «сделай всё хорошо».
- Output cap — 300-500 слов. Длинные отчёты = потеря контекста.
- Chief of Staff НЕ читает raw output агентов (overflow контекста), читает только финальный summary каждого.

## Анти-паттерны

❌ Спавнить 20 агентов одной кнопкой — переполнится очередь и теряется фокус
❌ Копировать UI другого продукта пиксель-в-пиксель — IP риск
❌ Обходить CEO на глобальных решениях «потому что мелочь»
❌ Писать код до Decision Doc
❌ Ship без release-captain checklist
❌ «Ещё один раунд улучшений» без конкретной метрики «стало лучше на X»

## Формат Session Report (то, что CEO видит в конце сессии)

```
## Session Report YYYY-MM-DD

### Что сделано
- [commit hash] <scope>: <summary>
- ...

### Открытые вопросы для CEO
1. <вопрос> → мои варианты: A / B / C → рекомендую B потому что ...

### Предложение на следующий ход
1. <идея> — оценка S/M/L — almaty-доход что даст

### Риски на горизонте
- <риск> — вероятность / impact / мой план
```
