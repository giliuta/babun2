"use client";

// v813 — Sticky header for the unified «Карта-диспетчер» client card.
//
// The dispatcher sees, in this order without scrolling:
//   * Back arrow · «Клиент» · «…» menu
//   * Avatar + name + status badges (VIP / blacklist / cake)
//   * MONEY ROW as coloured text: €доход (green) · долг €N (gold) ·
//     ждём €N (grey) — each segment HIDES when its figure is 0.
//   * META line: 🕘 последний визит · команда · город (hide-on-empty)
//   * TRUST line: Клиент с YYYY · N визитов · средний €N
//
// The phone line, primary-location card, object switcher and
// next-appointment badge were intentionally REMOVED from the header
// (locked design): the next appointment is now the NEXT-JOB hero,
// navigation is one of the 5 quick actions, and objects/equipment live
// in the ОБЪЕКТЫ section below. Editable fields live in the per-block
// ContactsBlock / PersonalBlock — header is read-only on purpose.

import { useRef, useState } from "react";
import { ChevronLeft, MoreHorizontal, Camera } from "@babun/shared/icons";
import type { Client } from "@babun/shared/local/clients";
import type { ClientStats } from "@babun/shared/local/selectors/client-stats";
import { getAvatarColor, getInitials } from "@babun/shared/common/utils/avatar-color";
import { uploadClientAvatar, AvatarUploadError } from "@/lib/clients/avatarUpload";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useTenantId, useTeams } from "@/components/layout/DashboardClientLayout";
import { useToast } from "@/components/ui/Toast";
import ClientStatusBadges from "./ClientStatusBadges";
import { haptic } from "@/lib/haptics";

interface ClientHeaderProps {
  client: Client;
  stats: ClientStats | undefined;
  onOpenMenu: () => void;
  onBack: () => void;
  /** F3.5 — persist a new avatar URL after upload. Omitted = read-only avatar. */
  onAvatarChange?: (avatarUrl: string) => void;
}

const MONTHS_RU_SHORT = [
  "янв", "фев", "мар", "апр", "мая", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

/** "2024-05-10" → "10 мая"; "" → "". */
function formatShortDateRu(key: string): string {
  if (!key) return "";
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${d} ${MONTHS_RU_SHORT[m - 1] ?? ""}`.trim();
}

/** Russian plural for «визит». */
function visitsWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "визит";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "визита";
  return "визитов";
}

function euro(n: number): string {
  return `€${Math.round(n).toLocaleString("ru-RU")}`;
}

export default function ClientHeader({
  client,
  stats,
  onOpenMenu,
  onBack,
  onAvatarChange,
}: ClientHeaderProps) {
  const tenantId = useTenantId();
  const { teams } = useTeams();
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

  // ─── derive the three summary lines from stats (single source) ──────
  const income = stats && stats.totalSpent > 0 ? euro(stats.totalSpent) : null;
  const debt = stats && stats.debt > 0 ? `долг ${euro(stats.debt)}` : null;
  const expected =
    stats && stats.expectedRevenue > 0 ? `ждём ${euro(stats.expectedRevenue)}` : null;
  const hasMoney = Boolean(income || debt || expected);

  const teamName = stats?.lastTeamId
    ? teams.find((t) => t.id === stats.lastTeamId)?.name ?? null
    : null;
  const metaSegments = [
    formatShortDateRu(stats?.lastVisitDate ?? ""),
    teamName,
    client.city || null,
  ].filter(Boolean) as string[];

  const sinceYear = (client.first_contact_date || client.created_at || "").slice(0, 4);
  const avgCheck =
    stats && stats.visits > 0 ? Math.round(stats.totalSpent / stats.visits) : 0;
  const trustSegments = [
    sinceYear ? `Клиент с ${sinceYear}` : null,
    stats && stats.visits > 0 ? `${stats.visits} ${visitsWord(stats.visits)}` : null,
    avgCheck > 0 ? `средний ${euro(avgCheck)}` : null,
  ].filter(Boolean) as string[];

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
        {onAvatarChange ? (
          <button
            type="button"
            onClick={handleAvatarClick}
            disabled={uploading}
            aria-label="Загрузить фото"
            className="relative w-14 h-14 rounded-full shrink-0 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] active:opacity-80"
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
              <span className="flex w-full h-full items-center justify-center text-[var(--label-on-accent)] font-bold text-[18px]">
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
            className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 overflow-hidden text-[var(--label-on-accent)] font-bold text-[18px]"
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

          {/* Money row — coloured text, each segment hides at 0 */}
          {hasMoney && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[14px] font-semibold tabular-nums">
              {income && <span className="text-[var(--system-green)]">{income}</span>}
              {debt && <span className="text-[#B78600]">{debt}</span>}
              {expected && <span className="text-[var(--label-secondary)]">{expected}</span>}
            </div>
          )}

          {/* Meta line */}
          {metaSegments.length > 0 && (
            <div className="mt-1.5 text-[12.5px] text-[var(--label-secondary)] truncate">
              🕘 {metaSegments.join(" · ")}
            </div>
          )}

          {/* Trust line */}
          {trustSegments.length > 0 && (
            <div className="mt-0.5 text-[12px] text-[var(--label-tertiary)] truncate">
              {trustSegments.join(" · ")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
