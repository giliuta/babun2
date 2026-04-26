"use client";

// Sprint 033 Phase I26 — Brigade equipment subroute.
// Shows the flat list of items assigned to THIS brigade. Reuses the
// global EquipmentFormModal with a lockedTeamId so new items land
// here automatically.

import { use, useMemo, useRef, useState } from "react";
import { Package, Pencil, Plus, Trash2, UserMinus } from "@babun/shared/icons";
import { haptic } from "@/lib/haptics";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useEquipment, useTeams } from "@/app/dashboard/layout";
import type { Equipment } from "@babun/shared/local/equipment";
import BrigadeSectionShell from "@/components/teams/BrigadeSectionShell";
import ContextMenu, {
  type ContextMenuOption,
} from "@/components/ui/ContextMenu";
import SwipeableRow from "@/components/ui/SwipeableRow";
import { EquipmentFormModal } from "@/app/dashboard/inventory/page";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function BrigadeEquipmentPage({ params }: RouteParams) {
  const { id } = use(params);
  const confirm = useConfirm();
  const { teams } = useTeams();
  const { equipment, upsertEquipment, deleteEquipment } = useEquipment();
  const team = teams.find((t) => t.id === id);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [menu, setMenu] = useState<{
    item: Equipment;
    anchor: { x: number; y: number };
  } | null>(null);

  const list = useMemo(
    () =>
      equipment
        .filter(
          (e) => e.is_active !== false && e.assigned_team_id === id,
        )
        .sort(
          (a, b) =>
            (a.sort_order ?? Number.POSITIVE_INFINITY) -
              (b.sort_order ?? Number.POSITIVE_INFINITY) ||
            (a.created_at ?? "").localeCompare(b.created_at ?? ""),
        ),
    [equipment, id],
  );

  if (!team) {
    return (
      <BrigadeSectionShell brigadeId={id} title="Оборудование" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Бригада не найдена.
        </div>
      </BrigadeSectionShell>
    );
  }

  const removeFromBrigade = (item: Equipment) => {
    haptic("warning");
    upsertEquipment({ ...item, assigned_team_id: null });
  };

  const deleteForever = async (item: Equipment) => {
    const ok = await confirm({
      title: `Удалить «${item.name}»?`,
      message: "Позиция пропадёт из инвентаря полностью.",
      confirmLabel: "Удалить",
    });
    if (!ok) return;
    haptic("warning");
    deleteEquipment(item.id);
  };

  const menuOptions: ContextMenuOption[] = menu
    ? [
        {
          label: "Редактировать",
          icon: <Pencil size={18} strokeWidth={2} />,
          onSelect: () => setEditing(menu.item),
        },
        {
          label: "Снять с бригады (на полку)",
          icon: <UserMinus size={18} strokeWidth={2} />,
          onSelect: () => removeFromBrigade(menu.item),
        },
        {
          label: "Удалить навсегда",
          icon: <Trash2 size={18} strokeWidth={2} />,
          danger: true,
          onSelect: () => deleteForever(menu.item),
        },
      ]
    : [];

  return (
    <BrigadeSectionShell brigadeId={id} title="Оборудование" hideSave>
      {list.length === 0 ? (
        <div className="px-6 pt-8 pb-4 flex flex-col items-center text-center gap-3">
          <span className="w-14 h-14 rounded-full bg-[var(--accent-tint)] flex items-center justify-center text-[var(--accent)]">
            <Package size={24} strokeWidth={2} />
          </span>
          <div>
            <div className="text-[15px] font-semibold text-[var(--label)]">
              За бригадой пока ничего нет
            </div>
            <div className="mt-1 text-[13px] leading-snug text-[var(--label-secondary)]">
              Добавьте инструмент, машины или приборы — они появятся тут и на странице общего инвентаря.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-2 h-11 px-5 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold press-scale"
          >
            Добавить
          </button>
        </div>
      ) : (
        <>
          <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
            {list.map((item) => (
              <SwipeableRow
                key={item.id}
                leftActions={[
                  {
                    label: "На полку",
                    color: "bg-[var(--system-yellow)]",
                    icon: <UserMinus size={16} strokeWidth={2} />,
                    onSelect: () => removeFromBrigade(item),
                  },
                ]}
                rightActions={[
                  {
                    label: "Удалить",
                    color: "bg-[var(--system-red)]",
                    icon: <Trash2 size={16} strokeWidth={2} />,
                    onSelect: () => deleteForever(item),
                  },
                ]}
              >
                <Row
                  item={item}
                  teamColor={team.color}
                  onTap={() => setEditing(item)}
                  onLongPress={(anchor) => setMenu({ item, anchor })}
                />
              </SwipeableRow>
            ))}
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left active:bg-[var(--fill-quaternary)] transition press-scale"
            >
              <span className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--accent-tint)] text-[var(--accent)] shrink-0">
                <Plus size={18} strokeWidth={2.5} />
              </span>
              <span className="flex-1 text-[15px] font-medium text-[var(--accent)]">
                Добавить
              </span>
            </button>
          </div>
          <div className="px-4 pt-0.5 text-[12px] leading-snug text-[var(--label-tertiary)]">
            Тап — редактировать. Свайп вправо — на полку. Свайп влево — удалить. Долгое нажатие — меню.
          </div>
        </>
      )}

      <EquipmentFormModal
        open={addOpen}
        mode="create"
        teams={teams}
        lockedTeamId={team.id}
        onClose={() => setAddOpen(false)}
        onSubmit={(item) => {
          upsertEquipment(item);
          setAddOpen(false);
        }}
      />
      <EquipmentFormModal
        open={!!editing}
        mode="edit"
        item={editing}
        teams={teams}
        onClose={() => setEditing(null)}
        onSubmit={(item) => {
          upsertEquipment(item);
          setEditing(null);
        }}
      />
      <ContextMenu
        open={!!menu}
        onClose={() => setMenu(null)}
        anchor={menu?.anchor ?? null}
        title={menu?.item.name}
        options={menuOptions}
      />
    </BrigadeSectionShell>
  );
}

function Row({
  item,
  teamColor,
  onTap,
  onLongPress,
}: {
  item: Equipment;
  teamColor: string;
  onTap: () => void;
  onLongPress: (anchor: { x: number; y: number }) => void;
}) {
  const handlers = useLongPressOrTap({ onTap, onLongPress });
  const tile = item.color ?? teamColor ?? "#8E8E93";
  const subtitle = [item.category, item.serial].filter(Boolean).join(" · ");
  return (
    <div
      {...handlers}
      className="flex items-center gap-3 px-4 min-h-[56px] py-2 cursor-pointer select-none active:bg-[var(--fill-quaternary)] transition"
      style={{
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      <span
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--label-on-accent)] shrink-0"
        style={{ backgroundColor: tile }}
      >
        <Package size={16} strokeWidth={2.2} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] text-[var(--label)] truncate">
          {item.name || "Без названия"}
        </div>
        {subtitle && (
          <div className="text-[12px] text-[var(--label-secondary)] truncate">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

// Local copy of the long-press hook (same shape as cities / services).
function useLongPressOrTap({
  onTap,
  onLongPress,
  delay = 500,
}: {
  onTap: () => void;
  onLongPress: (anchor: { x: number; y: number }) => void;
  delay?: number;
}) {
  const timer = useRef<number | null>(null);
  const triggered = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const cancel = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      triggered.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        triggered.current = true;
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate?.(12);
        }
        if (origin.current) onLongPress(origin.current);
      }, delay);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!origin.current || timer.current == null) return;
      const dx = Math.abs(e.clientX - origin.current.x);
      const dy = Math.abs(e.clientY - origin.current.y);
      if (dx > 10 || dy > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClick: (e: React.MouseEvent) => {
      if (triggered.current) {
        e.preventDefault();
        e.stopPropagation();
        triggered.current = false;
        return;
      }
      onTap();
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
    },
  };
}
