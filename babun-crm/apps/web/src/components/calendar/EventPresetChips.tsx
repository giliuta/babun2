"use client";

// STORY-058 Sprint A — quick-apply chips for the «Новое событие» form.
//
// Renders a horizontal-scroll row of user-customisable shortcuts above
// the title block. Tapping a chip fills the form with the preset's
// label + color + duration + all-day. Source-agnostic: the parent
// passes the `types` array, so the same chip row backs both the
// personal calendar (usePersonalEventTypes) and the team calendar
// (useTeamEventTypes — list per brigade).

import {
  Coffee,
  Briefcase,
  Navigation as NavigationIcon,
  Moon,
  Plane,
  Bell,
  Heart,
  Star,
  Dumbbell,
  Book,
  Music,
  GraduationCap,
  Stethoscope,
  Car,
  Home,
  Users,
  Phone,
  ShoppingBag,
  Gift,
  Calendar as CalendarIcon,
  Tag,
} from "@babun/shared/icons";
import type {
  PersonalEventType,
  PersonalEventTypeIcon,
} from "@babun/shared/local/personal-event-types";

// Same registry as event-types/page.tsx. Kept in sync manually; both
// files import from a shared union (PersonalEventTypeIcon) so adding
// a new option requires updating only the union + this map (and the
// settings picker).
const ICON_MAP: Record<
  PersonalEventTypeIcon,
  React.ComponentType<{ size?: number; strokeWidth?: number }>
> = {
  coffee: Coffee,
  briefcase: Briefcase,
  navigation: NavigationIcon,
  moon: Moon,
  plane: Plane,
  bell: Bell,
  heart: Heart,
  star: Star,
  dumbbell: Dumbbell,
  book: Book,
  music: Music,
  "graduation-cap": GraduationCap,
  stethoscope: Stethoscope,
  car: Car,
  home: Home,
  users: Users,
  phone: Phone,
  "shopping-bag": ShoppingBag,
  gift: Gift,
  calendar: CalendarIcon,
  tag: Tag,
};

// Translucent tint — same approach as PersonalEventSheet's tintCardBg.
function tintBg(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "rgba(0,0,0,0.04)";
  const v = m[1];
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.14)`;
}

interface EventPresetChipsProps {
  types: PersonalEventType[];
  onPick: (preset: PersonalEventType) => void;
}

export default function EventPresetChips({ types, onPick }: EventPresetChipsProps) {
  if (types.length === 0) return null;

  return (
    <div
      // v481 — chips polish. Slightly tighter padding, hairline border
      // matching the chip tone for definition on white cards, and a
      // marker emoji-free flow. Negative-margin trick still lets the
      // row bleed past the form's 14-px inner padding.
      className="overflow-x-auto -mx-3.5 px-3.5"
      style={{ scrollbarWidth: "none" }}
    >
      <div className="flex items-center gap-1.5 pb-0.5">
        {types.map((p) => {
          const Icon = ICON_MAP[p.icon] ?? Tag;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p)}
              className="flex items-center gap-1.5 h-7 pl-2.5 pr-3 rounded-full text-[12px] font-semibold whitespace-nowrap shrink-0 active:scale-[0.96] transition border"
              style={{
                background: tintBg(p.color),
                color: p.color,
                borderColor: borderTint(p.color),
              }}
            >
              <Icon size={13} strokeWidth={2.4} />
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Slightly stronger alpha than the bg for the hairline border, so the
// chip reads as a defined pill on a white form card.
function borderTint(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "transparent";
  const v = m[1];
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.28)`;
}
