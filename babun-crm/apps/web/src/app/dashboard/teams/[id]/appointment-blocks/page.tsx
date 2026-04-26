"use client";

// Sprint 033 Phase I42 — Brigade appointment-sheet layout.
//
// Each brigade can toggle which optional blocks show up when someone
// creates or edits a visit on this brigade's calendar. Client +
// services are always on (sticky rows at the top, disabled switches
// to make the rule visible, not hidden by omission). Everything else
// — address, comment, photos, prepay, expenses, reminder, source —
// is opt-in per brigade.
//
// Wiring to the AppointmentSheet itself lands in a follow-up commit;
// this page just persists the flags onto team.appointment_blocks so
// the data structure is ready.

import { use, useMemo } from "react";
import {
  Bell,
  Camera,
  Check,
  CreditCard,
  GripVertical,
  MapPin,
  MessageSquare,
  Receipt,
  Smartphone,
  StickyNote,
  User,
  Wallet,
  Wrench,
  type LucideIcon,
} from "@babun/shared/icons";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { haptic } from "@/lib/haptics";
import { useTeams } from "@/app/dashboard/layout";
import IOSSwitch from "@/components/ui/IOSSwitch";
import BrigadeSectionShell from "@/components/teams/BrigadeSectionShell";
import {
  type BrigadeAppointmentBlocks,
} from "@babun/shared/local/masters";

interface RouteParams {
  params: Promise<{ id: string }>;
}

type BlockKey = Exclude<keyof BrigadeAppointmentBlocks, "order">;

interface BlockMeta {
  key: BlockKey;
  label: string;
  description: string;
  defaultOn: boolean;
  icon: LucideIcon;
  tone: string; // Tailwind bg class for the preview tile
}

const OPTIONAL_BLOCKS: BlockMeta[] = [
  {
    key: "show_address",
    label: "Адрес",
    description: "Поле для адреса визита отдельно от клиента.",
    defaultOn: true,
    icon: MapPin,
    tone: "bg-[var(--tile-red)]",
  },
  {
    key: "show_address_note",
    label: "Заметка к адресу",
    description: "«Зелёная дверь, звонок» — подсказка бригаде у порога.",
    defaultOn: true,
    icon: StickyNote,
    tone: "bg-[var(--tile-yellow)]",
  },
  {
    key: "show_comment",
    label: "Комментарий",
    description: "Свободный текст к записи.",
    defaultOn: true,
    icon: MessageSquare,
    tone: "bg-[var(--tile-mint)]",
  },
  {
    key: "show_photos",
    label: "Фото до / после",
    description: "Блок загрузки фото по визиту.",
    defaultOn: true,
    icon: Camera,
    tone: "bg-[var(--tile-indigo)]",
  },
  {
    key: "show_prepaid",
    label: "Аванс / предоплата",
    description: "Сумма, которую клиент внёс заранее.",
    defaultOn: false,
    icon: Wallet,
    tone: "bg-[var(--tile-orange)]",
  },
  {
    key: "show_payment",
    label: "Способы оплаты",
    description: "Нал / карта / сплит при закрытии визита.",
    defaultOn: true,
    icon: CreditCard,
    tone: "bg-[var(--tile-green)]",
  },
  {
    key: "show_expenses",
    label: "Расходы",
    description: "Материалы, транспорт, прочие издержки визита.",
    defaultOn: true,
    icon: Receipt,
    tone: "bg-[var(--tile-blue)]",
  },
  {
    key: "show_reminder",
    label: "Напоминание клиенту",
    description: "SMS за X минут до начала.",
    defaultOn: false,
    icon: Bell,
    tone: "bg-[var(--tile-purple)]",
  },
  {
    key: "show_source",
    label: "Источник заявки",
    description: "Откуда пришёл клиент — Instagram / WhatsApp / онлайн.",
    defaultOn: false,
    icon: Smartphone,
    tone: "bg-[var(--tile-indigo)]",
  },
];

export default function BrigadeAppointmentBlocksPage({ params }: RouteParams) {
  const { id } = use(params);
  const { teams, upsertTeam } = useTeams();
  const team = teams.find((t) => t.id === id);

  if (!team) {
    return (
      <BrigadeSectionShell brigadeId={id} title="Запись" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Бригада не найдена.
        </div>
      </BrigadeSectionShell>
    );
  }

  const blocks = team.appointment_blocks ?? {};

  const toggle = (key: BlockKey, current: boolean) => {
    haptic("tap");
    upsertTeam({
      ...team,
      appointment_blocks: {
        ...blocks,
        [key]: !current,
      },
    });
  };

  const resetToDefaults = () => {
    haptic("warning");
    upsertTeam({
      ...team,
      appointment_blocks: undefined,
    });
  };

  const isEnabled = (b: (typeof OPTIONAL_BLOCKS)[number]) =>
    blocks[b.key] ?? b.defaultOn;

  // Phase I46 — resolve order. Apply saved order first; append any
  // blocks that weren't in the saved list (new additions) in their
  // declaration-order position.
  const orderedBlocks: BlockMeta[] = useMemo(() => {
    const saved = blocks.order ?? [];
    const byKey = new Map<string, BlockMeta>();
    for (const b of OPTIONAL_BLOCKS) byKey.set(b.key, b);
    const result: BlockMeta[] = [];
    for (const key of saved) {
      const b = byKey.get(key);
      if (b) {
        result.push(b);
        byKey.delete(key);
      }
    }
    for (const b of OPTIONAL_BLOCKS) {
      if (byKey.has(b.key)) result.push(b);
    }
    return result;
  }, [blocks.order]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 500, tolerance: 6 } }),
  );

  const handleDragEnd = (ev: DragEndEvent) => {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const keys = orderedBlocks.map((b) => b.key);
    const oldIdx = keys.indexOf(active.id as BlockKey);
    const newIdx = keys.indexOf(over.id as BlockKey);
    if (oldIdx === -1 || newIdx === -1) return;
    const nextOrder = arrayMove(keys, oldIdx, newIdx);
    haptic("tap");
    upsertTeam({
      ...team,
      appointment_blocks: {
        ...blocks,
        order: nextOrder,
      },
    });
  };

  return (
    <BrigadeSectionShell brigadeId={id} title="Запись" hideSave>
      {/* ── Мини-превью формы записи (с drag-to-reorder) ───── */}
      <div>
        <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
          Форма записи выглядит так
        </div>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-3">
          <SortablePreview
            orderedBlocks={orderedBlocks}
            isEnabled={isEnabled}
            sensors={sensors}
            onDragEnd={handleDragEnd}
          />
        </div>
        <div className="px-4 pt-1.5 text-[12px] text-[var(--label-tertiary)] leading-snug">
          Это то, что бригада увидит, когда откроет запись. Долгое
          нажатие + перетаскивание — переставить блоки местами.
        </div>
      </div>

      {/* ── Базовые (всегда видимы) ─────────────────────── */}
      <Group
        title="Всегда включены"
        footer="Клиент и услуги — основа записи. Отключить нельзя."
      >
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
          <Locked label="Клиент" />
          <Locked label="Услуги" last />
        </div>
      </Group>

      {/* ── Опциональные блоки ─────────────────────────── */}
      <Group
        title="Дополнительные блоки"
        footer="Перестраивает форму записи только в этой бригаде. Например, одна команда фоткает работу до/после — включаем; другая никогда — отключаем, и блок перестанет маячить в глазах."
      >
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
          {orderedBlocks.map((b) => {
            const on = isEnabled(b);
            return (
              <div
                key={b.key}
                className="flex items-start gap-3 px-4 py-3 min-h-[56px]"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] text-[var(--label)]">
                    {b.label}
                  </div>
                  <div className="text-[12px] text-[var(--label-tertiary)] leading-snug mt-0.5">
                    {b.description}
                  </div>
                </div>
                <IOSSwitch
                  checked={on}
                  onChange={() => toggle(b.key, on)}
                  ariaLabel={b.label}
                />
              </div>
            );
          })}
        </div>
      </Group>

      {team.appointment_blocks && (
        <button
          type="button"
          onClick={resetToDefaults}
          className="w-full h-12 flex items-center justify-center rounded-[var(--radius-card)] bg-[var(--surface-card)] text-[var(--accent)] text-[14px] font-medium press-scale active:bg-[var(--fill-quaternary)] shadow-[var(--shadow-card)]"
        >
          Сбросить к стандартным
        </button>
      )}
    </BrigadeSectionShell>
  );
}

function Group({
  title,
  footer,
  children,
}: {
  title: string;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
        {title}
      </div>
      {children}
      {footer && (
        <div className="px-4 pt-1.5 text-[12px] text-[var(--label-tertiary)] leading-snug">
          {footer}
        </div>
      )}
    </div>
  );
}

// Mini-preview: shows what the dispatcher will see on the sheet.
// Base blocks (Клиент, Услуги) are always at the top and not
// draggable — they're part of the schema. Optional blocks below can
// be reordered via long-press-drag; invisible ones are rendered at
// reduced opacity with a strike so the tenant still sees the slot
// they turned off.
function SortablePreview({
  orderedBlocks,
  isEnabled,
  sensors,
  onDragEnd,
}: {
  orderedBlocks: BlockMeta[];
  isEnabled: (b: BlockMeta) => boolean;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (ev: DragEndEvent) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <PreviewRow
        icon={User}
        label="Клиент"
        tone="bg-[var(--accent)]"
        required
      />
      <PreviewRow
        icon={Wrench}
        label="Услуги"
        tone="bg-[var(--tile-purple)]"
        required
      />
      <DndContext
        sensors={sensors}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={orderedBlocks.map((b) => b.key)}
          strategy={verticalListSortingStrategy}
        >
          {orderedBlocks.map((b) => (
            <SortablePreviewRow
              key={b.key}
              block={b}
              enabled={isEnabled(b)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortablePreviewRow({
  block,
  enabled,
}: {
  block: BlockMeta;
  enabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.key });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : enabled ? 1 : 0.35,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 h-9 pl-1 pr-2.5 rounded-[10px] bg-[var(--fill-tertiary)] touch-none ${
        isDragging ? "ring-2 ring-[var(--accent)]" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="w-6 h-9 flex items-center justify-center text-[var(--label-tertiary)] cursor-grab active:cursor-grabbing"
        aria-label={`Перетащить ${block.label}`}
      >
        <GripVertical size={14} strokeWidth={2} />
      </button>
      <span
        className={`w-6 h-6 rounded-md flex items-center justify-center text-[var(--label-on-accent)] shrink-0 ${block.tone}`}
      >
        <block.icon size={13} strokeWidth={2.2} />
      </span>
      <span
        className={`flex-1 text-[13px] text-[var(--label)] truncate ${
          enabled ? "" : "line-through"
        }`}
      >
        {block.label}
      </span>
      {!enabled && (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--label-tertiary)]">
          скрыт
        </span>
      )}
    </div>
  );
}

function PreviewRow({
  icon: Icon,
  label,
  tone,
  required,
}: {
  icon: LucideIcon;
  label: string;
  tone: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 h-9 px-2.5 rounded-[10px] bg-[var(--fill-tertiary)]">
      <span
        className={`w-6 h-6 rounded-md flex items-center justify-center text-[var(--label-on-accent)] shrink-0 ${tone}`}
      >
        <Icon size={13} strokeWidth={2.2} />
      </span>
      <span className="flex-1 text-[13px] text-[var(--label)] truncate">
        {label}
      </span>
      {required && (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--label-tertiary)]">
          обязательно
        </span>
      )}
    </div>
  );
}

function Locked({ label, last }: { label: string; last?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 px-4 min-h-[48px] ${
        last ? "" : "border-b border-[var(--separator)]"
      }`}
    >
      <span className="w-5 h-5 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
        <Check size={12} strokeWidth={3} />
      </span>
      <span className="flex-1 text-[15px] text-[var(--label)]">{label}</span>
      <span className="text-[11px] text-[var(--label-tertiary)] uppercase tracking-wider">
        всегда
      </span>
    </div>
  );
}
