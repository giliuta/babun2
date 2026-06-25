import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Search } from "lucide-react-native";
import {
  CHANNEL_COLORS,
  CHANNEL_LABELS,
  type Chat,
  type ChatChannel,
} from "@babun/shared/local/chats";
import { Screen } from "@/components/ui/Screen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { COLORS, ICON } from "@/components/ui/tokens";
import { useChats } from "@/features/chats/store";

const CHANNELS: ChatChannel[] = ["whatsapp", "telegram", "instagram", "sms"];

function lastPreview(c: Chat): string {
  const m = c.messages[c.messages.length - 1];
  if (!m) return "Нет сообщений";
  if (m.content_type === "image") return "📷 Фото";
  if (m.content_type === "audio") return "🎤 Голосовое";
  if (m.content_type === "location") return "📍 Геолокация";
  return m.direction === "out" ? `Вы: ${m.text}` : m.text;
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

function ChatRow({ c, onPress }: { c: Chat; onPress: () => void }) {
  const color = CHANNEL_COLORS[c.channel] ?? "#6b7280";
  const initial = (c.contact_name || "?").trim().slice(0, 1).toUpperCase();
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3 active:bg-neutral-100"
    >
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

export default function ChatsListScreen() {
  const router = useRouter();
  const { data: chats = [], isLoading } = useChats();
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<ChatChannel | null>(null);

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...chats]
      .filter((c) => (channel ? c.channel === channel : true))
      .filter((c) => {
        if (!q) return true;
        const last = c.messages[c.messages.length - 1]?.text ?? "";
        return (
          c.contact_name.toLowerCase().includes(q) ||
          last.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
  }, [chats, query, channel]);
  const unread = useMemo(
    () => chats.reduce((s, c) => s + c.unread_count, 0),
    [chats],
  );

  return (
    <Screen edges={["top"]}>
      <ScreenHeader
        large
        title="Чаты"
        subtitle={`${chats.length} диалогов${unread > 0 ? ` · ${unread} непрочитанных` : ""}`}
      />

      <View className="mx-4 mb-2 flex-row items-center gap-2 rounded-xl bg-neutral-100 px-3">
        <Search color={COLORS.faint} size={ICON.sm} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск по имени или тексту"
          placeholderTextColor={COLORS.faint}
          clearButtonMode="while-editing"
          className="flex-1 py-2.5 text-base text-neutral-900"
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, maxHeight: 48 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8, alignItems: "center" }}
      >
        {[null, ...CHANNELS].map((ch) => {
          const active = channel === ch;
          const color = ch ? CHANNEL_COLORS[ch] : COLORS.brand;
          return (
            <Pressable
              key={ch ?? "all"}
              onPress={() => setChannel(ch)}
              className="rounded-full px-3.5 py-1.5"
              style={{ backgroundColor: active ? color : "#f5f5f5" }}
            >
              <Text
                className="text-sm font-medium"
                style={{ color: active ? "#fff" : "#404040" }}
              >
                {ch ? CHANNEL_LABELS[ch] : "Все"}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <EmptyState state="loading" fill />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={sorted}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ flexGrow: 1 }}
          renderItem={({ item }) => (
            <ChatRow c={item} onPress={() => router.push(`/chats/${item.id}`)} />
          )}
          ItemSeparatorComponent={() => (
            <View className="ml-[68px] h-px bg-neutral-100" />
          )}
          ListEmptyComponent={<EmptyState fill title="Нет диалогов" />}
        />
      )}
    </Screen>
  );
}
