"use client";

// Per-brigade event-types editor — mirrors
// /dashboard/settings/calendar/event-types but writes the chip list
// scoped by team_id. Each brigade curates its own set of «быстрого
// применения» chips that show up above the title in the team
// calendar's "Новое событие" form.

import { use, useState } from "react";
import {
  Pencil,
  Trash2,
  Coffee,
  Briefcase,
  Navigation as NavigationIcon,
  Moon,
  Plane,
  Bell,
  Heart,
  Star,
  Dumbbell,
  Book,
  Music,
  GraduationCap,
  Stethoscope,
  Car,
  Home,
  Users,
  Phone,
  ShoppingBag,
  Gift,
  Calendar as CalendarIcon,
  Tag,
} from "@babun/shared/icons";
import BrigadeSectionShell from "@/components/teams/BrigadeSectionShell";
import { Button, IOSSwitch } from "@/components/ui";
import { useTeams } from "@/components/layout/DashboardClientLayout";
import { useTeamEventTypes } from "@/hooks/useTeamEventTypes";
import {
  generateTeamEventTypeId,
  type TeamEventType,
} from "@babun/shared/local/team-event-types";
import type { PersonalEventTypeIcon } from "@babun/shared/local/personal-event-types";
import { PRESET_COLORS } from "@babun/shared/common/utils/colors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const ICON_MAP: Record<
  PersonalEventTypeIcon,
  React.ComponentType<{ size?: number; strokeWidth?: number }>
> = {
  coffee: Coffee,
  briefcase: Briefcase,
  navigation: NavigationIcon,
  moon: Moon,
  plane: Plane,
  bell: Bell,
  heart: Heart,
  star: Star,
  dumbbell: Dumbbell,
  book: Book,
  music: Music,
  "graduation-cap": GraduationCap,
  stethoscope: Stethoscope,
  car: Car,
  home: Home,
  users: Users,
  phone: Phone,
  "shopping-bag": ShoppingBag,
  gift: Gift,
  calendar: CalendarIcon,
  tag: Tag,
};

const ICON_OPTIONS = Object.keys(ICON_MAP) as PersonalEventTypeIcon[];

function IconBadge({
  icon,
  color,
  size = 16,
}: {
  icon: PersonalEventTypeIcon;
  color: string;
  size?: number;
}) {
  const Icon = ICON_MAP[icon] ?? Tag;
  return (
    <div
      className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
      style={{ background: `${color}1a`, color }}
    >
      <Icon size={size} strokeWidth={2} />
    </div>
  );
}

function EventTypeRow({
  type,
  onUpdate,
  onDelete,
}: {
  type: TeamEventType;
  onUpdate: (updated: TeamEventType) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TeamEventType>(type);

  const save = () => {
    if (!draft.label.trim()) return;
    onUpdate({ ...draft, label: draft.label.trim() });
    setEditing(false);
  };
  const cancel = () => {
    setDraft(type);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="bg-[var(--accent-tint)] rounded-[14px] p-3 space-y-3">
        <div className="flex items-center gap-2">
          <IconBadge icon={draft.icon} color={draft.color} />
          <input
            autoFocus
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") cancel();
            }}
            className="flex-1 h-10 px-3 bg-[var(--surface-card)] border border-transparent rounded-[10px] text-[14px] text-[var(--label)] focus:outline-none focus:border-[var(--accent)]"
            placeholder="Название"
          />
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--label-secondary)] mb-1.5">Иконка</div>
          <div className="grid grid-cols-7 gap-1.5">
            {ICON_OPTIONS.map((ic) => {
              const Icon = ICON_MAP[ic];
              const active = draft.icon === ic;
              return (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setDraft({ ...draft, icon: ic })}
                  className={`h-10 rounded-[10px] flex items-center justify-center transition ${active ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-card)] text-[var(--label-secondary)]"}`}
                  aria-label={ic}
                >
                  <Icon size={16} strokeWidth={2} />
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--label-secondary)] mb-1.5">Цвет</div>
          <div className="grid grid-cols-7 gap-1.5">
            {PRESET_COLORS.map((c) => {
              const active = draft.color.toLowerCase() === c.value.toLowerCase();
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setDraft({ ...draft, color: c.value })}
                  aria-label={c.name}
                  className={`h-9 rounded-full border-2 transition ${active ? "border-[var(--label)]" : "border-transparent"}`}
                  style={{ background: c.value }}
                />
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-[14px] text-[var(--label)]">Весь день</div>
          <IOSSwitch
            checked={draft.allDay}
            onChange={(next) => setDraft({ ...draft, allDay: next })}
            ariaLabel="Весь день"
          />
        </div>

        {!draft.allDay && (
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--label-secondary)] mb-1.5">Длительность по умолчанию</div>
            <div className="flex gap-1.5 flex-wrap">
              {[15, 30, 45, 60, 90, 120, 180].map((m) => {
                const active = draft.defaultDuration === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDraft({ ...draft, defaultDuration: m })}
                    className={`px-3 h-9 rounded-full text-[13px] font-semibold transition ${active ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-card)] text-[var(--label)]"}`}
                  >
                    {m < 60 ? `${m} мин` : m % 60 === 0 ? `${m / 60} ч` : `${Math.floor(m / 60)}ч${m % 60}`}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" size="md" fullWidth onClick={cancel}>Отмена</Button>
          <Button variant="primary" size="md" fullWidth onClick={save} disabled={!draft.label.trim()}>
            Сохранить
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-[10px]">
      <IconBadge icon={type.icon} color={type.color} />
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-medium text-[var(--label)] truncate">{type.label}</div>
        <div className="text-[12px] text-[var(--label-tertiary)]">
          {type.allDay ? "Весь день" : `${type.defaultDuration} мин`}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-8 h-8 flex items-center justify-center text-[var(--label-secondary)] hover:bg-[var(--fill-tertiary)] rounded-[8px]"
        aria-label="Редактировать"
      >
        <Pencil size={14} strokeWidth={2} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="w-8 h-8 flex items-center justify-center text-[var(--system-red)] hover:bg-[rgba(255,59,48,0.1)] rounded-[8px]"
        aria-label="Удалить"
      >
        <Trash2 size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

export default function BrigadeEventTypesPage({ params }: RouteParams) {
  const { id } = use(params);
  const { teams } = useTeams();
  const team = teams.find((t) => t.id === id);
  const { types, setTypes } = useTeamEventTypes(team?.id ?? null);

  const update = (next: TeamEventType) =>
    setTypes(types.map((t) => (t.id === next.id ? next : t)));
  const remove = (typeId: string) =>
    setTypes(types.filter((t) => t.id !== typeId));
  const add = () => {
    const created: TeamEventType = {
      id: generateTeamEventTypeId(),
      label: "Новый тип",
      icon: "tag",
      color: PRESET_COLORS[1].value,
      defaultDuration: 60,
      allDay: false,
      order: types.length,
    };
    setTypes([...types, created]);
  };

  if (!team) {
    return (
      <BrigadeSectionShell brigadeId={id} title="Шаблоны событий" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Команда не найдена.
        </div>
      </BrigadeSectionShell>
    );
  }

  return (
    <BrigadeSectionShell brigadeId={id} title="Шаблоны событий" hideSave>
      <div className="text-[12px] text-[var(--label-tertiary)] px-1 leading-snug">
        Шаблоны для быстрого создания событий в календаре этой команды.
        Каждый тип задаёт иконку, цвет и длительность по умолчанию.
      </div>

      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
        {types.length === 0 ? (
          <div className="px-4 py-8 text-center text-[14px] text-[var(--label-tertiary)]">
            Пока нет типов
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {types.map((t) => (
              <EventTypeRow
                key={t.id}
                type={t}
                onUpdate={update}
                onDelete={() => remove(t.id)}
              />
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={add}
        className="w-full h-12 flex items-center justify-center rounded-[var(--radius-card)] bg-[var(--surface-card)] text-[var(--accent)] text-[15px] font-semibold press-scale active:bg-[var(--fill-quaternary)] shadow-[var(--shadow-card)]"
      >
        + Добавить тип
      </button>
    </BrigadeSectionShell>
  );
}
