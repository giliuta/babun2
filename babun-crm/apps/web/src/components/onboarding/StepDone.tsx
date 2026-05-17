"use client";

import type { Vertical } from "./OnboardingWizard";

interface Props {
  name: string;
  vertical: Vertical | null;
  personalCalendar: boolean;
  onBack: () => void;
  onCommit: (next: "calendar" | "team") => void | Promise<void>;
  saving: boolean;
  error: string | null;
}

const VERTICAL_LABELS: Record<Vertical, string> = {
  hvac: "Кондиционеры",
  beauty: "Красота и здоровье",
  auto: "Авто-сервис",
  cleaning: "Клининг",
  other: "Другое",
};

export default function StepDone({
  name,
  vertical,
  personalCalendar,
  onBack,
  onCommit,
  saving,
  error,
}: Props) {
  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-[20px] font-bold text-[var(--label)] mb-1">
          Всё готово!
        </h2>
        <p className="text-[13px] text-[var(--label-secondary)] leading-snug">
          Babun настроен. Дальше — открыть календарь или сразу собирать команду.
        </p>
      </div>

      <div className="bg-[var(--fill-quaternary)] rounded-[12px] divide-y divide-[var(--separator)] overflow-hidden">
        <SummaryRow label="Бизнес" value={name || "—"} />
        <SummaryRow
          label="Тип"
          value={vertical ? VERTICAL_LABELS[vertical] : "—"}
        />
        <SummaryRow
          label="Календарь"
          value={personalCalendar ? "Личный" : "Для команды"}
        />
      </div>

      {/* v544 §3.2 (b) — «Что сделать дальше» checklist. Sets the
          first-week-of-use expectation: which sections to visit and
          in what order. Renders different items for personal vs
          team mode so a solo owner doesn't see «Добавить сотрудника»
          first when they explicitly opted into the personal calendar. */}
      <ChecklistSection personalCalendar={personalCalendar} />

      {error && (
        <div className="text-[13px] text-[var(--system-red)] text-center px-2 leading-snug">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onCommit("calendar")}
          disabled={saving}
          className="w-full h-[50px] rounded-[var(--radius-pill)] bg-[var(--accent)] text-[var(--label-on-accent)] text-[17px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] transition"
        >
          {saving ? "Сохраняем…" : "Открыть календарь"}
        </button>
        {!personalCalendar && (
          <button
            type="button"
            onClick={() => onCommit("team")}
            disabled={saving}
            className="w-full h-[50px] rounded-[var(--radius-pill)] bg-[var(--surface-card)] border border-[var(--separator)] text-[var(--accent)] text-[17px] font-semibold active:bg-[var(--fill-quaternary)] disabled:text-[var(--label-tertiary)] disabled:cursor-not-allowed transition"
          >
            Настроить команду
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onBack}
        disabled={saving}
        className="block mx-auto h-9 px-4 text-[13px] font-medium text-[var(--label-secondary)] active:opacity-60 disabled:text-[var(--label-tertiary)] disabled:cursor-not-allowed"
      >
        ← Назад
      </button>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center px-4 py-3">
      <span className="text-[13px] text-[var(--label-secondary)] w-20 shrink-0">
        {label}
      </span>
      <span
        className={`flex-1 text-[14px] ${
          muted ? "text-[var(--label-tertiary)] italic" : "text-[var(--label)] font-medium"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// v544 §3.2 (b) — what-to-do-next checklist. Sets the expectation for
// the first week of use without forcing every step now (the wizard
// stays a 4-step flow). Personal-calendar users see a personal-flavoured
// list; team-calendar users see the team-flavoured one.
//
// Rendered as a passive checklist (no checkboxes) — the user discovers
// each section by visiting it; we don't try to track completion here.
// «Открыть календарь» from StepDone takes the user to /dashboard
// where the calendar empty-state CTA + sidebar carry them through.
interface ChecklistItem {
  emoji: string;
  title: string;
  body: string;
}

const TEAM_CHECKLIST: ChecklistItem[] = [
  {
    emoji: "👥",
    title: "Соберите команду",
    body: "Сотрудники → «Новый сотрудник». Свяжите их с командами на странице «Команды».",
  },
  {
    emoji: "🧰",
    title: "Заведите услуги",
    body: "Услуги → задайте цену, длительность, цвет. Они автоматически подставятся в новые записи.",
  },
  {
    emoji: "📞",
    title: "Создайте первую запись клиента",
    body: "Нажмите ячейку в календаре, выберите клиента и услугу — запись появится в расписании.",
  },
  {
    emoji: "📲",
    title: "Подключите SMS-уведомления",
    body: "Настройки → Автоматические SMS. Возвраты за 24 ч / 2 ч до визита.",
  },
];

const PERSONAL_CHECKLIST: ChecklistItem[] = [
  {
    emoji: "🗓️",
    title: "Добавьте первое событие",
    body: "Нажмите ячейку в календаре, чтобы создать событие — обед, выезд, отпуск.",
  },
  {
    emoji: "🎨",
    title: "Настройте цвет и часы",
    body: "Настройки → Календарь. Рабочие часы, цвет личного календаря, шаг сетки.",
  },
  {
    emoji: "🔔",
    title: "Включите push",
    body: "Настройки → Личный календарь → «Уведомления» — за 15 минут до события.",
  },
  {
    emoji: "👥",
    title: "Пригласите команду позже",
    body: "Когда появятся сотрудники — Сотрудники → «Новый сотрудник». Личный календарь остаётся вашим.",
  },
];

function ChecklistSection({ personalCalendar }: { personalCalendar: boolean }) {
  const items = personalCalendar ? PERSONAL_CHECKLIST : TEAM_CHECKLIST;
  return (
    <div className="mt-2">
      <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-2 px-1">
        Что сделать дальше
      </div>
      <ul className="bg-[var(--surface-card)] rounded-[12px] divide-y divide-[var(--separator)] overflow-hidden">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-3 px-4 py-3"
            data-testid={`onboarding-checklist-item-${i}`}
          >
            <span
              className="text-[20px] shrink-0 leading-none mt-0.5"
              aria-hidden
            >
              {item.emoji}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-[var(--label)] leading-snug">
                {item.title}
              </div>
              <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 leading-snug">
                {item.body}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
