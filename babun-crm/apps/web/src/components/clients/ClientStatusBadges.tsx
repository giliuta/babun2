"use client";

// v332 — Up-to-three status icons rendered inline next to the
// client's name in ClientCard.
//
// Icons are picked by priority and capped at 3 so the row never
// overflows the available width on a 375 px iPhone.  Order follows
// the user-requested priority (debt-pill is rendered separately by
// the parent and counts against the same budget):
//
//   1. Ban (red) — blacklist
//   2. Cake (orange) — birthday in ≤14 days
//   3. Calendar (accent) — upcoming appointment in ≤7 days
//   4. Star (yellow) — VIP tag
//   5. Sparkles (green) — new client (<30 days in DB)

import { Ban, Cake, Calendar, Star, Sparkles } from "lucide-react";
import type { Client } from "@/lib/clients";
import type { ClientStats } from "@/lib/client-stats";

interface BadgeSlot {
  key: string;
  icon: React.ReactNode;
  /** Tailwind class for the round chip. */
  cls: string;
  title: string;
}

interface Props {
  client: Client;
  stats: ClientStats | undefined;
  /** When the parent already shows a debt pill, ping back to skip
   *  one slot — keeps total icon count ≤ 3. */
  budget?: number;
}

export default function ClientStatusBadges({
  client,
  stats,
  budget = 3,
}: Props) {
  const slots: BadgeSlot[] = [];

  if (client.blacklisted) {
    slots.push({
      key: "blacklist",
      icon: <Ban size={11} strokeWidth={2.5} />,
      cls: "bg-[rgba(255,59,48,0.12)] text-[var(--system-red)]",
      title: "Чёрный список",
    });
  }

  const bdays = stats?.birthdayInDays ?? null;
  if (bdays !== null && bdays >= 0 && bdays <= 14) {
    slots.push({
      key: "birthday",
      icon: <Cake size={11} strokeWidth={2.5} />,
      cls: "bg-[rgba(255,149,0,0.12)] text-[var(--system-orange)]",
      title:
        bdays === 0
          ? "Сегодня ДР!"
          : bdays === 1
            ? "ДР завтра"
            : `ДР через ${bdays} дн.`,
    });
  }

  const naDays = stats?.nextAptDays ?? null;
  if (naDays !== null && naDays >= 0 && naDays <= 7) {
    slots.push({
      key: "calendar",
      icon: <Calendar size={11} strokeWidth={2.5} />,
      cls: "bg-[var(--accent-tint)] text-[var(--accent)]",
      title: "Есть ближайшая запись",
    });
  }

  const isVip = client.tag_ids?.includes("tag-vip");
  if (isVip) {
    slots.push({
      key: "vip",
      icon: <Star size={11} strokeWidth={2.5} />,
      cls: "bg-[rgba(255,204,0,0.18)] text-[#B78600]",
      title: "VIP",
    });
  }

  const isNew =
    stats !== undefined &&
    stats.ageDays >= 0 &&
    stats.ageDays < 30 &&
    stats.visits === 0;
  if (isNew) {
    slots.push({
      key: "new",
      icon: <Sparkles size={11} strokeWidth={2.5} />,
      cls: "bg-[rgba(52,199,89,0.12)] text-[var(--system-green)]",
      title: "Новый клиент",
    });
  }

  const visible = slots.slice(0, Math.max(0, budget));
  if (visible.length === 0) return null;
  return (
    <>
      {visible.map((s) => (
        <span
          key={s.key}
          title={s.title}
          aria-label={s.title}
          className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${s.cls}`}
        >
          {s.icon}
        </span>
      ))}
    </>
  );
}
