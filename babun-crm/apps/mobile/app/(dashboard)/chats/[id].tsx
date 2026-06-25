import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Send } from "lucide-react-native";
import {
  CHANNEL_LABELS,
  type ChatMessage,
} from "@babun/shared/local/chats";
import { Screen } from "@/components/ui/Screen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { COLORS } from "@/components/ui/tokens";
import { useChat, useMarkRead, useSendMessage } from "@/features/chats/store";

function msgTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

function bodyOf(m: ChatMessage): string {
  if (m.content_type === "image") return "📷 Фото";
  if (m.content_type === "audio") return "🎤 Голосовое";
  if (m.content_type === "location") return "📍 Геолокация";
  return m.text;
}

function Bubble({ m }: { m: ChatMessage }) {
  const out = m.direction === "out";
  return (
    <View className={`my-0.5 max-w-[80%] ${out ? "self-end" : "self-start"}`}>
      <View
        className={`rounded-2xl px-3.5 py-2 ${out ? "bg-brand" : "bg-neutral-100"}`}
      >
        <Text className={`text-base ${out ? "text-white" : "text-neutral-900"}`}>
          {bodyOf(m)}
        </Text>
      </View>
      <Text
        className={`mt-0.5 px-1 text-[10px] text-neutral-400 ${out ? "text-right" : "text-left"}`}
      >
        {msgTime(m.timestamp)}
      </Text>
    </View>
  );
}

export default function ChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chat = useChat(id);
  const send = useSendMessage();
  const markRead = useMarkRead();
  const listRef = useRef<FlatList>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (chat && chat.unread_count > 0) markRead.mutate(chat.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id]);

  if (!chat) {
    return (
      <Screen edges={["top"]}>
        <ScreenHeader title="Чат" />
        <EmptyState fill title="Диалог не найден" />
      </Screen>
    );
  }

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    send.mutate({ chatId: chat.id, text });
  };

  return (
    <Screen edges={["top"]}>
      <ScreenHeader
        title={chat.contact_name || "Без имени"}
        subtitle={CHANNEL_LABELS[chat.channel]}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          ref={listRef}
          style={{ flex: 1 }}
          data={chat.messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12, flexGrow: 1, justifyContent: "flex-end" }}
          renderItem={({ item }) => <Bubble m={item} />}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <EmptyState title="Нет сообщений" subtitle="Напишите первым" />
          }
        />
        <View className="flex-row items-end gap-2 border-t border-neutral-200 bg-white px-3 py-2 pb-6">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Сообщение…"
            placeholderTextColor={COLORS.faint}
            multiline
            className="max-h-24 flex-1 rounded-2xl bg-neutral-100 px-4 py-2.5 text-base text-neutral-900"
          />
          <Pressable
            onPress={submit}
            disabled={!draft.trim()}
            className={`h-10 w-10 items-center justify-center rounded-full ${draft.trim() ? "bg-brand active:opacity-80" : "bg-neutral-200"}`}
          >
            <Send color="#fff" size={18} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
