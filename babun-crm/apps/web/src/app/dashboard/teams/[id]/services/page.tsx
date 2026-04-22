"use client";

// Sprint 033 Phase I18 — Brigade services as a direct editor.
//
// User reframed the page:
//  · "Зачем мне выбирать услуги? Это не надо, просто добавлять их и
//    редактировать." → removed the per-service selection checkbox.
//    Every visible row IS in the brigade.
//  · "Группы: Чистка, Ремонт… я туда вношу услуги" → categories
//    surface as named groups. User can create a new group via
//    "Новая группа" and a service via "Новая услуга".
//  · "При удерживании могу переместить верх" → @dnd-kit with a
//    delay sensor so long-press picks the row up and vertical drag
//    swaps it with its neighbours. Sort order persisted on Service.
//
// Gestures:
//  · Tap row → opens edit modal (single action — no selection state)
//  · Long-press + drag vertically → reorder within the group
//  · Swipe left → red «Удалить» (removes this brigade from the
//    service's brigade_ids; if it was the only brigade, the service
//    is deactivated globally)

import { use, useEffect, useMemo, useRef, useState } from "react";
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
import {
  ChevronDown,
  Check,
  FolderPlus,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useServices, useTeams } from "@/app/dashboard/layout";
import {
  createBlankService,
  type PriceTier,
  type Service,
  type ServiceCategory,
  type ServiceMaterialCost,
} from "@/lib/services";
import { PRESET_COLOR_VALUES } from "@/lib/colors";
import { generateId } from "@/lib/masters";
import BrigadeSectionShell from "@/components/teams/BrigadeSectionShell";
import IOSSwitch from "@/components/ui/IOSSwitch";
import SwipeableRow from "@/components/ui/SwipeableRow";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е");
}

// Sort helpers — services sort by explicit sort_order asc, then created_at.
const sortServices = (a: Service, b: Service) => {
  const ao = a.sort_order ?? Number.POSITIVE_INFINITY;
  const bo = b.sort_order ?? Number.POSITIVE_INFINITY;
  if (ao !== bo) return ao - bo;
  return (a.created_at ?? "").localeCompare(b.created_at ?? "");
};

export default function BrigadeServicesPage({ params }: RouteParams) {
  const { id } = use(params);
  const confirm = useConfirm();
  const { teams } = useTeams();
  const { services, categories, upsertService, setCategories } = useServices();
  const team = teams.find((t) => t.id === id);

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Service | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);

  // Services belonging to this brigade (either explicitly listed or
  // legacy entries with empty brigade_ids = all brigades).
  const brigadeServices = useMemo(() => {
    if (!team) return [];
    return services
      .filter(
        (s) =>
          s.is_active !== false &&
          (s.brigade_ids.length === 0 || s.brigade_ids.includes(team.id)),
      )
      .sort(sortServices);
  }, [services, team]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return brigadeServices;
    return brigadeServices.filter((s) => normalize(s.name).includes(q));
  }, [brigadeServices, query]);

  // Sprint 033 Phase I20 — categories shown on THIS brigade's page
  // are scoped: only categories that have at least one active
  // service attached to this brigade are listed. Global
  // `categories` is still the storage of truth (ServiceCategory
  // lives at tenant level), but this brigade only sees what IT
  // uses. Fixes "откуда оно берёт группу если не в одной бригаде —
  // не указано". Empty brigades force the user to create a group
  // first via the modal.
  const brigadeCategories = useMemo(() => {
    const usedIds = new Set<string>();
    brigadeServices.forEach((s) => {
      if (s.category_id) usedIds.add(s.category_id);
    });
    return categories.filter((c) => usedIds.has(c.id));
  }, [brigadeServices, categories]);

  const categoriesWithServices = useMemo(() => {
    return brigadeCategories
      .map((cat) => ({
        cat,
        list: filtered.filter((s) => s.category_id === cat.id),
      }))
      .filter((x) => x.list.length > 0 || !query);
  }, [brigadeCategories, filtered, query]);

  const orphanServices = useMemo(
    () =>
      filtered.filter(
        (s) =>
          !s.category_id ||
          !brigadeCategories.some((c) => c.id === s.category_id),
      ),
    [filtered, brigadeCategories],
  );

  // DnD — activate drag after 500 ms hold with <6 px movement, so
  // taps and horizontal swipes still belong to SwipeableRow.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 500, tolerance: 6 },
    }),
  );

  if (!team) {
    return (
      <BrigadeSectionShell brigadeId={id} title="Услуги" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Бригада не найдена.
        </div>
      </BrigadeSectionShell>
    );
  }

  const removeFromBrigade = async (svc: Service) => {
    const usedElsewhere =
      svc.brigade_ids.filter((b) => b !== team.id).length > 0;
    if (svc.brigade_ids.length === 0) {
      // Legacy "everyone" service — confirm before global deletion.
      const ok = await confirm({
        title: `Удалить услугу «${svc.name}»?`,
        message: "Эта услуга была доступна всем бригадам и пропадёт полностью.",
        confirmLabel: "Удалить",
      });
      if (!ok) return;
      haptic("warning");
      upsertService({ ...svc, is_active: false, brigade_ids: [] });
      return;
    }
    if (usedElsewhere) {
      haptic("warning");
      upsertService({
        ...svc,
        brigade_ids: svc.brigade_ids.filter((b) => b !== team.id),
      });
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

  // Drop handler — reorders services within one category by writing
  // sort_order on the new sequence. Persists via upsertService.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    haptic("tap");
    // Find which category the dragged item belongs to — reorder in
    // that bucket only. Cross-category drag would move the service's
    // category_id and is out of scope for this pass.
    const activeSvc = services.find((s) => s.id === active.id);
    if (!activeSvc) return;
    const bucket = brigadeServices.filter(
      (s) => s.category_id === activeSvc.category_id,
    );
    const oldIdx = bucket.findIndex((s) => s.id === active.id);
    const newIdx = bucket.findIndex((s) => s.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(bucket, oldIdx, newIdx);
    // Assign sort_order in 10s so future inserts have gaps.
    reordered.forEach((svc, i) => {
      const next = (i + 1) * 10;
      if (svc.sort_order !== next) {
        upsertService({ ...svc, sort_order: next });
      }
    });
  };

  const createCategory = (name: string, color: string) => {
    if (!name.trim()) return;
    haptic("tap");
    setCategories([
      ...categories,
      { id: generateId("cat"), name: name.trim(), color },
    ]);
    setAddCategoryOpen(false);
  };

  const totalCount = brigadeServices.length;

  return (
    <BrigadeSectionShell brigadeId={id} title="Услуги" hideSave>
      {totalCount === 0 && !query ? (
        <EmptyState
          onAddService={() => setAddOpen(true)}
          onAddCategory={() => setAddCategoryOpen(true)}
        />
      ) : (
        <>
          {/* Search + top-level create actions */}
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
              onClick={() => setAddCategoryOpen(true)}
              aria-label="Новая группа"
              className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-[var(--fill-tertiary)] text-[var(--label)] active:bg-[var(--fill-secondary)] press-scale"
            >
              <FolderPlus size={18} strokeWidth={2} />
            </button>
          </div>

          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            {categoriesWithServices.map(({ cat, list }) => (
              <CategorySection
                key={cat.id}
                cat={cat}
                list={list}
                onTap={(svc) => setEditing(svc)}
                onRemove={removeFromBrigade}
                onAddService={() => {
                  setAddOpen(true);
                  // Default category will be picked up by the modal.
                }}
              />
            ))}

            {orphanServices.length > 0 && (
              <CategorySection
                cat={{
                  id: "__orphans__",
                  name: "Без группы",
                  color: "#8E8E93",
                }}
                list={orphanServices}
                onTap={(svc) => setEditing(svc)}
                onRemove={removeFromBrigade}
                onAddService={() => setAddOpen(true)}
              />
            )}
          </DndContext>

          {/* Add new service */}
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] active:bg-[var(--fill-quaternary)] transition press-scale"
          >
            <span className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--accent-tint)] text-[var(--accent)] shrink-0">
              <Plus size={18} strokeWidth={2.5} />
            </span>
            <span className="flex-1 text-[15px] font-medium text-[var(--accent)]">
              Новая услуга
            </span>
          </button>

          {filtered.length === 0 && query && (
            <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-5 text-center text-[13px] text-[var(--label-tertiary)]">
              Ничего не найдено по запросу «{query}».
            </div>
          )}

          <div className="px-4 pt-0.5 text-[12px] leading-snug text-[var(--label-tertiary)]">
            Тап — редактировать. Долгое нажатие — перетащить. Свайп влево — удалить.
          </div>
        </>
      )}

      <ServiceFormModal
        open={addOpen}
        mode="create"
        brigadeId={team.id}
        categories={brigadeCategories}
        onClose={() => setAddOpen(false)}
        onSubmit={(svc) => {
          upsertService(svc);
          setAddOpen(false);
        }}
        onCreateCategory={(name, color) => {
          const cat: ServiceCategory = {
            id: generateId("cat"),
            name: name.trim(),
            color,
          };
          setCategories([...categories, cat]);
          return cat.id;
        }}
      />
      <ServiceFormModal
        open={!!editing}
        mode="edit"
        service={editing}
        brigadeId={team.id}
        categories={brigadeCategories}
        onClose={() => setEditing(null)}
        onSubmit={(svc) => {
          upsertService(svc);
          setEditing(null);
        }}
        onCreateCategory={(name, color) => {
          const cat: ServiceCategory = {
            id: generateId("cat"),
            name: name.trim(),
            color,
          };
          setCategories([...categories, cat]);
          return cat.id;
        }}
      />
      <CategoryFormModal
        open={addCategoryOpen}
        onClose={() => setAddCategoryOpen(false)}
        onSubmit={createCategory}
      />
    </BrigadeSectionShell>
  );
}

// ─── Category group card ──────────────────────────────────────────

function CategorySection({
  cat,
  list,
  onTap,
  onRemove,
  onAddService,
}: {
  cat: ServiceCategory;
  list: Service[];
  onTap: (svc: Service) => void;
  onRemove: (svc: Service) => void;
  onAddService: () => void;
}) {
  return (
    <div>
      <div className="px-4 pb-1.5 flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: cat.color }}
        />
        <div className="flex-1 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)] truncate">
          {cat.name}
        </div>
        <button
          type="button"
          onClick={onAddService}
          aria-label="Добавить услугу в группу"
          className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full bg-[var(--fill-tertiary)] text-[var(--accent)] press-scale"
        >
          <Plus size={14} strokeWidth={2.5} />
        </button>
      </div>
      <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
        <SortableContext
          items={list.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {list.map((s) => (
            <SortableServiceRow
              key={s.id}
              service={s}
              cat={cat}
              onTap={() => onTap(s)}
              onRemove={() => onRemove(s)}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

// ─── Sortable row wrapper ─────────────────────────────────────────

function SortableServiceRow({
  service,
  cat,
  onTap,
  onRemove,
}: {
  service: Service;
  cat: ServiceCategory;
  onTap: () => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: service.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    position: "relative",
    boxShadow: isDragging
      ? "0 10px 24px rgba(0,0,0,0.18)"
      : undefined,
    background: isDragging ? "var(--surface-card)" : undefined,
    opacity: isDragging ? 0.95 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <SwipeableRow
        rightActions={[
          {
            label: "Удалить",
            color: "bg-[var(--system-red)]",
            icon: <Trash2 size={16} strokeWidth={2} />,
            onSelect: onRemove,
          },
        ]}
      >
        <div
          {...listeners}
          onClick={(e) => {
            // dnd-kit steals pointerup when an actual drag happened;
            // plain clicks fall through to us — treat as "open edit".
            if (!isDragging) onTap();
            else e.preventDefault();
          }}
          className="flex items-center gap-3 px-4 min-h-[56px] py-2 cursor-pointer select-none active:bg-[var(--fill-quaternary)] transition"
          style={{
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
            touchAction: "pan-y",
          }}
        >
          <span
            className="w-2 h-8 rounded-full shrink-0"
            style={{ backgroundColor: cat.color }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[15px] text-[var(--label)] truncate">
              {service.name}
            </div>
            <div className="text-[12px] text-[var(--label-secondary)] tabular-nums">
              {service.duration_minutes} мин · €{service.price}
            </div>
          </div>
        </div>
      </SwipeableRow>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────

function EmptyState({
  onAddService,
  onAddCategory,
}: {
  onAddService: () => void;
  onAddCategory: () => void;
}) {
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
          Сначала сделайте группу (Чистка, Ремонт…), потом добавляйте услуги. Или просто добавьте первую.
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onAddCategory}
          className="h-11 px-4 rounded-full bg-[var(--fill-tertiary)] text-[var(--label)] text-[14px] font-medium press-scale flex items-center gap-1.5"
        >
          <FolderPlus size={16} strokeWidth={2} />
          Новая группа
        </button>
        <button
          type="button"
          onClick={onAddService}
          className="h-11 px-5 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold press-scale"
        >
          Новая услуга
        </button>
      </div>
    </div>
  );
}

// ─── Service form modal ──────────────────────────────────────────

function ServiceFormModal({
  open,
  mode,
  service,
  brigadeId,
  categories,
  onClose,
  onSubmit,
  onCreateCategory,
}: {
  open: boolean;
  mode: "create" | "edit";
  service?: Service | null;
  brigadeId: string;
  categories: ServiceCategory[];
  onClose: () => void;
  onSubmit: (svc: Service) => void;
  /** Called when user taps "+ Новая группа" inside the service form.
   *  Creates a new category and returns its id so the modal can
   *  auto-select it. */
  onCreateCategory: (name: string, color: string) => string;
}) {
  const [categoryId, setCategoryId] = useState<string>("");
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(GROUP_COLORS[0]);
  const [colorManuallyPicked, setColorManuallyPicked] = useState(false);
  const [min, setMin] = useState(60);
  const [price, setPrice] = useState(0);
  // Sprint 033 Phase I20 — extras reworked into two LIST sub-cards.
  // priceTiers replaces the single bulk_threshold/bulk_price pair;
  // materialCosts replaces the single cost_per_unit number with a
  // full list of named expense items.
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([]);
  const [materialCosts, setMaterialCosts] = useState<ServiceMaterialCost[]>([]);
  const [isCountable, setIsCountable] = useState(true);
  const [showTiers, setShowTiers] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);

  const [inlineCatOpen, setInlineCatOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useMemoizedInit(open, () => {
    if (mode === "edit" && service) {
      setCategoryId(service.category_id ?? "");
      setName(service.name);
      setColor(service.color || GROUP_COLORS[0]);
      setColorManuallyPicked(true); // don't stomp existing colour
      setMin(service.duration_minutes);
      setPrice(service.price);
      setIsCountable(service.is_countable ?? true);
      // Load tiers — migration in loadServices() may have already
      // turned a legacy bulk_threshold/bulk_price pair into the
      // single-entry price_tiers array.
      const tiers = service.price_tiers ?? [];
      setPriceTiers(tiers);
      setShowTiers(tiers.length > 0);
      const costs = service.material_costs ?? [];
      setMaterialCosts(costs);
      setShowMaterials(costs.length > 0);
    } else {
      setCategoryId("");
      setName("");
      setColor(GROUP_COLORS[0]);
      setColorManuallyPicked(false);
      setMin(60);
      setPrice(0);
      setPriceTiers([]);
      setMaterialCosts([]);
      setIsCountable(true);
      setShowTiers(false);
      setShowMaterials(false);
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  });

  useEscClose(open, onClose);

  // When user picks a group and hasn't manually overridden the colour,
  // the service adopts the group's colour. This is the common case —
  // one click on «Чистка» → blue service tile.
  const pickCategory = (id: string) => {
    haptic("tap");
    setCategoryId(id);
    if (!colorManuallyPicked) {
      const cat = categories.find((c) => c.id === id);
      if (cat) setColor(cat.color);
    }
  };

  if (!open) return null;

  const hasCategories = categories.length > 0;
  const canSubmit =
    name.trim().length > 0 && min > 0 && categoryId.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    haptic("tap");
    // Clean up tiers: drop incomplete ones, sort by qty asc.
    const cleanTiers = priceTiers
      .filter((t) => t.min_qty > 1 && t.price_per_unit >= 0)
      .sort((a, b) => a.min_qty - b.min_qty);
    // Clean up materials: drop unnamed / zero items.
    const cleanMaterials = materialCosts.filter(
      (m) => m.name.trim().length > 0 && m.amount >= 0,
    );
    // cost_per_unit kept in sync as sum of material amounts — used
    // by the finances page for quick net-revenue maths.
    const sumCostPerUnit = cleanMaterials.reduce(
      (s, m) => s + Math.max(0, m.amount),
      0,
    );
    // Legacy bulk_* fields zeroed; price_tiers is canonical now.
    if (mode === "edit" && service) {
      onSubmit({
        ...service,
        name: name.trim(),
        color,
        duration_minutes: Math.max(1, min),
        price: Math.max(0, price),
        category_id: categoryId,
        price_tiers: cleanTiers.length > 0 ? cleanTiers : undefined,
        bulk_threshold: 0,
        bulk_price: 0,
        material_costs: cleanMaterials,
        cost_per_unit: sumCostPerUnit,
        is_countable: isCountable,
      });
    } else {
      onSubmit(
        createBlankService({
          name: name.trim(),
          color,
          duration_minutes: Math.max(1, min),
          price: Math.max(0, price),
          category_id: categoryId,
          price_tiers: cleanTiers.length > 0 ? cleanTiers : undefined,
          material_costs: cleanMaterials,
          cost_per_unit: sumCostPerUnit,
          is_countable: isCountable,
          brigade_ids: [brigadeId],
        }),
      );
    }
  };

  // ── Tier handlers ───────────────────────────────────────────────
  const addTier = () => {
    haptic("tap");
    // Seed a sensible next step: (last+1 qty, base price − 5 €).
    const last =
      priceTiers.length > 0 ? priceTiers[priceTiers.length - 1].min_qty : 1;
    const suggestedQty = Math.max(2, last + 1);
    setPriceTiers([
      ...priceTiers,
      { min_qty: suggestedQty, price_per_unit: Math.max(0, price - 5) },
    ]);
  };
  const updateTier = (idx: number, patch: Partial<PriceTier>) => {
    setPriceTiers(
      priceTiers.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    );
  };
  const removeTier = (idx: number) => {
    haptic("warning");
    setPriceTiers(priceTiers.filter((_, i) => i !== idx));
  };

  // ── Material-cost handlers ─────────────────────────────────────
  const addMaterial = () => {
    haptic("tap");
    setMaterialCosts([
      ...materialCosts,
      { id: generateId("mat"), name: "", amount: 0 },
    ]);
  };
  const updateMaterial = (
    id: string,
    patch: Partial<ServiceMaterialCost>,
  ) => {
    setMaterialCosts(
      materialCosts.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  };
  const removeMaterial = (id: string) => {
    haptic("warning");
    setMaterialCosts(materialCosts.filter((m) => m.id !== id));
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
            {mode === "create" ? "Новая услуга" : "Редактировать услугу"}
          </div>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* 1. GROUP — required, first. */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1">
              Группа <span className="text-[var(--system-red)]">*</span>
            </label>
            {hasCategories ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {categories.map((c) => {
                  const picked = c.id === categoryId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pickCategory(c.id)}
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
                <button
                  type="button"
                  onClick={() => setInlineCatOpen(true)}
                  className="h-8 px-3 rounded-full text-[13px] font-medium press-scale flex items-center gap-1.5 bg-[var(--accent-tint)] text-[var(--accent)]"
                >
                  <Plus size={12} strokeWidth={2.5} />
                  Новая группа
                </button>
              </div>
            ) : (
              <div className="mt-1 bg-[var(--surface-card)] rounded-[10px] px-3 py-3 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
                  <FolderPlus size={16} strokeWidth={2} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-[var(--label)] leading-snug">
                    Сначала создайте группу — без неё нельзя добавить услугу.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInlineCatOpen(true)}
                  className="shrink-0 h-9 px-3 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[13px] font-semibold press-scale"
                >
                  Создать
                </button>
              </div>
            )}
          </div>

          {/* 2. NAME */}
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
              placeholder="Напр. Чистка кондиционера"
              className="mt-1 w-full h-11 px-3 rounded-[10px] bg-[var(--surface-card)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              maxLength={80}
            />
          </div>

          {/* 3. COLOR */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1">
              Цвет
            </label>
            <div className="mt-1 bg-[var(--surface-card)] rounded-[10px] p-3">
              <div className="grid grid-cols-7 gap-2">
                {GROUP_COLORS.map((c) => {
                  const picked = c === color;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        haptic("tap");
                        setColor(c);
                        setColorManuallyPicked(true);
                      }}
                      className="relative w-full aspect-square rounded-full press-scale flex items-center justify-center"
                      style={{ backgroundColor: c }}
                    >
                      {picked && (
                        <Check
                          size={16}
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

          {/* 4. DURATION + PRICE */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1">
                Длительность <span className="text-[var(--system-red)]">*</span>
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
                Цена <span className="text-[var(--system-red)]">*</span>
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

          {/* 5. PRICE TIERS — ladder, own collapsible tab */}
          <ExtraSection
            open={showTiers}
            onToggle={() => setShowTiers(!showTiers)}
            title="Оптовая цена"
            hint={
              priceTiers.length === 0
                ? "Скидки за объём. «3 шт — €45» значит при 3+ штуках каждая идёт по €45."
                : undefined
            }
          >
            {priceTiers.map((tier, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-[12px] text-[var(--label-tertiary)]">
                  от
                </span>
                <div className="flex items-center gap-1.5 bg-[var(--fill-tertiary)] rounded-[8px] px-2.5">
                  <input
                    type="number"
                    min={2}
                    step={1}
                    value={tier.min_qty}
                    onChange={(e) =>
                      updateTier(idx, {
                        min_qty: Math.max(2, Number(e.target.value) || 2),
                      })
                    }
                    className="w-10 h-9 bg-transparent text-[14px] text-[var(--label)] text-right focus:outline-none tabular-nums"
                  />
                  <span className="text-[12px] text-[var(--label-secondary)]">
                    шт.
                  </span>
                </div>
                <span className="text-[12px] text-[var(--label-tertiary)]">
                  по
                </span>
                <div className="flex items-center gap-1.5 bg-[var(--fill-tertiary)] rounded-[8px] pl-2.5 flex-1 min-w-0">
                  <span className="text-[12px] text-[var(--label-secondary)]">
                    €
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={tier.price_per_unit}
                    onChange={(e) =>
                      updateTier(idx, {
                        price_per_unit: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="flex-1 min-w-0 h-9 pr-2.5 bg-transparent text-[14px] text-[var(--label)] text-right focus:outline-none tabular-nums"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeTier(idx)}
                  aria-label="Удалить ступень"
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-[var(--label-tertiary)] active:bg-[var(--fill-quaternary)] press-scale"
                >
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addTier}
              className="w-full h-9 flex items-center justify-center gap-1.5 rounded-[8px] bg-[var(--accent-tint)] text-[var(--accent)] text-[13px] font-medium press-scale"
            >
              <Plus size={14} strokeWidth={2.5} />
              Добавить ступень
            </button>
          </ExtraSection>

          {/* 6. MATERIAL COSTS — list of named items, own tab */}
          <ExtraSection
            open={showMaterials}
            onToggle={() => setShowMaterials(!showMaterials)}
            title="Расход материалов"
            hint={
              materialCosts.length === 0
                ? "Что уходит на одну штуку услуги — химия, фреон, расходники. Сумма вычитается из выручки в финансах."
                : undefined
            }
          >
            {materialCosts.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={m.name}
                  onChange={(e) =>
                    updateMaterial(m.id, { name: e.target.value })
                  }
                  placeholder="Напр. Фреон R410"
                  className="flex-1 min-w-0 h-9 px-3 rounded-[8px] bg-[var(--fill-tertiary)] text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  maxLength={40}
                />
                <div className="flex items-center gap-1.5 bg-[var(--fill-tertiary)] rounded-[8px] pl-2.5 w-[90px] shrink-0">
                  <span className="text-[12px] text-[var(--label-secondary)]">
                    €
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={m.amount}
                    onChange={(e) =>
                      updateMaterial(m.id, {
                        amount: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="flex-1 min-w-0 h-9 pr-2.5 bg-transparent text-[14px] text-[var(--label)] text-right focus:outline-none tabular-nums"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeMaterial(m.id)}
                  aria-label="Удалить расход"
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-[var(--label-tertiary)] active:bg-[var(--fill-quaternary)] press-scale"
                >
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addMaterial}
              className="w-full h-9 flex items-center justify-center gap-1.5 rounded-[8px] bg-[var(--accent-tint)] text-[var(--accent)] text-[13px] font-medium press-scale"
            >
              <Plus size={14} strokeWidth={2.5} />
              Добавить расход
            </button>
          </ExtraSection>

          {/* 7. IS-COUNTABLE — inline row */}
          <div className="bg-[var(--surface-card)] rounded-[10px] px-4 py-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[14px] text-[var(--label)]">
                Можно делать несколько
              </div>
              <div className="text-[11px] text-[var(--label-tertiary)] leading-snug">
                «× 3» в одной записи. Для диагностики / ремонта обычно выключено.
              </div>
            </div>
            <IOSSwitch
              checked={isCountable}
              onChange={setIsCountable}
              ariaLabel="Можно делать несколько"
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

      {/* Nested "Новая группа" modal — opened from the group row.
          Uses z-[70] so it stacks above this modal. */}
      <CategoryFormModal
        open={inlineCatOpen}
        onClose={() => setInlineCatOpen(false)}
        onSubmit={(n, c) => {
          const id = onCreateCategory(n, c);
          setInlineCatOpen(false);
          // Auto-select the brand-new category.
          setCategoryId(id);
          if (!colorManuallyPicked) setColor(c);
        }}
      />
    </div>
  );
}

// ─── Category form modal (create group) ──────────────────────────
// Phase I20 — use the unified PRESET_COLOR_VALUES palette everywhere
// a colour is picked, so brigade / Метка / group / service all share
// the same 13-colour palette. Local GROUP_COLORS retired.
const GROUP_COLORS = PRESET_COLOR_VALUES;

function CategoryFormModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, color: string) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(GROUP_COLORS[0]);
  const inputRef = useRef<HTMLInputElement>(null);

  useMemoizedInit(open, () => {
    setName("");
    setColor(GROUP_COLORS[0]);
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  });

  useEscClose(open, onClose);

  if (!open) return null;

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0;

  return (
    <div
      // z-[70] so it stacks above ServiceFormModal (z-[60]) when
      // opened inline via "+ Новая группа".
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[360px] bg-[var(--surface-grouped)] rounded-[16px] overflow-hidden shadow-[var(--shadow-sheet)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 bg-[var(--surface-card)] border-b border-[var(--separator)] text-center">
          <div className="text-[17px] font-semibold text-[var(--label)] tracking-tight">
            Новая группа
          </div>
          <div className="mt-1 text-[12px] text-[var(--label-tertiary)] leading-snug">
            Например «Чистка», «Ремонт», «Монтаж».
          </div>
        </div>

        <div className="p-4 space-y-4">
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
                if (e.key === "Enter" && canSubmit) onSubmit(trimmed, color);
              }}
              placeholder="Чистка"
              className="mt-1 w-full h-11 px-3 rounded-[10px] bg-[var(--surface-card)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              maxLength={40}
            />
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1 mb-1.5">
              Цвет
            </div>
            <div className="bg-[var(--surface-card)] rounded-[10px] p-3">
              <div className="grid grid-cols-7 gap-2">
                {GROUP_COLORS.map((c) => {
                  const picked = c === color;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        haptic("tap");
                        setColor(c);
                      }}
                      className="relative w-full aspect-square rounded-full press-scale flex items-center justify-center"
                      style={{ backgroundColor: c }}
                    >
                      {picked && (
                        <Check
                          size={16}
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
        </div>

        <div className="px-4 pb-4 pt-1 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] font-medium text-[var(--label)] press-scale"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => canSubmit && onSubmit(trimmed, color)}
            disabled={!canSubmit}
            className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[15px] font-semibold text-[var(--label-on-accent)] press-scale disabled:opacity-40 disabled:pointer-events-none"
          >
            Создать
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Collapsible sub-card with title + children ──────────────────
function ExtraSection({
  open,
  onToggle,
  title,
  hint,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-1 py-1 text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] press-scale"
      >
        <ChevronDown
          size={14}
          strokeWidth={2.5}
          className={`transition-transform ${
            open ? "rotate-0" : "-rotate-90"
          }`}
        />
        {title}
      </button>
      {open && (
        <div className="mt-1 bg-[var(--surface-card)] rounded-[10px] p-3 space-y-2">
          {children}
          {hint && (
            <div className="text-[11px] text-[var(--label-tertiary)] leading-snug pt-1">
              {hint}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tiny hook helpers ────────────────────────────────────────────

function useMemoizedInit(active: boolean, init: () => void | (() => void)) {
  useEffect(() => {
    if (!active) return;
    return init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

function useEscClose(open: boolean, onClose: () => void) {
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
}
