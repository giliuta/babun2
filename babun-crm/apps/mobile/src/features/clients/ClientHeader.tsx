// Mobile port of apps/web/src/components/clients/ClientHeader.tsx (web v813).
//
// Poster-style header for the client detail card: name (title), inline
// status badges, phone (with call + message actions — the mobile
// addition over the web's pure-text phone line), debt atom (red, only
// when долг>0) and one grey trust line «{N} визитов · €{LTV} · был {дата}».
//
// Presentational. Receives props from the composer; persists name/phone
// edits via `update`. NativeWind className on core RN components only;
// icons from lucide-react-native (color/size props).

import { useEffect, useState } from "react";
import { Linking, Pressable, Text, TextInput, View } from "react-native";
import {
  Ban,
  Cake,
  Calendar,
  MessageCircle,
  Phone,
  Sparkles,
  Star,
} from "lucide-react-native";
import type { Client } from "@babun/shared/local/clients";
import type { Appointment } from "@babun/shared/local/appointments";
import type { ClientStats } from "@babun/shared/local/selectors/client-stats";
import { formatEUR } from "@babun/shared/common/utils/money";

interface ClientHeaderProps {
  client: Client;
  appointments: Appointment[];
  stats: ClientStats | undefined;
  update: (patch: Partial<Client>) => void;
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

function visitsWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "визит";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "визита";
  return "визитов";
}

// ─── Status badges (port of ClientStatusBadges, capped at 3) ──────────
type BadgeSlot = {
  key: string;
  Icon: typeof Star;
  /** chip background className */
  chip: string;
  /** icon color hex */
  color: string;
};

function StatusBadges({
  client,
  stats,
  budget = 3,
}: {
  client: Client;
  stats: ClientStats | undefined;
  budget?: number;
}) {
  const slots: BadgeSlot[] = [];

  if (client.blacklisted) {
    slots.push({ key: "blacklist", Icon: Ban, chip: "bg-danger/10", color: "#ef4444" });
  }
  const bdays = stats?.birthdayInDays ?? null;
  if (bdays !== null && bdays >= 0 && bdays <= 14) {
    slots.push({ key: "birthday", Icon: Cake, chip: "bg-warning/10", color: "#f59e0b" });
  }
  const naDays = stats?.nextAptDays ?? null;
  if (naDays !== null && naDays >= 0 && naDays <= 7) {
    slots.push({ key: "calendar", Icon: Calendar, chip: "bg-brand/10", color: "#4338ca" });
  }
  if (client.tag_ids?.includes("tag-vip")) {
    slots.push({ key: "vip", Icon: Star, chip: "bg-amber-100", color: "#b78600" });
  }
  const isNew =
    stats !== undefined && stats.ageDays >= 0 && stats.ageDays < 30 && stats.visits === 0;
  if (isNew) {
    slots.push({ key: "new", Icon: Sparkles, chip: "bg-success/10", color: "#10b981" });
  }

  const visible = slots.slice(0, Math.max(0, budget));
  if (visible.length === 0) return null;
  return (
    <View className="flex-row items-center gap-1">
      {visible.map(({ key, Icon, chip, color }) => (
        <View
          key={key}
          className={`h-5 w-5 items-center justify-center rounded-full ${chip}`}
        >
          <Icon color={color} size={11} strokeWidth={2.5} />
        </View>
      ))}
    </View>
  );
}

// ─── Inline-editable single-line text (tap → edit, save on blur) ──────
function EditableLine({
  value,
  onSave,
  placeholder,
  textClass,
  keyboardType,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder: string;
  textClass: string;
  keyboardType?: "phone-pad" | "default";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  if (editing) {
    return (
      <TextInput
        autoFocus
        value={draft}
        onChangeText={setDraft}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#a3a3a3"
        onBlur={() => {
          setEditing(false);
          if (draft.trim() !== value) onSave(draft.trim());
        }}
        className={`rounded-lg bg-neutral-100 px-2 py-1 ${textClass}`}
      />
    );
  }
  return (
    <Pressable onPress={() => setEditing(true)} className="active:opacity-60">
      <Text className={value ? textClass : "text-neutral-400"}>
        {value || placeholder}
      </Text>
    </Pressable>
  );
}

export default function ClientHeader({ client, stats, update }: ClientHeaderProps) {
  const phoneDigits = client.phone?.replace(/\D/g, "") ?? "";
  const hasPhone = phoneDigits.length > 0;

  const debt = stats && stats.debt > 0 ? `Долг ${formatEUR(stats.debt)}` : null;
  const trustSegments = (
    stats
      ? [
          stats.visits > 0 ? `${stats.visits} ${visitsWord(stats.visits)}` : null,
          stats.totalSpent > 0 ? formatEUR(stats.totalSpent) : null,
          stats.lastVisitDate ? `был ${formatShortDateRu(stats.lastVisitDate)}` : null,
        ].filter(Boolean)
      : []
  ) as string[];

  return (
    <View className="mx-3 mt-2 rounded-2xl bg-white p-3 shadow-sm">
      {/* Name + status badges */}
      <View className="flex-row items-center gap-1.5">
        <View className="flex-1">
          <EditableLine
            value={client.full_name}
            onSave={(v) => update({ full_name: v })}
            placeholder="Имя"
            textClass="text-xl font-bold text-neutral-900"
          />
        </View>
        <StatusBadges client={client} stats={stats} budget={3} />
      </View>

      {/* Phone (grey, editable) + call / message actions */}
      <View className="mt-1 flex-row items-center gap-2">
        <View className="flex-1">
          <EditableLine
            value={client.phone}
            onSave={(v) => update({ phone: v })}
            placeholder="Телефон"
            textClass="text-sm text-neutral-500"
            keyboardType="phone-pad"
          />
        </View>
        {hasPhone ? (
          <>
            <Pressable
              onPress={() => Linking.openURL(`tel:${phoneDigits}`)}
              className="h-9 w-9 items-center justify-center rounded-lg bg-success/10 active:opacity-70"
              accessibilityLabel="Позвонить"
            >
              <Phone color="#10b981" size={16} />
            </Pressable>
            <Pressable
              onPress={() => Linking.openURL(`sms:${phoneDigits}`)}
              className="h-9 w-9 items-center justify-center rounded-lg bg-brand/10 active:opacity-70"
              accessibilityLabel="Написать"
            >
              <MessageCircle color="#4338ca" size={16} />
            </Pressable>
          </>
        ) : null}
      </View>

      {/* Debt atom (red, only when долг>0) */}
      {debt ? (
        <Text className="mt-1.5 text-sm font-semibold text-danger">{debt}</Text>
      ) : null}

      {/* Trust line «N визитов · €LTV · был дата» */}
      {trustSegments.length > 0 ? (
        <Text className="mt-1 text-[13px] text-neutral-500">
          {trustSegments.join(" · ")}
        </Text>
      ) : null}
    </View>
  );
}
