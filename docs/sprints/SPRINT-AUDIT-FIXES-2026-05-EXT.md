# SPRINT-AUDIT-FIXES-2026-05 — extension batch

Follow-on to `SPRINT-AUDIT-FIXES-2026-05.md`. After the v520 report
the user said «делай все до конца» — autonomous mode, no per-commit
approval, push when convenient. This file documents what landed in
the second push (v522–v530).

---

## Commits added since v520 report

| Commit | Title | Source |
|---|---|---|
| `03dddac` | fix(clients): truthful crew label + labelled payment row (v522) | external |
| `fa50dde` | chore(copy): clients — Комментарий→Заметки + voice unification (v522, §3.8) | mine |
| `eeb434d` | docs(glossary): canonical terms + tone + rename history (§5.5) | mine |
| `38eb9fe` | fix(clients): skeleton instead of «не найден» flash on load (v525) | external |
| `d8cea33` | feat(appointment): «Источник заявки» required on create (v524, §3.9) | mine |
| `3ee43e3` | fix(onboarding): default personal calendar to ON for fresh tenants (v526, §3.2) | mine |
| `e7579ec` | feat(integrations): stub page + chats empty-state CTA (v528, §3.11) | mine |
| `3bb0655` | ui(settings): 2-column grid on lg+ (v529, §3.13) | mine |
| `0d80e45` | fix: public-safe 404 + income-categories tab (v530, P0 #7 & #11) | external |

All pushed to `origin/feat/audit-fixes-2026-05`. `tsc --noEmit` clean
after every commit. Vitest pool unchanged (still 9/9, 63 tests).

---

## Audit-plan coverage map — running total

Closed since the start of the audit-fixes branch:

| Plan ref | Title | Where |
|---|---|---|
| §2.1 | DISPLAY_VERSION split from BUILD_VERSION | v513 |
| §2.2 | Inline-create client persists to Supabase | v514 |
| §2.3 | Onboarding doesn't re-prompt calendar mode | v515 |
| §2.4 | Empty-state CTA copy matches sheet | v516 |
| §2.7 | Close-confirm: destructive primary + skip on empty | v517 |
| §1.1 | Терминология (Напоминания→Возвраты, Мастера→Сотрудники) | v518 |
| §1.3 | Дальше→Далее | v518 |
| §3.5/3.6 | Desktop-aware gesture hints | v519 |
| §3.1 | Register: name field, terms checkbox, drop business name | v520 |
| §3.8 | Clients: Комментарий→Заметки + voice | v522 |
| §3.9 | Appointment source mandatory on create | v524 |
| §3.2 (a) | Onboarding default → personal | v526 |
| §3.11 | Integrations stub page + chats CTA | v528 |
| §3.13 | Settings 2-column on lg+ | v529 |
| §5.5 | /docs/glossary.md | (this branch) |

Still open from the original plan (deferred / requires more scope):

- **§2.5** 503 retry-with-backoff fetcher — needs Sentry (5.1) first.
- **§2.6** base64 in RSC payload — zero matches in source; runtime
  profiling on prod required.
- **§1.5** design-system primitives (`Button` / `Input` / `Modal` /
  `Switch` / `ColorPicker` / `EmptyState` / `Toast`) as canonical
  components. Touchpoints are scattered; a real DS extraction is a
  multi-week refactor.
- **§3.2 (b)** post-onboarding «Что сделать дальше» checklist on
  StepDone.
- **§3.3** Sidebar aria-labels — Audit reviewed; existing rows are
  `<Link>` with visible text labels, logout button has visible
  «Выход» text. Iconic-only buttons in Header + PageHeader +
  BottomTabBar already carry aria-label. No further action needed
  unless live a11y audit finds gaps.
- **§3.4** Kill «Без города» per-day strip — only matches in source
  are inside aria-label fallbacks. Visible-text instance needs
  browser repro.
- **§3.7** Permission presets (Менеджер / Мастер / Диспетчер / Только
  просмотр) — net new UI on /dashboard/masters/[id]/access. Single
  biggest UX win for new tenants. Defer to focused commit.
- **§3.10** SMS templates UX overhaul (presets, preview with
  substitutions, char counter) — large.
- **§3.12** Finance charts (recharts/visx) — large; new dep.
- **§4.x** All feature backlog items — multi-day each.
- **§5.1** Sentry — precondition for several items above.
- **§5.2** Playwright E2E for the four P0 fixes — would land
  v513-v517 behind a regression net.
- **§5.3** CI lint+typecheck+test gates on PRs.
- **§5.4** Lighthouse audit.

---

## What changed for the user (since v520 deploy)

- **Клиенты** говорят «Заметки» вместо «Комментарий», список
  встречает формальным «Создайте первого клиента» (v522).
- **Создать запись** теперь требует выбора источника — поле снабжено
  красной звёздочкой + inline-помощником (v524).
- **Онбординг** на свежем тенанте предлагает «Личный календарь»
  по умолчанию вместо «Команды» (v526).
- **Чаты пусты** — кнопка «Подключить мессенджер» ведёт в реальный
  раздел `/dashboard/settings/integrations` с тремя плейсхолдерами;
  больше не тупик (v528).
- **Настройки на desktop** разложены в 2 колонки на lg+; на мобильном
  без изменений (v529).
- Внешние коммиты добавили: confirm-диалог при отключении персонального
  календаря, live end-time recalc в AppointmentSheet, skeleton вместо
  «не найден» flash в карточке клиента, public-safe 404, income-
  categories module.

---

## Recommended ordering for next sprint (unchanged from v520 report)

1. Sentry + retry-fetcher (§5.1 + §2.5).
2. §3.7 permission presets.
3. §3.10 SMS templates UX.
4. §3.12 finance charts.
5. §4.1 Services CRUD.
6. §5.2 Playwright E2E covering v513-v529.

---

## Branch metadata

- Branch: `feat/audit-fixes-2026-05`
- Last commit: `0d80e45` (v530)
- Open PR: https://github.com/giliuta/babun2/pull/new/feat/audit-fixes-2026-05
- TSC: clean
- Vitest: 9 files, 63 tests passing
- ESLint: 149 pre-existing problems (no new ones introduced)
