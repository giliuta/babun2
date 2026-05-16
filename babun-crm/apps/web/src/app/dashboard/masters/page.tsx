"use client";

// Sprint 033 Phase I31 — /dashboard/masters list page.
//  · I30 introduced the iOS Settings redesign of the list itself.
//  · I31 rewires tap and "Редактировать" / "Новый сотрудник" to push
//    the new /dashboard/masters/[id] detail hub, so the legacy
//    7-section MasterSheet stops being the primary editor. The sheet
//    is retained only for the ?edit=<id> deep-link (used by older
//    back-references that we haven't hunted down yet).

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useIsDesktop } from "@/lib/useIsDesktop";
import {
  AlertTriangle,
  ArchiveRestore,
  Archive,
  ChevronRight,
  Copy,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCircle2,
  X,
} from "@babun/shared/icons";
import PageHeader from "@/components/layout/PageHeader";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import EmptyState from "@/components/ui/EmptyState";
import ContextMenu, {
  type ContextMenuOption,
} from "@/components/ui/ContextMenu";
import SwipeableRow from "@/components/ui/SwipeableRow";
import { haptic } from "@/lib/haptics";
import { useMasters, useTeams } from "@/components/layout/DashboardClientLayout";
import {
  ROLE_LABELS,
  generateId,
  getInitials,
  getTeamLeadIds,
  type Master,
  type Team,
} from "@babun/shared/local/masters";
import NewMasterPopup from "@/components/masters/NewMasterPopup";

function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е");
}

export default function MastersPage() {
  const router = useRouter();
  const { masters, upsertMaster, deleteMaster } = useMasters();
  const { teams, setTeams } = useTeams();
  const confirm = useConfirm();

  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [menu, setMenu] = useState<{
    master: Master;
    anchor: { x: number; y: number };
  } | null>(null);

  // Legacy deep-link ?edit=<id> → redirect to the new detail hub.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    if (!editId) return;
    router.replace(`/dashboard/masters/${editId}`);
  }, [router]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return masters;
    return masters.filter(
      (m) =>
        normalize(m.full_name).includes(q) ||
        (m.phone && normalize(m.phone).includes(q)) ||
        (m.email && normalize(m.email).includes(q)),
    );
  }, [masters, query]);

  // Active first by name; archived go to the bottom.
  const sorted = useMemo(() => {
    return filtered.slice().sort((a, b) => {
      const aAct = a.is_active ? 0 : 1;
      const bAct = b.is_active ? 0 : 1;
      if (aAct !== bAct) return aAct - bAct;
      return a.full_name.localeCompare(b.full_name, "ru");
    });
  }, [filtered]);

  const openNew = () => {
    haptic("tap");
    setNewOpen(true);
  };

  const openDetail = (master: Master) => {
    haptic("tap");
    router.push(`/dashboard/masters/${master.id}`);
  };

  const toggleArchived = (master: Master) => {
    haptic("tap");
    upsertMaster({ ...master, is_active: !master.is_active });
  };

  const duplicateMaster = (master: Master) => {
    haptic("tap");
    upsertMaster({
      ...master,
      id: generateId("master"),
      full_name: `${master.full_name} (копия)`,
      created_at: new Date().toISOString(),
      // login email is per-person; don't clone
      login_email: undefined,
      credentials_set: false,
      invite_sent_at: undefined,
      last_login_at: undefined,
    });
  };

  const handleDelete = async (master: Master) => {
    const ok = await confirm({
      title: `Удалить сотрудника «${master.full_name}»?`,
      message: "Будет удалён из всех команд где состоял. Отменить нельзя.",
      confirmLabel: "Удалить",
    });
    if (!ok) return;
    haptic("warning");
    deleteMaster(master.id);

    const updatedTeams = teams.map<Team>((t) => {
      let changed = false;
      let nextLeadId = t.lead_id;
      let nextHelperIds = t.helper_ids;
      if (t.lead_id === master.id) {
        nextLeadId = null;
        changed = true;
      }
      if (t.helper_ids.includes(master.id)) {
        nextHelperIds = t.helper_ids.filter((id) => id !== master.id);
        changed = true;
      }
      return changed
        ? { ...t, lead_id: nextLeadId, helper_ids: nextHelperIds }
        : t;
    });
    setTeams(updatedTeams);
  };

  const menuOptions: ContextMenuOption[] = menu
    ? [
        {
          label: "Открыть",
          icon: <Pencil size={18} strokeWidth={2} />,
          onSelect: () => openDetail(menu.master),
        },
        {
          label: "Дублировать",
          icon: <Copy size={18} strokeWidth={2} />,
          onSelect: () => duplicateMaster(menu.master),
        },
        {
          label: menu.master.is_active ? "В архив" : "Вернуть из архива",
          icon: menu.master.is_active ? (
            <Archive size={18} strokeWidth={2} />
          ) : (
            <ArchiveRestore size={18} strokeWidth={2} />
          ),
          onSelect: () => toggleArchived(menu.master),
        },
        {
          label: "Удалить",
          icon: <Trash2 size={18} strokeWidth={2} />,
          danger: true,
          onSelect: () => handleDelete(menu.master),
        },
      ]
    : [];

  return (
    <>
      <PageHeader title="Сотрудники" />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-2xl mx-auto px-3 py-4 pb-[calc(env(safe-area-inset-bottom)+80px)] space-y-4">
          {masters.length === 0 ? (
            <EmptyState
              variant="prominent"
              icon={<UserCircle2 size={28} strokeWidth={2} />}
              title="Пока нет сотрудников"
              description="Добавьте первого — потом сможете закрепить его за командой и настроить доступы."
              action={
                <button
                  type="button"
                  onClick={openNew}
                  className="h-11 px-5 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold press-scale"
                >
                  Новый сотрудник
                </button>
              }
            />
          ) : (
            <>
              {masters.length > 6 && (
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
                    placeholder="Поиск по имени, телефону, email"
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
              )}

              {sorted.length === 0 && query ? (
                <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-5 text-center text-[13px] text-[var(--label-tertiary)]">
                  Ничего не найдено по запросу «{query}».
                </div>
              ) : (
                <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
                  {sorted.map((m) => (
                    <SwipeableRow
                      key={m.id}
                      leftActions={[
                        {
                          label: m.is_active ? "В архив" : "Вернуть",
                          color: "bg-[var(--system-yellow)]",
                          icon: m.is_active ? (
                            <Archive size={16} strokeWidth={2} />
                          ) : (
                            <ArchiveRestore size={16} strokeWidth={2} />
                          ),
                          onSelect: () => toggleArchived(m),
                        },
                      ]}
                      rightActions={[
                        {
                          label: "Удалить",
                          color: "bg-[var(--system-red)]",
                          icon: <Trash2 size={16} strokeWidth={2} />,
                          onSelect: () => handleDelete(m),
                        },
                      ]}
                    >
                      <MasterRow
                        master={m}
                        teams={teams}
                        onTap={() => openDetail(m)}
                        onLongPress={(anchor) => setMenu({ master: m, anchor })}
                      />
                    </SwipeableRow>
                  ))}
                  <button
                    type="button"
                    onClick={openNew}
                    className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left active:bg-[var(--fill-quaternary)] transition press-scale"
                  >
                    <span className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--accent-tint)] text-[var(--accent)] shrink-0">
                      <Plus size={18} strokeWidth={2.5} />
                    </span>
                    <span className="flex-1 text-[15px] font-medium text-[var(--accent)]">
                      Новый сотрудник
                    </span>
                  </button>
                </div>
              )}

              <GestureHint />
            </>
          )}
        </div>
      </div>

      <ContextMenu
        open={!!menu}
        onClose={() => setMenu(null)}
        anchor={menu?.anchor ?? null}
        title={menu?.master.full_name}
        options={menuOptions}
      />

      <NewMasterPopup
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(master) => {
          upsertMaster(master);
          setNewOpen(false);
          router.push(`/dashboard/masters/${master.id}`);
        }}
      />
    </>
  );
}

// STORY-059 — local EmptyState removed; shared component used at the
// call site below. Local copy kept the same visual weight as the new
// shared `variant="prominent"` (16px disc, accent-tint), so this is a
// straight refactor with no UX change.

// ─── Master row ───────────────────────────────────────────────────

function MasterRow({
  master,
  teams,
  onTap,
  onLongPress,
}: {
  master: Master;
  teams: Team[];
  onTap: () => void;
  onLongPress: (anchor: { x: number; y: number }) => void;
}) {
  const handlers = useLongPressOrTap({ onTap, onLongPress });
  const archived = !master.is_active;

  // Union of primary team_id and brigades where master appears in
  // lead_ids / helper_ids. Avatar tint comes from the first match.
  const assignedTeams: Team[] = (() => {
    const seen = new Map<string, Team>();
    if (master.team_id) {
      const t = teams.find((x) => x.id === master.team_id);
      if (t) seen.set(t.id, t);
    }
    for (const t of teams) {
      const leadIds = getTeamLeadIds(t);
      if (leadIds.includes(master.id) || t.helper_ids.includes(master.id)) {
        if (!seen.has(t.id)) seen.set(t.id, t);
      }
    }
    return Array.from(seen.values());
  })();

  const tile = assignedTeams[0]?.color ?? "#8E8E93";

  // Subtitle: role (+ custom title) · brigade(s) · phone.
  const pieces: string[] = [];
  const roleBit = master.title
    ? `${ROLE_LABELS[master.role]} · ${master.title}`
    : ROLE_LABELS[master.role];
  pieces.push(roleBit);
  if (assignedTeams.length === 0) pieces.push("без команды");
  else if (assignedTeams.length === 1) pieces.push(assignedTeams[0].name);
  else pieces.push(`${assignedTeams.length} команды`);
  if (master.phone) pieces.push(master.phone);
  const subtitle = pieces.join(" · ");

  // Warning when the record is missing critical data.
  const needsSetup = !master.phone || assignedTeams.length === 0;

  return (
    <div
      {...handlers}
      className={`flex items-center gap-3 px-4 min-h-[60px] py-2 cursor-pointer select-none active:bg-[var(--fill-quaternary)] transition ${
        archived ? "opacity-60" : ""
      }`}
      style={{
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      <span
        className={`w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-[var(--label-on-accent)] font-semibold text-[13px] shrink-0 ${
          archived ? "grayscale" : ""
        }`}
        style={{ backgroundColor: master.avatar_url ? "transparent" : tile }}
      >
        {master.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={master.avatar_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          getInitials(master.full_name)
        )}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-semibold text-[var(--label)] truncate">
            {master.full_name}
          </span>
          {archived && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] bg-[var(--fill-tertiary)] text-[var(--label-secondary)] shrink-0">
              архив
            </span>
          )}
        </div>
        <div
          className={`text-[13px] truncate flex items-center gap-1 ${
            needsSetup
              ? "text-[color:var(--system-yellow-strong,#B78600)] font-medium"
              : "text-[var(--label-secondary)]"
          }`}
        >
          {needsSetup && (
            <AlertTriangle
              size={12}
              strokeWidth={2.5}
              className="shrink-0 text-[var(--system-yellow)] fill-[var(--system-yellow)]"
            />
          )}
          <span className="truncate">{subtitle}</span>
        </div>
      </div>
      <ChevronRight
        size={18}
        strokeWidth={2}
        className="text-[var(--label-quaternary)] shrink-0"
      />
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

// v519 §3.6 — desktop / mobile gesture hint split (matches the
// teams list version in /dashboard/teams). Swipe / long-press only
// mean something on touch; on lg+ we show right-click + drag-handle.
function GestureHint() {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return (
      <div className="px-4 pt-0.5 text-[12px] leading-snug text-[var(--label-tertiary)]">
        Клик — открыть. Правый клик — меню.
      </div>
    );
  }
  return (
    <div className="px-4 pt-0.5 text-[12px] leading-snug text-[var(--label-tertiary)]">
      Нажмите — открыть. Свайп вправо —{" "}
      <span className="text-[color:var(--system-yellow-strong,#B78600)] font-medium">
        в архив
      </span>
      . Свайп влево —{" "}
      <span className="text-[var(--system-red)] font-medium">удалить</span>.
      Долгое нажатие — меню.
    </div>
  );
}
