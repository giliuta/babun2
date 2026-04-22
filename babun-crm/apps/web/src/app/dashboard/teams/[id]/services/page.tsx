"use client";

// Sprint 033 Phase I16 — Brigade services, iOS-Settings redesign.
//
// Pattern matches Метки / Мастера / Brigades:
//  · hideSave + instant persist on every toggle
//  · Tap row = toggle inclusion for this brigade
//  · Long-press row = anchored context menu (Редактировать / Убрать
//    из бригады / Удалить навсегда)
//  · Swipe left = red «Убрать» (or «Удалить навсегда» if this is
//    the only brigade using it)
//  · Category groups shown as separate list cards; each header has
//    a "Выбрать все" / "Снять" chip
//  · Search input above; when nothing matches → single helpful line
//  · Edit and Add flows moved from inline-in-card to a centered
//    modal (ServiceFormModal) — no more expanding form rows
//  · The old "Доступны все услуги" banner is demoted to a footer
//    hint below the list when the brigade has zero selected
//
// Semantics unchanged:
//  · Editing a service edits the global catalog (shared by all
//    brigades), matches existing data-model behaviour.
//  · "Delete" checks whether any other brigade uses it: if yes,
//    just removes this brigade from service.brigade_ids; if no,
//    flips is_active=false.

import { use, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserMinus,
  X,
} from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useServices, useTeams } from "@/app/dashboard/layout";
import {
  createBlankService,
  type Service,
  type ServiceCategory,
} from "@/lib/services";
import BrigadeSectionShell from "@/components/teams/BrigadeSectionShell";
import ContextMenu, {
  type ContextMenuOption,
} from "@/components/ui/ContextMenu";
import SwipeableRow from "@/components/ui/SwipeableRow";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е");
}

export default function BrigadeServicesPage({ params }: RouteParams) {
  const { id } = use(params);
  const confirm = useConfirm();
  const { teams } = useTeams();
  const { services, categories, upsertService } = useServices();
  const team = teams.find((t) => t.id === id);

  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<{
    service: Service;
    anchor: { x: number; y: number };
  } | null>(null);
  const [editing, setEditing] = useState<Service | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const activeAll = useMemo(
    () => services.filter((s) => s.is_active !== false),
    [services],
  );
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return activeAll;
    return activeAll.filter((s) => normalize(s.name).includes(q));
  }, [activeAll, query]);

  if (!team) {
    return (
      <BrigadeSectionShell brigadeId={id} title="Услуги" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Бригада не найдена.
        </div>
      </BrigadeSectionShell>
    );
  }

  const hasService = (svc: Service) => svc.brigade_ids.includes(team.id);
  const selectedCount = activeAll.filter(hasService).length;
  const totalCount = activeAll.length;

  const toggle = (svc: Service) => {
    haptic("tap");
    upsertService({
      ...svc,
      brigade_ids: hasService(svc)
        ? svc.brigade_ids.filter((b) => b !== team.id)
        : [...svc.brigade_ids, team.id],
    });
  };

  const bulkSet = (list: Service[], attach: boolean) => {
    haptic("tap");
    for (const svc of list) {
      if (attach && !hasService(svc)) {
        upsertService({ ...svc, brigade_ids: [...svc.brigade_ids, team.id] });
      } else if (!attach && hasService(svc)) {
        upsertService({
          ...svc,
          brigade_ids: svc.brigade_ids.filter((b) => b !== team.id),
        });
      }
    }
  };

  const removeFromBrigade = (svc: Service) => {
    haptic("warning");
    upsertService({
      ...svc,
      brigade_ids: svc.brigade_ids.filter((b) => b !== team.id),
    });
  };

  const deleteForever = async (svc: Service) => {
    const usedElsewhere =
      svc.brigade_ids.filter((b) => b !== team.id).length > 0;
    if (usedElsewhere) {
      // Only detach from this brigade — others still need it.
      removeFromBrigade(svc);
      return;
    }
    const ok = await confirm({
      title: `Удалить услугу «${svc.name}»?`,
      message: "Эта услуга используется только этой бригадой и пропадёт полностью.",
      confirmLabel: "Удалить",
    });
    if (!ok) return;
    haptic("warning");
    upsertService({ ...svc, is_active: false, brigade_ids: [] });
  };

  const menuOptions: ContextMenuOption[] = menu
    ? [
        {
          label: "Редактировать",
          icon: <Pencil size={18} strokeWidth={2} />,
          onSelect: () => setEditing(menu.service),
        },
        ...(hasService(menu.service)
          ? [
              {
                label: "Убрать из бригады",
                icon: <UserMinus size={18} strokeWidth={2} />,
                onSelect: () => removeFromBrigade(menu.service),
              },
            ]
          : []),
        {
          label: "Удалить навсегда",
          icon: <Trash2 size={18} strokeWidth={2} />,
          danger: true,
          onSelect: () => deleteForever(menu.service),
        },
      ]
    : [];

  const allSelected = selectedCount === totalCount && totalCount > 0;

  // Build a list of non-empty categories after filtering.
  const categoriesWithServices = useMemo(() => {
    return categories
      .map((cat) => ({
        cat,
        list: filtered.filter(
          (s) => s.category_id === cat.id && s.is_active !== false,
        ),
      }))
      .filter((x) => x.list.length > 0);
  }, [categories, filtered]);

  // Services without a category.
  const orphanServices = useMemo(
    () =>
      filtered.filter(
        (s) => !s.category_id || !categories.some((c) => c.id === s.category_id),
      ),
    [filtered, categories],
  );

  return (
    <BrigadeSectionShell brigadeId={id} title="Услуги" hideSave>
      {totalCount === 0 ? (
        <EmptyState onAdd={() => setAddOpen(true)} />
      ) : (
        <>
          {/* Search + bulk-all */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search
                size={16}
                strokeWidth={2}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--label-tertiary)] pointer-events-none"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по названию"
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
            <button
              type="button"
              onClick={() => bulkSet(activeAll, !allSelected)}
              className="shrink-0 h-10 px-3 rounded-full text-[13px] font-medium press-scale bg-[var(--fill-tertiary)] text-[var(--label)] active:bg-[var(--fill-secondary)]"
            >
              {allSelected ? "Снять все" : "Выбрать все"}
            </button>
          </div>

          {/* Category-grouped lists */}
          {categoriesWithServices.map(({ cat, list }) => (
            <CategorySection
              key={cat.id}
              cat={cat}
              list={list}
              hasService={hasService}
              onBulkSet={(attach) => bulkSet(list, attach)}
              onTap={toggle}
              onLongPress={(svc, anchor) => setMenu({ service: svc, anchor })}
              onRemove={removeFromBrigade}
              onDelete={deleteForever}
            />
          ))}

          {orphanServices.length > 0 && (
            <CategorySection
              cat={{
                id: "__orphans__",
                name: "Без категории",
                color: "#8E8E93",
              } as ServiceCategory}
              list={orphanServices}
              hasService={hasService}
              onBulkSet={(attach) => bulkSet(orphanServices, attach)}
              onTap={toggle}
              onLongPress={(svc, anchor) => setMenu({ service: svc, anchor })}
              onRemove={removeFromBrigade}
              onDelete={deleteForever}
            />
          )}

          {/* Add new */}
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 min-h-[52px] text-left bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] active:bg-[var(--fill-quaternary)] transition press-scale"
          >
            <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--accent-tint)] text-[var(--accent)] shrink-0">
              <Plus size={18} strokeWidth={2.5} />
            </span>
            <span className="flex-1 text-[15px] font-medium text-[var(--accent)]">
              Новая услуга
            </span>
          </button>

          {/* Empty search result */}
          {filtered.length === 0 && query && (
            <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-5 text-center text-[13px] text-[var(--label-tertiary)]">
              Ничего не найдено по запросу «{query}».
            </div>
          )}

          {/* Footer hint */}
          <div className="px-4 pt-0.5 text-[12px] leading-snug text-[var(--label-tertiary)]">
            {selectedCount === 0
              ? "Ничего не отмечено — при записи клиента в эту бригаду видны все услуги."
              : `Выбрано ${selectedCount} из ${totalCount}. Тап — переключить. Долгое нажатие — меню. Свайп влево — убрать.`}
          </div>
        </>
      )}

      <ContextMenu
        open={!!menu}
        onClose={() => setMenu(null)}
        anchor={menu?.anchor ?? null}
        title={menu?.service.name}
        options={menuOptions}
      />

      <ServiceFormModal
        open={addOpen}
        mode="create"
        brigadeId={team.id}
        categories={categories}
        onClose={() => setAddOpen(false)}
        onSubmit={(svc) => {
          upsertService(svc);
          setAddOpen(false);
        }}
      />
      <ServiceFormModal
        open={!!editing}
        mode="edit"
        service={editing}
        brigadeId={team.id}
        categories={categories}
        onClose={() => setEditing(null)}
        onSubmit={(svc) => {
          upsertService(svc);
          setEditing(null);
        }}
      />
    </BrigadeSectionShell>
  );
}

// ─── Category section ─────────────────────────────────────────────

function CategorySection({
  cat,
  list,
  hasService,
  onBulkSet,
  onTap,
  onLongPress,
  onRemove,
  onDelete,
}: {
  cat: ServiceCategory;
  list: Service[];
  hasService: (svc: Service) => boolean;
  onBulkSet: (attach: boolean) => void;
  onTap: (svc: Service) => void;
  onLongPress: (svc: Service, anchor: { x: number; y: number }) => void;
  onRemove: (svc: Service) => void;
  onDelete: (svc: Service) => void;
}) {
  const selected = list.filter(hasService).length;
  const catAll = selected === list.length;
  return (
    <div>
      <div className="px-4 pb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: cat.color }}
          />
          <div className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)] truncate">
            {cat.name}
          </div>
          <div className="text-[11px] text-[var(--label-tertiary)] tabular-nums shrink-0">
            {selected}/{list.length}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onBulkSet(!catAll)}
          className="shrink-0 h-7 px-2.5 rounded-full text-[12px] font-medium press-scale bg-[var(--fill-tertiary)] text-[var(--label)] active:bg-[var(--fill-secondary)]"
        >
          {catAll ? "Снять" : "Выбрать все"}
        </button>
      </div>
      <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
        {list.map((s) => {
          const inBrigade = hasService(s);
          return (
            <SwipeableRow
              key={s.id}
              rightActions={
                inBrigade
                  ? [
                      {
                        label: "Убрать",
                        color: "bg-[var(--system-red)]",
                        icon: <UserMinus size={16} strokeWidth={2} />,
                        onSelect: () => onRemove(s),
                      },
                    ]
                  : [
                      {
                        label: "Удалить",
                        color: "bg-[var(--system-red)]",
                        icon: <Trash2 size={16} strokeWidth={2} />,
                        onSelect: () => onDelete(s),
                      },
                    ]
              }
            >
              <ServiceRow
                service={s}
                cat={cat}
                selected={inBrigade}
                onTap={() => onTap(s)}
                onLongPress={(a) => onLongPress(s, a)}
              />
            </SwipeableRow>
          );
        })}
      </div>
    </div>
  );
}

// ─── Service row ──────────────────────────────────────────────────

function ServiceRow({
  service,
  cat,
  selected,
  onTap,
  onLongPress,
}: {
  service: Service;
  cat: ServiceCategory;
  selected: boolean;
  onTap: () => void;
  onLongPress: (anchor: { x: number; y: number }) => void;
}) {
  const handlers = useLongPressOrTap({ onTap, onLongPress });
  return (
    <div
      {...handlers}
      className={`flex items-center gap-3 px-4 min-h-[56px] py-2 cursor-pointer select-none active:bg-[var(--fill-quaternary)] transition ${
        selected ? "bg-[var(--accent-tint)]" : ""
      }`}
      style={{
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      <span
        className="w-2 h-8 rounded-full shrink-0"
        style={{ backgroundColor: cat.color }}
      />
      <div className="flex-1 min-w-0">
        <div
          className={`text-[15px] truncate ${
            selected
              ? "font-semibold text-[var(--accent)]"
              : "text-[var(--label)]"
          }`}
        >
          {service.name}
        </div>
        <div className="text-[12px] text-[var(--label-secondary)] tabular-nums">
          {service.duration_minutes} мин · €{service.price}
        </div>
      </div>
      {selected ? (
        <Check
          size={20}
          strokeWidth={3}
          className="text-[var(--accent)] shrink-0"
        />
      ) : (
        <span className="w-5" />
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="px-6 pt-10 pb-4 flex flex-col items-center text-center gap-3">
      <span className="w-16 h-16 rounded-full bg-[var(--accent-tint)] flex items-center justify-center text-[var(--accent)]">
        <Plus size={28} strokeWidth={2.2} />
      </span>
      <div>
        <div className="text-[17px] font-semibold text-[var(--label)]">
          Пока нет услуг
        </div>
        <div className="mt-1 text-[13px] leading-snug text-[var(--label-secondary)]">
          Добавьте первую — она появится при записи клиента в&nbsp;эту бригаду.
        </div>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-3 h-11 px-5 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold press-scale"
      >
        Добавить услугу
      </button>
    </div>
  );
}

// ─── Service form modal (create/edit) ─────────────────────────────

function ServiceFormModal({
  open,
  mode,
  service,
  brigadeId,
  categories,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  service?: Service | null;
  brigadeId: string;
  categories: ServiceCategory[];
  onClose: () => void;
  onSubmit: (svc: Service) => void;
}) {
  const [name, setName] = useState("");
  const [min, setMin] = useState(60);
  const [price, setPrice] = useState(0);
  const [categoryId, setCategoryId] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && service) {
      setName(service.name);
      setMin(service.duration_minutes);
      setPrice(service.price);
      setCategoryId(service.category_id ?? "");
    } else {
      setName("");
      setMin(60);
      setPrice(0);
      setCategoryId(categories[0]?.id ?? "");
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open, mode, service, categories]);

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

  const canSubmit = name.trim().length > 0 && min > 0;

  const submit = () => {
    if (!canSubmit) return;
    haptic("tap");
    if (mode === "edit" && service) {
      onSubmit({
        ...service,
        name: name.trim(),
        duration_minutes: Math.max(1, min),
        price: Math.max(0, price),
        category_id: categoryId || null,
      });
    } else {
      onSubmit(
        createBlankService({
          name: name.trim(),
          duration_minutes: Math.max(1, min),
          price: Math.max(0, price),
          category_id: categoryId || null,
          brigade_ids: [brigadeId],
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
        className="w-full max-w-[360px] bg-[var(--surface-grouped)] rounded-[16px] overflow-hidden shadow-[var(--shadow-sheet)] max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 bg-[var(--surface-card)] border-b border-[var(--separator)] text-center shrink-0">
          <div className="text-[17px] font-semibold text-[var(--label)] tracking-tight">
            {mode === "create" ? "Новая услуга" : "Редактировать услугу"}
          </div>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1">
              Название
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="Напр. Чистка кондиционера"
              className="mt-1 w-full h-11 px-3 rounded-[10px] bg-[var(--surface-card)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              maxLength={80}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1">
                Длительность
              </label>
              <div className="mt-1 flex items-center gap-2 bg-[var(--surface-card)] rounded-[10px] pr-3 focus-within:ring-2 focus-within:ring-[var(--accent)]">
                <input
                  type="number"
                  min={1}
                  step={5}
                  value={min}
                  onChange={(e) => setMin(Number(e.target.value) || 0)}
                  className="flex-1 min-w-0 h-11 pl-3 bg-transparent text-[15px] text-[var(--label)] focus:outline-none"
                />
                <span className="text-[13px] text-[var(--label-secondary)]">
                  мин
                </span>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1">
                Цена
              </label>
              <div className="mt-1 flex items-center gap-2 bg-[var(--surface-card)] rounded-[10px] pl-3 focus-within:ring-2 focus-within:ring-[var(--accent)]">
                <span className="text-[15px] text-[var(--label-secondary)]">
                  €
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value) || 0)}
                  className="flex-1 min-w-0 h-11 pr-3 bg-transparent text-[15px] text-[var(--label)] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {categories.length > 0 && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1">
                Категория
              </label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {categories.map((c) => {
                  const picked = c.id === categoryId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategoryId(c.id)}
                      className={`h-8 px-3 rounded-full text-[13px] font-medium press-scale flex items-center gap-1.5 transition ${
                        picked
                          ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                          : "bg-[var(--surface-card)] text-[var(--label)]"
                      }`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: c.color }}
                      />
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
