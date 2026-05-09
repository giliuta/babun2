"use client";

// STORY-056 — Event-mode body of the unified EventSheet.
// Extracted to keep EventSheet itself under the 400-line budget.
// Compact-mode UI: hero title, color dots, time row, all-day toggle,
// preset chips, expand toggle, and the expanded fields (notes, place,
// link, push + repeat row).

import { useEffect, useRef } from "react";
import {
  Bell,
  Repeat as RepeatIcon,
  Link as LinkIcon,
  Navigation as NavigationIcon,
} from "@babun/shared/icons";
import type { PersonalEventRepeat } from "@babun/shared/local/appointments";

import EventColorPicker from "./EventColorPicker";
import EventPresetChips from "./EventPresetChips";
import { formatPushOffsetLabel } from "./EventPushPicker";
import { formatRepeatLabel } from "./EventRepeatPicker";
import type { EventPreset } from "@/lib/eventPresets";

// Inlined from the legacy PersonalEventBlocks helper. iOS PWAs open
// `maps://?q=…` in the system Maps app without the Safari prompt;
// elsewhere fall back to Google Maps.
function buildMapsUrl(address: string): string | null {
  const a = address.trim();
  if (!a) return null;
  const isIOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);
  const q = encodeURIComponent(a);
  return isIOS
    ? `maps://?q=${q}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export interface EventBodyProps {
  title: string;
  setTitle: (s: string) => void;
  color: string;
  setColor: (s: string) => void;
  dateKey: string;
  timeStart: string;
  timeEnd: string;
  allDay: boolean;
  setAllDay: (b: boolean) => void;
  notes: string;
  setNotes: (s: string) => void;
  address: string;
  setAddress: (s: string) => void;
  url: string;
  setUrl: (s: string) => void;
  pushOffsetMin: number | null;
  repeat: PersonalEventRepeat;
  expanded: boolean;
  setExpanded: (b: boolean) => void;
  presets: EventPreset[];
  onPreset: (p: EventPreset) => void;
  onOpenTimePicker: () => void;
  onOpenPushPicker: () => void;
  onOpenRepeatPicker: () => void;
  autoFocusTitle: boolean;
}

export default function EventSheetEventBody(props: EventBodyProps) {
  const notesRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [props.notes, props.expanded]);

  const mapsHref = buildMapsUrl(props.address);

  return (
    <div className="pb-3">
      {/* Hero title — borderless, caret coloured by event color */}
      <div className="px-4 pt-4 pb-1">
        <input
          autoFocus={props.autoFocusTitle}
          type="text"
          value={props.title}
          onChange={(e) => props.setTitle(e.target.value)}
          placeholder="Название события"
          className="w-full text-[24px] font-bold text-[var(--label)] placeholder:text-[var(--label-tertiary)] tracking-tight bg-transparent border-0 focus:outline-none"
          style={{ caretColor: props.color }}
        />
      </div>

      <EventColorPicker value={props.color} onChange={props.setColor} />

      <button
        type="button"
        onClick={props.onOpenTimePicker}
        className="w-full flex items-center justify-between px-4 py-3 active:bg-[var(--fill-quaternary)] transition border-t border-[var(--separator)]"
      >
        <div className="text-[15px] text-[var(--label)]">
          {formatDateTime(props.dateKey, props.timeStart, props.timeEnd, props.allDay)}
        </div>
        <span className="text-[var(--label-tertiary)] text-[13px]">›</span>
      </button>

      <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--separator)]">
        <div className="text-[15px] text-[var(--label)]">Весь день</div>
        <ToggleSlim checked={props.allDay} onChange={props.setAllDay} ariaLabel="Весь день" />
      </div>

      <div className="border-t border-[var(--separator)]">
        <EventPresetChips
          presets={props.presets}
          activeColor={props.color}
          onPick={props.onPreset}
        />
      </div>

      <button
        type="button"
        onClick={() => props.setExpanded(!props.expanded)}
        className="w-full text-center py-3 text-[13px] font-semibold text-[var(--accent)] active:opacity-60 border-t border-[var(--separator)]"
      >
        {props.expanded ? "⌄ Свернуть" : "⌃ Больше деталей"}
      </button>

      {props.expanded && (
        <>
          <div className="border-t border-[var(--separator)] px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--label-secondary)] mb-1.5">
              Заметка
            </div>
            <textarea
              ref={notesRef}
              value={props.notes}
              onChange={(e) => props.setNotes(e.target.value)}
              placeholder="Дополнительная информация"
              rows={2}
              className="block w-full text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] leading-snug bg-transparent border-0 focus:outline-none resize-none overflow-hidden"
            />
          </div>

          <div className="border-t border-[var(--separator)] px-4 py-3 flex items-center gap-2">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--label-secondary)] w-[60px] shrink-0">
              Место
            </div>
            <input
              type="text"
              value={props.address}
              onChange={(e) => props.setAddress(e.target.value)}
              placeholder="Адрес"
              className="flex-1 h-9 px-2.5 rounded-[8px] bg-[var(--fill-tertiary)] border border-transparent text-[14px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
            />
            {mapsHref && (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Открыть в картах"
                className="w-9 h-9 flex items-center justify-center rounded-[8px] text-[var(--accent)] bg-[var(--accent-tint)] active:scale-[0.95] shrink-0"
              >
                <NavigationIcon size={14} strokeWidth={2} />
              </a>
            )}
          </div>

          <div className="border-t border-[var(--separator)] px-4 py-3 flex items-center gap-2">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--label-secondary)] w-[60px] shrink-0">
              Ссылка
            </div>
            <input
              type="url"
              inputMode="url"
              value={props.url}
              onChange={(e) => props.setUrl(e.target.value)}
              placeholder="https://"
              className="flex-1 h-9 px-2.5 rounded-[8px] bg-[var(--fill-tertiary)] border border-transparent text-[14px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
            />
            {props.url.trim() && /^https?:\/\//i.test(props.url.trim()) && (
              <a
                href={props.url.trim()}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Открыть ссылку"
                className="w-9 h-9 flex items-center justify-center rounded-[8px] text-[var(--accent)] bg-[var(--accent-tint)] active:scale-[0.95] shrink-0"
              >
                <LinkIcon size={14} strokeWidth={2} />
              </a>
            )}
          </div>

          <div className="border-t border-[var(--separator)] grid grid-cols-2">
            <button
              type="button"
              onClick={props.onOpenPushPicker}
              className="flex items-center gap-2 px-4 py-3 active:bg-[var(--fill-quaternary)] transition text-left"
            >
              <Bell size={16} strokeWidth={2} className="text-[var(--label-tertiary)]" />
              <span className="text-[13px] text-[var(--label)] flex-1">Push</span>
              <span className="text-[12px] font-semibold text-[var(--label-secondary)]">
                {formatPushOffsetLabel(props.pushOffsetMin)}
              </span>
            </button>
            <button
              type="button"
              onClick={props.onOpenRepeatPicker}
              className="flex items-center gap-2 px-4 py-3 active:bg-[var(--fill-quaternary)] transition text-left border-l border-[var(--separator)]"
            >
              <RepeatIcon size={16} strokeWidth={2} className="text-[var(--label-tertiary)]" />
              <span className="text-[13px] text-[var(--label)] flex-1">Повтор</span>
              <span className="text-[12px] font-semibold text-[var(--label-secondary)]">
                {compactRepeatLabel(props.repeat)}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ToggleSlim({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (b: boolean) => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-[51px] h-[31px] rounded-full transition shrink-0 ${
        checked ? "bg-[var(--system-green)]" : "bg-[var(--fill-tertiary)]"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-[27px] h-[27px] rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[20px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function compactRepeatLabel(v: PersonalEventRepeat): string {
  const full = formatRepeatLabel(v);
  // Squeeze long labels for the narrow 1/2-column row.
  if (full.startsWith("По будням")) return "Будни";
  if (full === "Каждые 2 недели") return "2 нед";
  if (full === "Каждую неделю") return "Неделя";
  if (full === "Каждый месяц") return "Месяц";
  if (full === "Каждый год") return "Год";
  if (full === "Не повторять") return "Нет";
  return full;
}

function formatDateTime(dateKey: string, timeStart: string, timeEnd: string, allDay: boolean): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  const dateLabel = Number.isFinite(dt.getTime())
    ? dt.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
    : dateKey;
  if (allDay) return `${dateLabel} · весь день`;
  const [sh, sm] = timeStart.split(":").map(Number);
  const [eh, em] = timeEnd.split(":").map(Number);
  const startTotal = sh * 60 + sm;
  const endTotal = eh * 60 + em;
  const dur = Math.max(0, endTotal - startTotal);
  return `${dateLabel} · ${timeStart} → ${timeEnd} (${dur} мин)`;
}
