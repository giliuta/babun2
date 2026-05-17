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

import { useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  MoreHorizontal,
  MapPin,
  ArrowUpRight,
  Calendar as CalendarIcon,
  Camera,
} from "@babun/shared/icons";
import { useRouter } from "next/navigation";
import type { Client, Location } from "@babun/shared/local/clients";
import type { ClientStats } from "@babun/shared/local/selectors/client-stats";
import type { Appointment } from "@babun/shared/local/appointments";
import { buildMapUrl } from "@babun/shared/common/utils/map-links";
import { getAvatarColor, getInitials } from "@babun/shared/common/utils/avatar-color";
import { computeClientLtv, formatGapDays } from "@/lib/clients/ltv";
import { uploadClientAvatar, AvatarUploadError } from "@/lib/clients/avatarUpload";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useTenantId } from "@/components/layout/DashboardClientLayout";
import { useToast } from "@/components/ui/Toast";
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
  /**
   * Full appointments list used to compute LTV/avg-check/frequency
   * chips. Legacy callers omit it — chips are hidden in that case.
   */
  appointments?: Appointment[];
  /** F3.5 — persist a new avatar URL after upload. Omitted = read-only avatar. */
  onAvatarChange?: (avatarUrl: string) => void;
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
  appointments,
  onAvatarChange,
}: ClientHeaderProps) {
  const router = useRouter();
  const tenantId = useTenantId();
  const toast = useToast();
  const color = getAvatarColor(client.full_name);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleAvatarClick = () => {
    if (!onAvatarChange || uploading) return;
    haptic("light");
    fileInputRef.current?.click();
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file || !onAvatarChange) return;
    setUploading(true);
    try {
      const result = await uploadClientAvatar(getSupabaseBrowser(), {
        tenantId,
        clientId: client.id,
        file,
      });
      onAvatarChange(result.publicUrl);
      toast.show({ variant: "success", message: "Фото обновлено" });
    } catch (err) {
      const msg =
        err instanceof AvatarUploadError
          ? err.message
          : "Не удалось загрузить фото";
      toast.show({ variant: "error", message: msg });
    } finally {
      setUploading(false);
    }
  };

  // F3.7 — LTV / avg-check / frequency chips. Recomputed only when
  // the client id or the appointments array reference changes so the
  // sticky header doesn't churn on every parent render.
  const ltvStats = useMemo(
    () => computeClientLtv(client.id, appointments ?? []),
    [client.id, appointments],
  );

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
        {/* clients-99 F3.5 — clickable avatar opens the file picker
            when the parent supplied onAvatarChange. Falls back to a
            non-interactive span (legacy callers, read-only). */}
        {onAvatarChange ? (
          <button
            type="button"
            onClick={handleAvatarClick}
            disabled={uploading}
            aria-label="Загрузить фото"
            className="relative w-12 h-12 rounded-full shrink-0 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] active:opacity-80"
            style={{
              backgroundColor: client.avatar_url ? "transparent" : color,
            }}
          >
            {client.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={client.avatar_url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="flex w-full h-full items-center justify-center text-[var(--label-on-accent)] font-bold text-[15px]">
                {getInitials(client.full_name || "?")}
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 flex h-4 items-center justify-center bg-black/45 text-white opacity-0 hover:opacity-100 transition-opacity">
              <Camera size={11} strokeWidth={2.4} aria-hidden />
            </span>
            {uploading && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white text-[10px]">
                …
              </span>
            )}
          </button>
        ) : (
          <span
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 overflow-hidden text-[var(--label-on-accent)] font-bold text-[15px]"
            style={{
              backgroundColor: client.avatar_url ? "transparent" : color,
            }}
            aria-hidden
          >
            {client.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={client.avatar_url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              getInitials(client.full_name || "?")
            )}
          </span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleAvatarFile}
          className="hidden"
          aria-hidden
        />
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
          {ltvStats.visits > 0 && (
            <div
              className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[var(--label-secondary)]"
              aria-label="Статистика клиента"
            >
              <span title="Полная сумма всех завершённых визитов">
                €{ltvStats.ltv.toLocaleString("ru-RU")}
              </span>
              <span aria-hidden>·</span>
              <span title="Средний чек">
                ~€{ltvStats.avgCheck.toLocaleString("ru-RU")}
              </span>
              {ltvStats.avgGapDays !== null && (
                <>
                  <span aria-hidden>·</span>
                  <span title="Средний интервал между визитами">
                    {formatGapDays(ltvStats.avgGapDays)}
                  </span>
                </>
              )}
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
            className="shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-full text-[12px] font-semibold bg-[rgba(0,122,255,0.10)] text-[var(--system-blue)] active:bg-[rgba(0,122,255,0.20)] disabled:text-[var(--label-tertiary)] disabled:cursor-not-allowed"
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
