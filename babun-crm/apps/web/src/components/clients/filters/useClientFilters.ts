"use client";

// v809 — clients filter panel: single hook that owns the filtered list,
// contextual per-value facet counts, and the active-token list.
//
// Mirrors the legacy inline `filtered` useMemo from page.tsx EXACTLY:
//   * same predicate order (search → tags AND-membership → segment),
//   * same pinned-first comparator,
//   * same 4 sort keys (recent / name / revenue / equipment).
// The new facet/period predicates slot in alongside the legacy ones;
// when no team/city/tag/period is selected the result is identical to
// the old behaviour.

import { useMemo } from "react";
import type { Client, ClientTag } from "@babun/shared/local/clients";
import type { Appointment } from "@babun/shared/local/appointments";
import type { Team } from "@babun/shared/local/masters";
import {
  type ClientStats,
  isLongSilence,
  isLoyalClient,
  isNewClient,
} from "@babun/shared/local/selectors/client-stats";
import { matchesClient } from "@babun/shared/local/selectors/client-search";
import { getAvatarColor } from "@babun/shared/common/utils/avatar-color";
import type { FacetOption, ActiveToken, PeriodValue } from "./types";

export type SortKey = "recent" | "name" | "revenue" | "equipment";

export type Segment =
  | "all"
  | "debt"
  | "birthday"
  | "blacklist"
  | "silent"
  | "new"
  | "loyal";

/** Canonical ordered status segments + RU labels. Single source of
 *  truth for the panel's «Статус» pills AND the bar's segment token. */
export const SEGMENT_OPTIONS: { key: Exclude<Segment, "all">; label: string }[] =
  [
    { key: "debt", label: "Должники" },
    { key: "birthday", label: "Дни рождения" },
    { key: "blacklist", label: "Чёрный список" },
    { key: "silent", label: "Давно не были" },
    { key: "new", label: "Новые" },
    { key: "loyal", label: "Постоянные" },
  ];

export interface ClientFilterState {
  search: string;
  sort: SortKey;
  segment: Segment;
  selectedTeams: string[];
  selectedCities: string[];
  activeTags: string[];
  period: PeriodValue | null;
  /** Whether the «Фильтры» panel is open — facet counts are only the
   *  panel's concern, so we skip recomputing them while it's closed. */
  panelOpen: boolean;
}

export interface ClientFilterResult {
  /** Final, sorted list — drop-in replacement for the legacy `filtered`. */
  filtered: Client[];
  /** Contextual counts per facet value. facetCounts[facet][value] = N. */
  facetCounts: {
    team: Record<string, number>;
    city: Record<string, number>;
    tag: Record<string, number>;
  };
  /** Removable tokens for the summary bar (teams, cities, tags, period). */
  activeTokens: ActiveToken[];
  /** Number of active FILTER values (not sort). Drives the bar badge. */
  activeCount: number;
  /** Option lists for each facet section (hidden when empty). */
  teamOptions: FacetOption[];
  cityOptions: FacetOption[];
  tagOptions: FacetOption[];
}

// Equipment count — aggregate across locations + legacy client.equipment.
// Mirrors page.tsx `acCount`.
function acCount(c: Client): number {
  return (
    (c.locations ?? []).reduce(
      (sum, loc) => sum + (loc.equipment ?? []).length,
      0,
    ) + c.equipment.length
  );
}

/** Loose name normalisation — mirrors buildStatsMap's seed fallback. */
function normName(s: string): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Stable empty result returned by facetCounts while the panel is shut
 *  (referential stability keeps it out of downstream memo deps). */
const EMPTY_FACET_COUNTS: ClientFilterResult["facetCounts"] = {
  team: {},
  city: {},
  tag: {},
};

interface ApptIndex {
  /** clientId → set of team_id used across that client's appointments. */
  clientTeams: Map<string, Set<string>>;
  /** clientId → list of YYYY-MM-DD appointment dates. */
  clientApptDates: Map<string, string[]>;
}

/**
 * Walk appointments ONCE building two indices keyed by client id.
 * Mirrors buildStatsMap's indexing, including the comment-name
 * fallback for seed appointments with client_id:null.
 */
function buildApptIndex(clients: Client[], appointments: Appointment[]): ApptIndex {
  const byId = new Map<string, Appointment[]>();
  const orphanByName = new Map<string, Appointment[]>();
  for (const a of appointments) {
    if (a.client_id) {
      const arr = byId.get(a.client_id);
      if (arr) arr.push(a);
      else byId.set(a.client_id, [a]);
    } else {
      const key = normName(a.comment);
      if (key) {
        const arr = orphanByName.get(key);
        if (arr) arr.push(a);
        else orphanByName.set(key, [a]);
      }
    }
  }

  const clientTeams = new Map<string, Set<string>>();
  const clientApptDates = new Map<string, string[]>();
  for (const c of clients) {
    const own = byId.get(c.id) ?? [];
    let combined: Appointment[];
    if (orphanByName.size > 0) {
      const cname = normName(c.full_name);
      const orphans: Appointment[] = [];
      for (const [name, arr] of orphanByName) {
        if (cname && name.includes(cname)) orphans.push(...arr);
      }
      combined = orphans.length === 0 ? own : own.concat(orphans);
    } else {
      combined = own;
    }
    const teamSet = new Set<string>();
    const dates: string[] = [];
    for (const a of combined) {
      if (a.team_id) teamSet.add(a.team_id);
      if (a.date) dates.push(a.date);
    }
    clientTeams.set(c.id, teamSet);
    clientApptDates.set(c.id, dates);
  }
  return { clientTeams, clientApptDates };
}

export function useClientFilters(
  clients: Client[],
  appointments: Appointment[],
  teams: Team[],
  tags: ClientTag[],
  statsMap: Map<string, ClientStats>,
  state: ClientFilterState,
): ClientFilterResult {
  const {
    search,
    sort,
    segment,
    selectedTeams,
    selectedCities,
    activeTags,
    period,
    panelOpen,
  } = state;

  const index = useMemo(
    () => buildApptIndex(clients, appointments),
    [clients, appointments],
  );

  // ── Facet option lists ──────────────────────────────────────────
  const teamOptions = useMemo<FacetOption[]>(() => {
    // Only teams that at least one client has actually used.
    const used = new Set<string>();
    for (const set of index.clientTeams.values()) {
      for (const t of set) used.add(t);
    }
    return teams
      .filter((t) => used.has(t.id))
      .map((t) => ({ value: t.id, label: t.name, color: t.color }));
  }, [teams, index]);

  const cityOptions = useMemo<FacetOption[]>(() => {
    const set = new Map<string, number>();
    for (const c of clients) {
      const city = (c.city ?? "").trim();
      if (city) set.set(city, (set.get(city) ?? 0) + 1);
    }
    return Array.from(set.keys())
      .sort((a, b) => a.localeCompare(b, "ru"))
      .map((city) => ({ value: city, label: city, color: getAvatarColor(city) }));
  }, [clients]);

  const tagOptions = useMemo<FacetOption[]>(() => {
    const used = new Set<string>();
    for (const c of clients) {
      for (const tid of c.tag_ids) used.add(tid);
    }
    return tags
      .filter((t) => used.has(t.id))
      .map((t) => ({ value: t.id, label: t.name, color: t.color }));
  }, [tags, clients]);

  // ── Predicate helpers (closures over current state) ─────────────
  const passesSearch = useMemo(() => {
    const q = search.trim();
    return (c: Client) => (q ? matchesClient(c, search) : true);
  }, [search]);

  const passesSegment = useMemo(() => {
    return (c: Client): boolean => {
      if (segment === "all") return true;
      const s = statsMap.get(c.id);
      if (segment === "debt") return (s?.debt ?? 0) > 0 || c.balance < 0;
      if (segment === "birthday") {
        const dd = s?.birthdayInDays ?? null;
        return dd !== null && dd <= 14;
      }
      if (segment === "blacklist") return c.blacklisted;
      if (segment === "silent") return s ? isLongSilence(s) : false;
      if (segment === "new") return s ? isNewClient(s) : false;
      if (segment === "loyal") return s ? isLoyalClient(s) : false;
      return true;
    };
  }, [segment, statsMap]);

  const passesPeriod = useMemo(() => {
    return (c: Client): boolean => {
      if (!period) return true;
      const dates = index.clientApptDates.get(c.id) ?? [];
      // ANY appointment date within [from, to] inclusive.
      return dates.some((d) => d >= period.from && d <= period.to);
    };
  }, [period, index]);

  const passesTeam = useMemo(() => {
    const sel = selectedTeams;
    return (c: Client): boolean => {
      if (sel.length === 0) return true;
      const set = index.clientTeams.get(c.id);
      if (!set || set.size === 0) return false;
      return sel.some((id) => set.has(id));
    };
  }, [selectedTeams, index]);

  const passesCity = useMemo(() => {
    const sel = selectedCities;
    return (c: Client): boolean => {
      if (sel.length === 0) return true;
      return sel.includes((c.city ?? "").trim());
    };
  }, [selectedCities]);

  const passesTag = useMemo(() => {
    const sel = activeTags;
    // AND-membership — every selected tag must be present.
    return (c: Client): boolean =>
      sel.length === 0 || sel.every((t) => c.tag_ids.includes(t));
  }, [activeTags]);

  // ── Final filtered + sorted list ─────────────────────────────────
  // Predicate order matches legacy page.tsx: search → tags → segment,
  // with the new facet/period predicates folded in. Comparator is the
  // pinned-first / 4-sort-key block, verbatim.
  const filtered = useMemo(() => {
    let list = clients.filter(
      (c) =>
        passesSearch(c) &&
        passesTag(c) &&
        passesSegment(c) &&
        passesTeam(c) &&
        passesCity(c) &&
        passesPeriod(c),
    );

    list = [...list].sort((a, b) => {
      const aPinned = a.pinned_at ? 1 : 0;
      const bPinned = b.pinned_at ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      if (aPinned && bPinned) {
        return (b.pinned_at ?? "").localeCompare(a.pinned_at ?? "");
      }
      if (sort === "name") return a.full_name.localeCompare(b.full_name, "ru");
      if (sort === "revenue") {
        return (
          (statsMap.get(b.id)?.totalSpent ?? 0) -
          (statsMap.get(a.id)?.totalSpent ?? 0)
        );
      }
      if (sort === "equipment") return acCount(b) - acCount(a);
      const aDate = statsMap.get(a.id)?.lastVisitDate || a.created_at;
      const bDate = statsMap.get(b.id)?.lastVisitDate || b.created_at;
      return bDate.localeCompare(aDate);
    });

    return list;
  }, [
    clients,
    sort,
    statsMap,
    passesSearch,
    passesTag,
    passesSegment,
    passesTeam,
    passesCity,
    passesPeriod,
  ]);

  // ── Contextual per-value facet counts ────────────────────────────
  // Each facet value's count = clients passing search + segment +
  // period + ALL OTHER active facets, EXCLUDING the facet being
  // counted. Drives the dimmed «0 unselected» state in the panel.
  const facetCounts = useMemo(() => {
    // Only the panel consumes these counts. While it's closed, skip the
    // O(clients × facetValues) sweep entirely — otherwise every keystroke
    // in the search box (passesSearch is a fresh closure per char) burns
    // ~4×O(clients) of throwaway work behind a shut panel.
    if (!panelOpen) return EMPTY_FACET_COUNTS;
    // Base set: everything except the three facets (each facet excludes
    // itself from its own counting context).
    const base = clients.filter(
      (c) => passesSearch(c) && passesSegment(c) && passesPeriod(c),
    );

    const countTeam: Record<string, number> = {};
    {
      // Exclude team facet; keep city + tag.
      const pool = base.filter((c) => passesCity(c) && passesTag(c));
      for (const opt of teamOptions) {
        let n = 0;
        for (const c of pool) {
          const set = index.clientTeams.get(c.id);
          if (set && set.has(opt.value)) n += 1;
        }
        countTeam[opt.value] = n;
      }
    }

    const countCity: Record<string, number> = {};
    {
      // Exclude city facet; keep team + tag.
      const pool = base.filter((c) => passesTeam(c) && passesTag(c));
      for (const opt of cityOptions) {
        let n = 0;
        for (const c of pool) {
          if ((c.city ?? "").trim() === opt.value) n += 1;
        }
        countCity[opt.value] = n;
      }
    }

    const countTag: Record<string, number> = {};
    {
      // Exclude tag facet; keep team + city.
      const pool = base.filter((c) => passesTeam(c) && passesCity(c));
      for (const opt of tagOptions) {
        let n = 0;
        for (const c of pool) {
          if (c.tag_ids.includes(opt.value)) n += 1;
        }
        countTag[opt.value] = n;
      }
    }

    return { team: countTeam, city: countCity, tag: countTag };
  }, [
    panelOpen,
    clients,
    passesSearch,
    passesSegment,
    passesPeriod,
    passesTeam,
    passesCity,
    passesTag,
    teamOptions,
    cityOptions,
    tagOptions,
    index,
  ]);

  // ── Active tokens (for the summary bar) ──────────────────────────
  const activeTokens = useMemo<ActiveToken[]>(() => {
    const tokens: ActiveToken[] = [];
    // Status segment first — it's the most prominent filter and the
    // legacy chip row always showed it inline (one-tap clear).
    if (segment !== "all") {
      const seg = SEGMENT_OPTIONS.find((o) => o.key === segment);
      if (seg) {
        tokens.push({ key: "segment", val: segment, label: seg.label, color: "" });
      }
    }
    const teamLabel = new Map(teamOptions.map((o) => [o.value, o]));
    for (const id of selectedTeams) {
      const o = teamLabel.get(id);
      if (o) tokens.push({ key: "team", val: id, label: o.label, color: o.color });
    }
    for (const city of selectedCities) {
      tokens.push({
        key: "city",
        val: city,
        label: city,
        color: getAvatarColor(city),
      });
    }
    const tagLabel = new Map(tagOptions.map((o) => [o.value, o]));
    for (const id of activeTags) {
      const o = tagLabel.get(id);
      if (o) tokens.push({ key: "tag", val: id, label: o.label, color: o.color });
    }
    if (period) {
      tokens.push({
        key: "period",
        val: period.preset,
        label: periodLabel(period),
        color: "",
      });
    }
    return tokens;
  }, [
    segment,
    selectedTeams,
    selectedCities,
    activeTags,
    period,
    teamOptions,
    tagOptions,
  ]);

  const activeCount =
    selectedTeams.length +
    selectedCities.length +
    activeTags.length +
    (period ? 1 : 0) +
    (segment !== "all" ? 1 : 0);

  return {
    filtered,
    facetCounts,
    activeTokens,
    activeCount,
    teamOptions,
    cityOptions,
    tagOptions,
  };
}

const M_GEN = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

const PRESET_LABELS: Record<string, string> = {
  today: "Сегодня",
  "7d": "7 дней",
  "30d": "30 дней",
  "90d": "90 дней",
  month: "Этот месяц",
  prevMonth: "Прошлый месяц",
  year: "Этот год",
};

/** Short token label for a period value. */
export function periodLabel(period: PeriodValue): string {
  if (period.preset === "custom") {
    return `${fmtShort(period.from)}–${fmtShort(period.to)}`;
  }
  return PRESET_LABELS[period.preset] ?? "Период";
}

function fmtShort(key: string): string {
  const [, mo, d] = key.split("-").map(Number);
  if (!mo || !d) return key;
  return `${d} ${M_GEN[mo - 1]}`;
}
