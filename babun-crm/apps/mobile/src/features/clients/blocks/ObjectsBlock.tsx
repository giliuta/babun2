// ObjectsBlock — mobile port of the web client-card Objects block
// (apps/web/src/components/clients/blocks/ObjectsBlock.tsx).
//
// Lists every client object (дом / офис / вилла) with address, optional
// note and a per-object «N визитов · посл. дата» line derived from the
// client's appointments. Supports inline add + remove (promotes a new
// primary when the previous primary is removed), and opens the address
// in Maps via Linking. Presentational: receives props, persists via
// `update(patch)` — it does NOT fetch.

import { useMemo, useState } from "react";
import { Linking, Pressable, Text, TextInput, View } from "react-native";
import { ArrowUpRight, Home, MapPin, Plus, Trash2 } from "lucide-react-native";
import type { Client, Location } from "@babun/shared/local/clients";
import type { Appointment } from "@babun/shared/local/appointments";
import { buildMapUrl } from "@babun/shared/common/utils/map-links";

interface ObjectsBlockProps {
  client: Client;
  appointments: Appointment[];
  update: (patch: Partial<Client>) => void;
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function ObjectsBlock({
  client,
  appointments,
  update,
}: ObjectsBlockProps) {
  const all = client.locations ?? [];

  // Pre-compute per-location visit counts so each row can show
  // «N визитов · last date» without re-scanning.
  const historyByLocation = useMemo(() => {
    const map = new Map<string, { count: number; lastDate: string }>();
    for (const a of appointments) {
      if (!a.location_id) continue;
      const cur = map.get(a.location_id) ?? { count: 0, lastDate: "" };
      cur.count += 1;
      if (a.date > cur.lastDate) cur.lastDate = a.date;
      map.set(a.location_id, cur);
    }
    return map;
  }, [appointments]);

  // Inline add form draft. null = not adding.
  const [draft, setDraft] = useState<{
    label: string;
    address: string;
    note: string;
  } | null>(null);

  const saveDraft = () => {
    if (!draft || !draft.address.trim()) return;
    const newLoc: Location = {
      id: genId("loc"),
      label: draft.label.trim() || "Объект",
      address: draft.address.trim(),
      isPrimary: all.length === 0,
      note: draft.note.trim() || undefined,
      equipment: [],
    };
    update({ locations: [...all, newLoc] });
    setDraft(null);
  };

  const removeLoc = (id: string) => {
    const next = all.filter((l) => l.id !== id);
    // Promote a new primary if we removed the previous one.
    const stillHasPrimary = next.some((l) => l.isPrimary);
    const reseated =
      !stillHasPrimary && next.length > 0
        ? next.map((l, i) => ({ ...l, isPrimary: i === 0 }))
        : next;
    update({ locations: reseated });
  };

  return (
    <View className="mx-3 mt-2 rounded-2xl bg-white p-3 shadow-sm">
      <Text className="px-1 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Объекты{all.length ? ` · ${all.length}` : ""}
      </Text>

      {all.length === 0 && !draft ? (
        <Text className="px-1 py-2 text-[13px] text-neutral-400">
          Объектов пока нет — добавь дом или офис, чтобы привязать
          оборудование и адрес.
        </Text>
      ) : null}

      <View className="gap-2">
        {all.map((loc) => (
          <ObjectRow
            key={loc.id}
            loc={loc}
            history={historyByLocation.get(loc.id)}
            onRemove={() => removeLoc(loc.id)}
          />
        ))}
      </View>

      {draft ? (
        <View className="mt-2 gap-2 rounded-xl bg-neutral-100 p-3">
          <TextInput
            value={draft.label}
            onChangeText={(v) => setDraft({ ...draft, label: v })}
            placeholder="Метка (Дом / Офис)"
            placeholderTextColor="#a3a3a3"
            className="rounded-lg bg-white px-3 py-2 text-sm text-neutral-900"
          />
          <TextInput
            value={draft.address}
            onChangeText={(v) => setDraft({ ...draft, address: v })}
            placeholder="Адрес или ссылка на карту"
            placeholderTextColor="#a3a3a3"
            className="rounded-lg bg-white px-3 py-2 text-sm text-neutral-900"
          />
          <TextInput
            value={draft.note}
            onChangeText={(v) => setDraft({ ...draft, note: v })}
            placeholder="Заметка (зелёная дверь, домофон 25)"
            placeholderTextColor="#a3a3a3"
            className="rounded-lg bg-white px-3 py-2 text-sm text-neutral-900"
          />
          <View className="flex-row gap-2">
            <Pressable
              onPress={saveDraft}
              disabled={!draft.address.trim()}
              className={`flex-1 items-center rounded-lg py-2 ${
                draft.address.trim() ? "bg-brand" : "bg-neutral-200"
              }`}
            >
              <Text className="text-sm font-semibold text-white">Сохранить</Text>
            </Pressable>
            <Pressable
              onPress={() => setDraft(null)}
              className="items-center rounded-lg bg-neutral-200 px-4 py-2 active:opacity-70"
            >
              <Text className="text-sm font-semibold text-neutral-700">
                Отмена
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setDraft({ label: "", address: "", note: "" })}
          className="mt-2 flex-row items-center gap-1.5 self-start px-1 py-1 active:opacity-60"
        >
          <Plus color="#4f46e5" size={14} />
          <Text className="text-[13px] font-semibold text-brand">
            {all.length > 0 ? "Добавить объект" : "Добавить первый объект"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function ObjectRow({
  loc,
  onRemove,
  history,
}: {
  loc: Location;
  onRemove: () => void;
  history?: { count: number; lastDate: string };
}) {
  const openMaps = () => {
    // Apple Maps on iOS; the shared builder returns a universal URL
    // that Linking can hand off to the installed maps app.
    const url = buildMapUrl("apple", loc.mapUrl || loc.address);
    if (url) Linking.openURL(url);
  };

  const visitWord =
    history && history.count === 1
      ? "визит"
      : history && history.count < 5
        ? "визита"
        : "визитов";

  return (
    <View className="flex-row items-start gap-2 rounded-xl bg-neutral-100 p-3">
      <View className="h-9 w-9 items-center justify-center rounded-lg bg-brand/10">
        <Home color="#4f46e5" size={16} />
      </View>

      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text
            className="text-sm font-semibold text-neutral-900"
            numberOfLines={1}
          >
            {loc.label || "Объект"}
          </Text>
          {loc.isPrimary ? (
            <Text className="text-[10px] font-bold uppercase tracking-wider text-brand">
              основной
            </Text>
          ) : null}
        </View>

        <View className="flex-row items-center gap-1">
          <MapPin color="#737373" size={10} />
          <Text className="flex-1 text-xs text-neutral-500" numberOfLines={1}>
            {loc.address || "адрес не указан"}
          </Text>
        </View>

        {loc.note ? (
          <Text className="mt-0.5 text-[11px] text-neutral-400" numberOfLines={1}>
            {loc.note}
          </Text>
        ) : null}

        {history && history.count > 0 ? (
          <Text className="mt-0.5 text-[11px] text-neutral-500">
            {history.count} {visitWord}
            {history.lastDate ? ` · посл. ${formatHistDate(history.lastDate)}` : ""}
          </Text>
        ) : null}
      </View>

      {loc.address || loc.mapUrl ? (
        <Pressable
          onPress={openMaps}
          className="h-8 w-8 items-center justify-center rounded-lg bg-brand/10 active:opacity-70"
        >
          <ArrowUpRight color="#4f46e5" size={14} />
        </Pressable>
      ) : null}

      <Pressable
        onPress={onRemove}
        className="h-8 w-8 items-center justify-center rounded-lg active:bg-danger/10"
      >
        <Trash2 color="#ef4444" size={14} />
      </Pressable>
    </View>
  );
}

function formatHistDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}
