"use client";

// Sprint 033 Phase I14 — Brigade masters subroute, redesigned to match
// the per-brigade pattern used on Метки and the brigades list.
//
// Changes vs previous (2-section checkbox-dup) version:
//  · One row per master. No more duplicate "БРИГАДИРЫ / ПОМОЩНИКИ"
//    sections showing the same names twice.
//  · Instant save — no Save button. Same as iOS Settings.
//  · Gestures mirror the Метки page: tap includes as helper, swipe
//    right toggles "бригадир" (gold ★), swipe left removes from the
//    brigade, long-press opens the anchored context menu.
//  · Right-side indicator shows the role in one icon: gold ★ for
//    lead, blue ✓ for helper, empty for not in brigade.
//  · Each row has the brigade's colour as the avatar tint when the
//    master is IN the brigade, otherwise a neutral grey — so you can
//    scan the roster and see who's in at a glance.

import { use, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Star, Trash2, UserCog, UserMinus, UserPlus, Users } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useMasters, useTeams } from "@/app/dashboard/layout";
import {
  getInitials,
  getTeamLeadIds,
  type Master,
  type Team,
} from "@/lib/masters";
import BrigadeSectionShell from "@/components/teams/BrigadeSectionShell";
import ContextMenu, {
  type ContextMenuOption,
} from "@/components/ui/ContextMenu";
import SwipeableRow from "@/components/ui/SwipeableRow";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function BrigadeMastersPage({ params }: RouteParams) {
  const { id } = use(params);
  const router = useRouter();
  const { teams, upsertTeam } = useTeams();
  const { masters, setMasters } = useMasters();
  const team = teams.find((t) => t.id === id);

  const [menu, setMenu] = useState<{
    master: Master;
    anchor: { x: number; y: number };
  } | null>(null);

  const leadIds = team ? getTeamLeadIds(team) : [];
  const helperIds = team?.helper_ids ?? [];
  const leadSet = useMemo(() => new Set(leadIds), [leadIds]);
  const helperSet = useMemo(() => new Set(helperIds), [helperIds]);

  // Masters the user can pick from: not locked to another brigade
  // + any who are already in this brigade.
  const availableMasters = useMemo(() => {
    if (!team) return [];
    return masters
      .filter(
        (m) =>
          m.is_active &&
          (m.team_id === null ||
            m.team_id === team.id ||
            leadSet.has(m.id) ||
            helperSet.has(m.id)),
      )
      .sort((a, b) => {
        const aRank = leadSet.has(a.id) ? 0 : helperSet.has(a.id) ? 1 : 2;
        const bRank = leadSet.has(b.id) ? 0 : helperSet.has(b.id) ? 1 : 2;
        if (aRank !== bRank) return aRank - bRank;
        return a.full_name.localeCompare(b.full_name, "ru");
      });
  }, [masters, team, leadSet, helperSet]);

  if (!team) {
    return (
      <BrigadeSectionShell brigadeId={id} title="Мастера" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Бригада не найдена.
        </div>
      </BrigadeSectionShell>
    );
  }

  const persist = (nextLeads: string[], nextHelpers: string[]) => {
    const deduped = Array.from(new Set(nextLeads));
    const cleanedHelpers = nextHelpers.filter((hid) => !deduped.includes(hid));
    upsertTeam({
      ...team,
      lead_id: deduped[0] ?? null,
      lead_ids: deduped.length > 0 ? deduped : undefined,
      helper_ids: cleanedHelpers,
    });
    const memberIds = new Set<string>([...deduped, ...cleanedHelpers]);
    setMasters(
      masters.map<Master>((m) => {
        const wasHere = m.team_id === team.id;
        const nowHere = memberIds.has(m.id);
        if (nowHere && m.team_id !== team.id) return { ...m, team_id: team.id };
        if (wasHere && !nowHere) return { ...m, team_id: null };
        return m;
      }),
    );
  };

  const toggleHelper = (m: Master) => {
    haptic("tap");
    if (leadSet.has(m.id) || helperSet.has(m.id)) {
      // already in brigade (any role) → remove entirely
      persist(
        leadIds.filter((x) => x !== m.id),
        helperIds.filter((x) => x !== m.id),
      );
    } else {
      persist(leadIds, [...helperIds, m.id]);
    }
  };

  const toggleLead = (m: Master) => {
    haptic("tap");
    if (leadSet.has(m.id)) {
      // demote lead → helper (still in brigade)
      persist(
        leadIds.filter((x) => x !== m.id),
        [...helperIds, m.id],
      );
    } else {
      // promote (or add) to lead — remove from helpers if present
      persist(
        [...leadIds, m.id],
        helperIds.filter((x) => x !== m.id),
      );
    }
  };

  const remove = (m: Master) => {
    haptic("warning");
    persist(
      leadIds.filter((x) => x !== m.id),
      helperIds.filter((x) => x !== m.id),
    );
  };

  const menuOptions: ContextMenuOption[] = menu
    ? buildMenu(menu.master, {
        isLead: leadSet.has(menu.master.id),
        isHelper: helperSet.has(menu.master.id),
        toggleLead,
        toggleHelper,
        remove,
      })
    : [];

  return (
    <BrigadeSectionShell brigadeId={id} title="Мастера" hideSave>
      {/* 2026-04-22 — parked. User wants masters to be pulled from the
          main /dashboard/masters page instead of this separate gesture-
          based UI. This screen will be rebuilt once that page gets a
          full redesign. Keeping the current flow functional so the
          brigade is still editable in the meantime. */}
      <div className="flex items-start gap-2 px-3 py-2.5 bg-[var(--accent-tint)] rounded-[10px] text-[12px] leading-snug text-[var(--label)]">
        <span className="text-[14px] shrink-0 leading-none mt-[1px]">🚧</span>
        <span>
          Временная страница. Будет переделана после редизайна раздела Мастера — мастера станут подтягиваться оттуда, без отдельных жестов здесь.
        </span>
      </div>
      {masters.filter((m) => m.is_active).length === 0 ? (
        <EmptyState onOpenMasters={() => router.push("/dashboard/masters")} />
      ) : availableMasters.length === 0 ? (
        <AllBusyState onOpenMasters={() => router.push("/dashboard/masters")} />
      ) : (
        <>
          <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
            {availableMasters.map((m) => {
              const isLead = leadSet.has(m.id);
              const isHelper = helperSet.has(m.id);
              const isIn = isLead || isHelper;
              return (
                <SwipeableRow
                  key={m.id}
                  leftActions={[
                    {
                      label: isLead ? "Помощник" : "Бригадир",
                      color: "bg-[var(--system-yellow)]",
                      icon: (
                        <Star
                          size={16}
                          strokeWidth={2}
                          fill={isLead ? "none" : "white"}
                        />
                      ),
                      onSelect: () => toggleLead(m),
                    },
                  ]}
                  rightActions={
                    isIn
                      ? [
                          {
                            label: "Убрать",
                            color: "bg-[var(--system-red)]",
                            icon: <UserMinus size={16} strokeWidth={2} />,
                            onSelect: () => remove(m),
                          },
                        ]
                      : []
                  }
                >
                  <MasterRow
                    master={m}
                    team={team}
                    isLead={isLead}
                    isHelper={isHelper}
                    onTap={() => toggleHelper(m)}
                    onLongPress={(anchor) => setMenu({ master: m, anchor })}
                  />
                </SwipeableRow>
              );
            })}
            <button
              type="button"
              onClick={() => router.push("/dashboard/masters")}
              className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left active:bg-[var(--fill-quaternary)] transition press-scale"
            >
              <span className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--accent-tint)] text-[var(--accent)] shrink-0">
                <UserPlus size={18} strokeWidth={2.2} />
              </span>
              <span className="flex-1 text-[15px] font-medium text-[var(--accent)]">
                Добавить мастера в&nbsp;компанию
              </span>
            </button>
          </div>
          <div className="px-4 pt-0.5 text-[12px] leading-snug text-[var(--label-tertiary)]">
            Тап — добавить помощником. Свайп вправо —{" "}
            <span className="text-[color:var(--system-yellow-strong,#B78600)] font-medium">
              сделать бригадиром
            </span>
            . Свайп влево —{" "}
            <span className="text-[var(--system-red)] font-medium">убрать</span>
            .
          </div>
        </>
      )}

      <ContextMenu
        open={!!menu}
        onClose={() => setMenu(null)}
        anchor={menu?.anchor ?? null}
        title={menu?.master.full_name}
        options={menuOptions}
      />
    </BrigadeSectionShell>
  );
}

// ─── Menu builder (stateful rules per row) ────────────────────────────

function buildMenu(
  master: Master,
  ctx: {
    isLead: boolean;
    isHelper: boolean;
    toggleLead: (m: Master) => void;
    toggleHelper: (m: Master) => void;
    remove: (m: Master) => void;
  },
): ContextMenuOption[] {
  const { isLead, isHelper } = ctx;
  const opts: ContextMenuOption[] = [];
  if (!isLead) {
    opts.push({
      label: "Сделать бригадиром",
      icon: (
        <Star
          size={18}
          strokeWidth={2}
          fill="var(--system-yellow)"
          className="text-[var(--system-yellow)]"
        />
      ),
      onSelect: () => ctx.toggleLead(master),
    });
  }
  if (!isHelper && isLead) {
    opts.push({
      label: "Сделать помощником",
      icon: <UserCog size={18} strokeWidth={2} />,
      onSelect: () => ctx.toggleLead(master), // demote path
    });
  }
  if (!isHelper && !isLead) {
    opts.push({
      label: "Добавить помощником",
      icon: <UserPlus size={18} strokeWidth={2} />,
      onSelect: () => ctx.toggleHelper(master),
    });
  }
  if (isLead || isHelper) {
    opts.push({
      label: "Убрать из бригады",
      icon: <UserMinus size={18} strokeWidth={2} />,
      danger: true,
      onSelect: () => ctx.remove(master),
    });
  }
  return opts;
}

// ─── Master row ────────────────────────────────────────────────────────

function MasterRow({
  master,
  team,
  isLead,
  isHelper,
  onTap,
  onLongPress,
}: {
  master: Master;
  team: Team;
  isLead: boolean;
  isHelper: boolean;
  onTap: () => void;
  onLongPress: (anchor: { x: number; y: number }) => void;
}) {
  const handlers = useLongPressOrTap({ onTap, onLongPress });
  const inBrigade = isLead || isHelper;
  return (
    <div
      {...handlers}
      className={`flex items-center gap-3 px-4 min-h-[56px] cursor-pointer select-none active:bg-[var(--fill-quaternary)] transition ${
        isLead ? "bg-[var(--accent-tint)]" : ""
      }`}
      style={{
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      <span
        className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--label-on-accent)] font-semibold text-[13px] shrink-0"
        style={{
          backgroundColor: inBrigade ? team.color : "#C7C7CC",
          opacity: inBrigade ? 1 : 0.85,
        }}
      >
        {getInitials(master.full_name)}
      </span>
      <span
        className={`flex-1 min-w-0 text-[15px] truncate ${
          isLead
            ? "font-semibold text-[var(--accent)]"
            : isHelper
              ? "font-medium text-[var(--label)]"
              : "text-[var(--label)]"
        }`}
      >
        {master.full_name}
      </span>
      <span className="w-6 flex items-center justify-end">
        {isLead ? (
          <Star
            size={20}
            strokeWidth={0}
            fill="var(--system-yellow)"
            className="text-[var(--system-yellow)] drop-shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
          />
        ) : isHelper ? (
          <Check
            size={20}
            strokeWidth={3}
            className="text-[var(--accent)]"
          />
        ) : null}
      </span>
    </div>
  );
}

// ─── Empty states ──────────────────────────────────────────────────────

function EmptyState({ onOpenMasters }: { onOpenMasters: () => void }) {
  return (
    <div className="px-6 pt-10 pb-4 flex flex-col items-center text-center gap-3">
      <span className="w-16 h-16 rounded-full bg-[var(--accent-tint)] flex items-center justify-center text-[var(--accent)]">
        <Users size={28} strokeWidth={2} />
      </span>
      <div>
        <div className="text-[17px] font-semibold text-[var(--label)]">
          Пока нет мастеров
        </div>
        <div className="mt-1 text-[13px] leading-snug text-[var(--label-secondary)]">
          Создайте мастеров в&nbsp;общем разделе — потом сможете закрепить их за&nbsp;бригадами.
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenMasters}
        className="mt-3 h-11 px-5 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold press-scale"
      >
        Открыть мастеров
      </button>
    </div>
  );
}

function AllBusyState({ onOpenMasters }: { onOpenMasters: () => void }) {
  return (
    <div className="px-6 pt-8 pb-4 flex flex-col items-center text-center gap-3">
      <span className="w-14 h-14 rounded-full bg-[var(--fill-tertiary)] flex items-center justify-center text-[var(--label-secondary)]">
        <Users size={26} strokeWidth={2} />
      </span>
      <div>
        <div className="text-[15px] font-semibold text-[var(--label)]">
          Все мастера заняты в&nbsp;других бригадах
        </div>
        <div className="mt-1 text-[13px] leading-snug text-[var(--label-secondary)]">
          Чтобы перенести мастера сюда, откройте раздел Мастера и уберите его из&nbsp;другой бригады.
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenMasters}
        className="mt-2 h-10 px-4 rounded-full bg-[var(--fill-tertiary)] text-[var(--label)] text-[14px] font-medium press-scale"
      >
        Открыть мастеров
      </button>
    </div>
  );
}

// ─── Long-press + tap hook ────────────────────────────────────────────

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
