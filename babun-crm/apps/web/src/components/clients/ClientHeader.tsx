"use client";

// STORY-034 Group 1 — Sticky header for the redesigned client card.
//
// Replaces the editable-form heading inside ClientProfileView.  Now
// the dispatcher sees, in this order without scrolling:
//   * Back arrow · «…» menu (right-anchored)
//   * Avatar + name + status badges (VIP / blacklist / cake / next-apt)
//   * Primary location row: type · address · «Открыть в Картах»
//   * Next-appointment badge (📅 27 апр 14:00) when stats.nextApt set
//   * Object switcher chips when client.locations.length > 1
//
// Editable fields move into the per-block `ContactsBlock` /
// `PersonalBlock` (Group 3) — header is read-only on purpose.

import {
  ChevronLeft,
  MoreHorizontal,
  MapPin,
  ArrowUpRight,
  Calendar as CalendarIcon,
} from "@babun/shared/icons";
import { useRouter } from "next/navigation";
import type { Client, Location } from "@babun/shared/local/clients";
import type { ClientStats } from "@babun/shared/local/selectors/client-stats";
import { buildMapUrl } from "@babun/shared/common/utils/map-links";
import { getAvatarColor, getInitials } from "@babun/shared/common/utils/avatar-color";
import ClientStatusBadges from "./ClientStatusBadges";
import { haptic } from "@/lib/haptics";

interface ClientHeaderProps {
  client: Client;
  stats: ClientStats | undefined;
  /** Currently shown location id; controlled by parent. */
  activeLocationId: string | null;
  onChangeLocation: (id: string) => void;
  onOpenMenu: () => void;
  onBack: () => void;
}

// Detects iOS so the «Открыть в Картах» button picks Apple Maps
// over Google.  iPadOS reports as MacIntel + touch, so we OR that
// in.  buildMapUrl returns an https://maps.apple.com URL on iOS,
// not a maps:// scheme — the latter doesn't always launch in
// Safari without a user gesture.
function preferAppleMaps(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export default function ClientHeader({
  client,
  stats,
  activeLocationId,
  onChangeLocation,
  onOpenMenu,
  onBack,
}: ClientHeaderProps) {
  const router = useRouter();
  const color = getAvatarColor(client.full_name);

  const usableLocations = (client.locations ?? []).filter(
    (l) => l.address || l.mapUrl,
  );
  const activeLocation: Location | null =
    usableLocations.find((l) => l.id === activeLocationId) ??
    usableLocations.find((l) => l.isPrimary) ??
    usableLocations[0] ??
    null;

  const openMaps = (loc: Location) => {
    haptic("light");
    const service = preferAppleMaps() ? "apple" : "google";
    const url = buildMapUrl(service, loc.mapUrl || loc.address);
    if (url) window.open(url, "_blank", "noopener");
  };

  const openNextAptInCalendar = () => {
    if (!stats?.nextApt) return;
    haptic("tap");
    router.push(
      `/dashboard?date=${encodeURIComponent(stats.nextApt.date)}`,
    );
  };

  return (
    <div className="sticky top-0 z-20 bg-[var(--surface-card)] border-b border-[var(--separator)]">
      {/* Nav row */}
      <div className="flex items-center gap-2 px-3 h-12">
        <button
          type="button"
          onClick={() => {
            haptic("light");
            onBack();
          }}
          aria-label="Назад"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
        >
          <ChevronLeft size={18} strokeWidth={2.5} />
        </button>
        <div className="flex-1 text-[14px] font-semibold text-[var(--label)] truncate">
          Клиент
        </div>
        {/* TODO(roles): hide for crew role — destructive actions */}
        <button
          type="button"
          onClick={() => {
            haptic("light");
            onOpenMenu();
          }}
          aria-label="Меню"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
        >
          <MoreHorizontal size={18} strokeWidth={2} />
        </button>
      </div>

      {/* Identity */}
      <div className="px-4 pt-1 pb-3 flex items-start gap-3">
        <span
          className="w-12 h-12 rounded-full flex items-center justify-center text-[var(--label-on-accent)] font-bold text-[15px] shrink-0"
          style={{ backgroundColor: color }}
          aria-hidden
        >
          {getInitials(client.full_name || "?")}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[20px] font-bold text-[var(--label)] truncate">
              {client.full_name || "Без имени"}
            </span>
            <ClientStatusBadges client={client} stats={stats} budget={3} />
          </div>
          {client.phone && (
            <div className="text-[13px] text-[var(--label-secondary)] tabular-nums mt-0.5 truncate">
              {client.phone}
            </div>
          )}
        </div>
      </div>

      {/* Object switcher when >1 usable location */}
      {usableLocations.length > 1 && (
        <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
          {usableLocations.map((loc) => {
            const active = loc.id === (activeLocation?.id ?? null);
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => {
                  haptic("light");
                  onChangeLocation(loc.id);
                }}
                className={`shrink-0 h-7 px-2.5 rounded-full text-[12px] font-semibold transition ${
                  active
                    ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                    : "bg-[var(--fill-tertiary)] text-[var(--label-secondary)] active:bg-[var(--fill-secondary)]"
                }`}
              >
                {loc.label || "Объект"}
                {loc.isPrimary && active && (
                  <span className="opacity-80 ml-1">·</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Primary location row */}
      {activeLocation && (
        <div className="mx-3 mb-2 rounded-[12px] bg-[var(--fill-tertiary)] px-3 py-2 flex items-start gap-2">
          <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[var(--system-red)] bg-[rgba(255,59,48,0.10)] mt-0.5">
            <MapPin size={14} strokeWidth={2.2} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold text-[var(--label)] truncate">
              {activeLocation.label || "Объект"}
            </div>
            <div className="text-[12px] text-[var(--label-secondary)] truncate">
              {activeLocation.address || "адрес не указан"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => openMaps(activeLocation)}
            disabled={!activeLocation.address && !activeLocation.mapUrl}
            aria-label="Открыть в Картах"
            className="shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-full text-[12px] font-semibold bg-[rgba(0,122,255,0.10)] text-[var(--system-blue)] active:bg-[rgba(0,122,255,0.20)] disabled:opacity-40"
          >
            <ArrowUpRight size={13} strokeWidth={2.5} />
            Карты
          </button>
        </div>
      )}

      {/* Next appointment badge */}
      {stats?.nextApt && (
        <button
          type="button"
          onClick={openNextAptInCalendar}
          className="mx-3 mb-2 w-[calc(100%-1.5rem)] inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-semibold bg-[var(--accent-tint)] text-[var(--accent)] active:bg-[var(--fill-secondary)]"
        >
          <CalendarIcon size={13} strokeWidth={2.5} />
          {formatNextAptLabel(stats.nextApt)}
        </button>
      )}
    </div>
  );
}

function formatNextAptLabel(nextApt: { date: string; time: string }): string {
  const [y, m, d] = nextApt.date.split("-").map(Number);
  if (!y || !m || !d) return `${nextApt.date} ${nextApt.time}`;
  const dt = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((dt.getTime() - today.getTime()) / 86400000);
  if (days === 0) return `📅 Сегодня · ${nextApt.time}`;
  if (days === 1) return `📅 Завтра · ${nextApt.time}`;
  return `📅 ${dt.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  })} · ${nextApt.time}`;
}
