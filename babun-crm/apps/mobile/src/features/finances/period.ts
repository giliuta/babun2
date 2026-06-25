// Local period presets for the finances screen (the shared package has no
// period helper). All ranges are inclusive YYYY-MM-DD on occurred_on.
export type PeriodPreset =
  | "today"
  | "week"
  | "month"
  | "lastMonth"
  | "year"
  | "custom";

export interface Period {
  preset: PeriodPreset;
  from: string;
  to: string;
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

export const PRESET_LABELS: Record<PeriodPreset, string> = {
  today: "Сегодня",
  week: "Неделя",
  month: "Месяц",
  lastMonth: "Прошлый месяц",
  year: "Год",
  custom: "Период",
};

export const PRESET_ORDER: PeriodPreset[] = [
  "today",
  "week",
  "month",
  "lastMonth",
  "year",
];

export function presetRange(
  preset: PeriodPreset,
  base = new Date(),
): { from: string; to: string } {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = d.getMonth();
  switch (preset) {
    case "today":
      return { from: ymd(d), to: ymd(d) };
    case "week": {
      const dow = (d.getDay() + 6) % 7; // Monday = 0
      const start = new Date(d);
      start.setDate(d.getDate() - dow);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { from: ymd(start), to: ymd(end) };
    }
    case "month":
      return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) };
    case "lastMonth":
      return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
    case "year":
      return { from: ymd(new Date(y, 0, 1)), to: ymd(new Date(y, 11, 31)) };
    default:
      return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) };
  }
}

export function makePeriod(preset: PeriodPreset, base?: Date): Period {
  return { preset, ...presetRange(preset, base) };
}

export function defaultPeriod(): Period {
  return makePeriod("month");
}

export function periodLabel(p: Period): string {
  if (p.preset !== "custom") return PRESET_LABELS[p.preset];
  return `${p.from} — ${p.to}`;
}
