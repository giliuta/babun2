import { useMemo } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import {
  CHANNEL_COLORS,
  CHANNEL_LABELS,
  seedDemoChats,
  type Chat,
} from "@babun/shared/local/chats";
import { Screen } from "@/components/ui/Screen";

// Phase 7 first pass: a conversation list. Chats are localStorage-only on web
// (no Supabase table) and loadChats() is window-bound, so on mobile we render
// the shared demo seed read-only until the storage codemod lands an MMKV-backed
// loadChats + a thread/composer view.

function lastPreview(c: Chat): string {
  const m = c.messages[c.messages.length - 1];
  if (!m) return "Нет сообщений";
  if (m.content_type === "image") return "📷 Фото";
  if (m.content_type === "audio") return "🎤 Голосовое";
  if (m.content_type === "location") return "📍 Геолокация";
  return m.text;
}

function shortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes(),
    ).padStart(2, "0")}`;
  }
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function ChatRow({ c }: { c: Chat }) {
  const color = CHANNEL_COLORS[c.channel] ?? "#6b7280";
  const initial = (c.contact_name || "?").trim().slice(0, 1).toUpperCase();
  return (
    <Pressable className="flex-row items-center px-4 py-3 active:bg-neutral-100">
      <View
        className="h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: `${color}22` }}
      >
        <Text className="text-lg font-semibold" style={{ color }}>
          {initial}
        </Text>
      </View>
      <View className="ml-3 flex-1">
        <View className="flex-row items-center justify-between">
          <Text
            className="flex-1 pr-2 text-base font-semibold text-neutral-900"
            numberOfLines={1}
          >
            {c.contact_name || "Без имени"}
          </Text>
          <Text className="text-xs text-neutral-400">
            {shortTime(c.last_message_at)}
          </Text>
        </View>
        <View className="mt-0.5 flex-row items-center">
          <Text className="text-[11px] font-medium" style={{ color }}>
            {CHANNEL_LABELS[c.channel]}
          </Text>
          <Text className="px-1 text-neutral-300">·</Text>
          <Text className="flex-1 text-sm text-neutral-500" numberOfLines={1}>
            {lastPreview(c)}
          </Text>
          {c.unread_count > 0 ? (
            <View className="ml-2 h-5 min-w-[20px] items-center justify-center rounded-full bg-brand px-1.5">
              <Text className="text-[11px] font-bold text-white">
                {c.unread_count}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function ChatsTab() {
  const chats = useMemo(
    () =>
      seedDemoChats().sort((a, b) =>
        b.last_message_at.localeCompare(a.last_message_at),
      ),
    [],
  );
  const unread = useMemo(
    () => chats.reduce((s, c) => s + c.unread_count, 0),
    [chats],
  );

  return (
    <Screen>
      <View className="px-4 pb-2 pt-4">
        <Text className="text-2xl font-bold text-neutral-900">Чаты</Text>
        <Text className="text-sm text-neutral-500">
          {chats.length} диалогов{unread > 0 ? ` · ${unread} непрочитанных` : ""}
        </Text>
      </View>
      <FlatList
        style={{ flex: 1 }}
        data={chats}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <ChatRow c={item} />}
        ItemSeparatorComponent={() => (
          <View className="ml-[68px] h-px bg-neutral-100" />
        )}
      />
    </Screen>
  );
}
