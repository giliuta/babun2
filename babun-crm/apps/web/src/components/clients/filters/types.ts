// v809 — clients filter panel: shared types for the one-bar +
// one-centered-panel filter system. Pure type module, no runtime.

/** Multi-select facet keys (team / city / tag). The single-select
 *  controls (sort, status segment, period) are modelled separately
 *  because they don't share the «array of values» shape. */
export type FacetKey = "team" | "city" | "tag";

/** Period presets are a closed set; "custom" carries an explicit
 *  from/to range stored on PeriodValue. */
export type PeriodPreset =
  | "today"
  | "7d"
  | "30d"
  | "90d"
  | "month"
  | "prevMonth"
  | "year"
  | "custom";

/** Active period. `null` everywhere means «Всё время» (no filter).
 *  from/to are inclusive YYYY-MM-DD keys. */
export interface PeriodValue {
  preset: PeriodPreset;
  /** Inclusive lower bound, YYYY-MM-DD. */
  from: string;
  /** Inclusive upper bound, YYYY-MM-DD. */
  to: string;
}

/** A selectable value inside a facet section (team/city/tag). */
export interface FacetOption {
  value: string;
  label: string;
  /** Hex / rgba colour for the leading dot. */
  color: string;
}

/** One removable token rendered in the summary bar. */
export interface ActiveToken {
  /** Which control owns this token — facet key, "period", or the
   *  status "segment" (so an active «Статус» is visible + removable). */
  key: FacetKey | "period" | "segment";
  /** The underlying value (facet value id, period preset, or segment). */
  val: string;
  /** Human label shown inside the token. */
  label: string;
  /** Dot colour; empty string → no dot (period token). */
  color: string;
}
