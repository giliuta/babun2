"use client";

// Sprint 033 Phase I26 — Inventory MVP v1.
//
// Shipped per user feedback: "Сделай чтобы было, я сам пользоваться
// не буду, но для SaaS полезно." Minimal register of physical things
// the tenant owns, grouped by brigade assignment.
//
// In this pass:
//  · Add / edit / delete equipment.
//  · Assign to a brigade (or leave "на полке").
//  · Group list by assigned brigade + "Не закреплено" bucket.
//  · Long-press row → context menu (Редактировать / Передать… / Удалить).
//  · Swipe left → delete.
//  · Global /dashboard/inventory. Brigade's own list lives at
//    /dashboard/teams/[id]/equipment.
//
// Deliberately not in v1:
//  · Assigning to a specific master (per-master handoff).
//  · Service / calibration reminders.
//  · Drag-to-reorder (simple sort by created_at for now).
//  · Amortisation on finances.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  MapPin,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserMinus,
  X,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import ContextMenu, {
  type ContextMenuOption,
} from "@/components/ui/ContextMenu";
import SwipeableRow from "@/components/ui/SwipeableRow";
import { haptic } from "@/lib/haptics";
import { useEquipment, useTeams } from "@/app/dashboard/layout";
import {
  createBlankEquipment,
  type Equipment,
} from "@babun/shared/local/equipment";
import { PRESET_COLOR_VALUES } from "@babun/shared/common/utils/colors";
import type { Team } from "@babun/shared/local/masters";

function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е");
}

export default function InventoryPage() {
  const { equipment, upsertEquipment, deleteEquipment } = useEquipment();
  const { teams } = useTeams();
  const confirm = useConfirm();

  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [menu, setMenu] = useState<{
    item: Equipment;
    anchor: { x: number; y: number };
  } | null>(null);

  const active = useMemo(
    () =>
      equipment
        .filter((e) => e.is_active !== false)
        .sort(
          (a, b) =>
            (a.sort_order ?? Number.POSITIVE_INFINITY) -
              (b.sort_order ?? Number.POSITIVE_INFINITY) ||
            (a.created_at ?? "").localeCompare(b.created_at ?? ""),
        ),
    [equipment],
  );
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return active;
    return active.filter(
      (e) =>
        normalize(e.name).includes(q) ||
        (e.serial && normalize(e.serial).includes(q)) ||
        (e.category && normalize(e.category).includes(q)),
    );
  }, [active, query]);

  // Grouped: one bucket per brigade + an "unassigned" bucket at top.
  type Bucket = { key: string; label: string; items: Equipment[] };
  const buckets: Bucket[] = useMemo(() => {
    const byTeam = new Map<string | null, Equipment[]>();
    filtered.forEach((e) => {
      const k = e.assigned_team_id ?? null;
      const arr = byTeam.get(k) ?? [];
      arr.push(e);
      byTeam.set(k, arr);
    });
    const out: Bucket[] = [];
    const shelf = byTeam.get(null) ?? [];
    if (shelf.length > 0) {
      out.push({ key: "__shelf__", label: "На полке", items: shelf });
    }
    teams
      .slice()
      .sort(
        (a, b) =>
          (a.sort_order ?? Number.POSITIVE_INFINITY) -
          (b.sort_order ?? Number.POSITIVE_INFINITY),
      )
      .forEach((t) => {
        const items = byTeam.get(t.id) ?? [];
        if (items.length > 0) {
          out.push({ key: t.id, label: t.name, items });
        }
      });
    // Orphan buckets — equipment tied to a team that no longer exists.
    Array.from(byTeam.entries()).forEach(([k, items]) => {
      if (k === null) return;
      if (teams.some((t) => t.id === k)) return;
      out.push({ key: k, label: "Удалённая бригада", items });
    });
    return out;
  }, [filtered, teams]);

  const remove = async (e: Equipment) => {
    const ok = await confirm({
      title: `Удалить «${e.name}»?`,
      message: "Позиция пропадёт из инвентаря.",
      confirmLabel: "Удалить",
    });
    if (!ok) return;
    haptic("warning");
    deleteEquipment(e.id);
  };

  const transfer = (e: Equipment, nextTeamId: string | null) => {
    haptic("tap");
    upsertEquipment({ ...e, assigned_team_id: nextTeamId });
  };

  const menuOptions: ContextMenuOption[] = menu
    ? [
        {
          label: "Редактировать",
          icon: <Pencil size={18} strokeWidth={2} />,
          onSelect: () => setEditing(menu.item),
        },
        ...(menu.item.assigned_team_id
          ? [
              {
                label: "Снять с бригады (на полку)",
                icon: <UserMinus size={18} strokeWidth={2} />,
                onSelect: () => transfer(menu.item, null),
              },
            ]
          : []),
        {
          label: "Удалить",
          icon: <Trash2 size={18} strokeWidth={2} />,
          danger: true,
          onSelect: () => remove(menu.item),
        },
      ]
    : [];

  const totalCount = active.length;

  return (
    <>
      <PageHeader title="Оборудование" />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-2xl mx-auto px-3 py-4 pb-[calc(env(safe-area-inset-bottom)+80px)] space-y-4">
          {totalCount === 0 ? (
            <EmptyState onAdd={() => setAddOpen(true)} />
          ) : (
            <>
              <div className="relative">
                <Search
                  size={16}
                  strokeWidth={2}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--label-tertiary)] pointer-events-none"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск по названию или серии"
                  className="w-full h-10 pl-9 pr-9 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:ring-2 focus:ring-[var(--accent)]"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Очистить"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-[var(--fill-secondary)] text-[var(--label-tertiary)] press-scale"
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                )}
              </div>

              {buckets.map((b) => (
                <div key={b.key}>
                  <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
                    {b.label}
                    <span className="ml-1 text-[var(--label-tertiary)] font-normal normal-case tracking-normal">
                      · {b.items.length}
                    </span>
                  </div>
                  <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
                    {b.items.map((item) => (
                      <SwipeableRow
                        key={item.id}
                        rightActions={[
                          {
                            label: "Удалить",
                            color: "bg-[var(--system-red)]",
                            icon: <Trash2 size={16} strokeWidth={2} />,
                            onSelect: () => remove(item),
                          },
                        ]}
                      >
                        <EquipmentRow
                          item={item}
                          teams={teams}
                          onTap={() => setEditing(item)}
                          onLongPress={(anchor) =>
                            setMenu({ item, anchor })
                          }
                        />
                      </SwipeableRow>
                    ))}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] active:bg-[var(--fill-quaternary)] transition press-scale"
              >
                <span className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--accent-tint)] text-[var(--accent)] shrink-0">
                  <Plus size={18} strokeWidth={2.5} />
                </span>
                <span className="flex-1 text-[15px] font-medium text-[var(--accent)]">
                  Новое оборудование
                </span>
              </button>

              {filtered.length === 0 && query && (
                <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-5 text-center text-[13px] text-[var(--label-tertiary)]">
                  Ничего не найдено по запросу «{query}».
                </div>
              )}

              <div className="px-4 pt-0.5 text-[12px] leading-snug text-[var(--label-tertiary)]">
                Тап — редактировать. Долгое нажатие — меню. Свайп влево — удалить.
              </div>
            </>
          )}
        </div>
      </div>

      <EquipmentFormModal
        open={addOpen}
        mode="create"
        teams={teams}
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
    </>
  );
}

// ─── Row ──────────────────────────────────────────────────────────

function EquipmentRow({
  item,
  teams,
  onTap,
  onLongPress,
}: {
  item: Equipment;
  teams: Team[];
  onTap: () => void;
  onLongPress: (anchor: { x: number; y: number }) => void;
}) {
  const handlers = useLongPressOrTap({ onTap, onLongPress });
  const team = teams.find((t) => t.id === item.assigned_team_id);
  const tile = item.color ?? team?.color ?? "#8E8E93";
  const subtitle = [item.category, item.serial]
    .filter(Boolean)
    .join(" · ");
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

// ─── Empty state ──────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="px-6 pt-10 pb-4 flex flex-col items-center text-center gap-3">
      <span className="w-16 h-16 rounded-full bg-[var(--accent-tint)] flex items-center justify-center text-[var(--accent)]">
        <Package size={28} strokeWidth={2} />
      </span>
      <div>
        <div className="text-[17px] font-semibold text-[var(--label)]">
          Пока нет оборудования
        </div>
        <div className="mt-1 text-[13px] leading-snug text-[var(--label-secondary)]">
          Заведите инструмент, машины, приборы — потом можно закреплять за&nbsp;бригадами.
        </div>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-3 h-11 px-5 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold press-scale"
      >
        Добавить первое
      </button>
    </div>
  );
}

// ─── Form modal ───────────────────────────────────────────────────

export function EquipmentFormModal({
  open,
  mode,
  item,
  teams,
  lockedTeamId,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  item?: Equipment | null;
  teams: Team[];
  /** When set, the team picker is pre-populated and hidden — used by
   *  the brigade subroute to scope new items to that brigade. */
  lockedTeamId?: string;
  onClose: () => void;
  onSubmit: (item: Equipment) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [serial, setSerial] = useState("");
  const [teamId, setTeamId] = useState<string>("");
  const [color, setColor] = useState<string>("");
  const [notes, setNotes] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && item) {
      setName(item.name);
      setCategory(item.category ?? "");
      setSerial(item.serial ?? "");
      setTeamId(item.assigned_team_id ?? "");
      setColor(item.color ?? "");
      setNotes(item.notes ?? "");
    } else {
      setName("");
      setCategory("");
      setSerial("");
      setTeamId(lockedTeamId ?? "");
      setColor("");
      setNotes("");
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open, mode, item, lockedTeamId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    haptic("tap");
    if (mode === "edit" && item) {
      onSubmit({
        ...item,
        name: trimmed,
        category: category.trim() || undefined,
        serial: serial.trim() || undefined,
        assigned_team_id: teamId || null,
        color: color || undefined,
        notes: notes.trim() || undefined,
      });
    } else {
      onSubmit(
        createBlankEquipment({
          name: trimmed,
          category: category.trim() || undefined,
          serial: serial.trim() || undefined,
          assigned_team_id: teamId || null,
          color: color || undefined,
          notes: notes.trim() || undefined,
        }),
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[380px] bg-[var(--surface-grouped)] rounded-[16px] overflow-hidden shadow-[var(--shadow-sheet)] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 bg-[var(--surface-card)] border-b border-[var(--separator)] text-center shrink-0">
          <div className="text-[17px] font-semibold text-[var(--label)] tracking-tight">
            {mode === "create" ? "Новое оборудование" : "Редактировать"}
          </div>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1">
              Название <span className="text-[var(--system-red)]">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="Название предмета"
              className="mt-1 w-full h-11 px-3 rounded-[10px] bg-[var(--surface-card)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              maxLength={80}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1">
                Категория
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Инструмент"
                className="mt-1 w-full h-11 px-3 rounded-[10px] bg-[var(--surface-card)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                maxLength={40}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1">
                Серия
              </label>
              <input
                type="text"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder="S/N"
                className="mt-1 w-full h-11 px-3 rounded-[10px] bg-[var(--surface-card)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                maxLength={40}
              />
            </div>
          </div>

          {!lockedTeamId && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1">
                Закреплено за
              </label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setTeamId("")}
                  className={`h-8 px-3 rounded-full text-[13px] font-medium press-scale flex items-center gap-1.5 transition ${
                    teamId === ""
                      ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                      : "bg-[var(--surface-card)] text-[var(--label)]"
                  }`}
                >
                  <MapPin size={12} strokeWidth={2} />
                  На полке
                </button>
                {teams.map((t) => {
                  const picked = t.id === teamId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTeamId(t.id)}
                      className={`h-8 px-3 rounded-full text-[13px] font-medium press-scale flex items-center gap-1.5 transition ${
                        picked
                          ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                          : "bg-[var(--surface-card)] text-[var(--label)]"
                      }`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: t.color }}
                      />
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1">
              Цвет
            </label>
            <div className="mt-1 bg-[var(--surface-card)] rounded-[10px] p-3">
              <div className="grid grid-cols-7 gap-2">
                <button
                  type="button"
                  onClick={() => setColor("")}
                  className="relative w-full aspect-square rounded-full press-scale flex items-center justify-center bg-[var(--fill-tertiary)]"
                  aria-label="Без цвета"
                >
                  {color === "" && (
                    <Check
                      size={14}
                      strokeWidth={3}
                      className="text-[var(--label-secondary)]"
                    />
                  )}
                </button>
                {PRESET_COLOR_VALUES.map((c) => {
                  const picked = c === color;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="relative w-full aspect-square rounded-full press-scale flex items-center justify-center"
                      style={{ backgroundColor: c }}
                    >
                      {picked && (
                        <Check
                          size={14}
                          strokeWidth={3}
                          className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1">
              Заметки
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Например: требует калибровки раз в год"
              rows={2}
              className="mt-1 w-full px-3 py-2 rounded-[10px] bg-[var(--surface-card)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
              maxLength={200}
            />
          </div>
        </div>

        <div className="px-4 pb-4 pt-1 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] font-medium text-[var(--label)] press-scale"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[15px] font-semibold text-[var(--label-on-accent)] press-scale disabled:opacity-40 disabled:pointer-events-none"
          >
            {mode === "create" ? "Создать" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Long-press + tap hook ────────────────────────────────────────

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
