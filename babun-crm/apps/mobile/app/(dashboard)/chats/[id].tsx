import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  CornerUpLeft,
  Link2,
  Search,
  Send,
  Star,
  Trash2,
  X,
  Zap,
} from "lucide-react-native";
import { CHANNEL_LABELS, type ChatMessage } from "@babun/shared/local/chats";
import {
  detectLanguage,
  QUICK_REPLIES,
} from "@babun/shared/common/utils/quick-replies";
import { Screen } from "@/components/ui/Screen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { COLORS, ICON } from "@/components/ui/tokens";
import { useClients } from "@/features/clients/queries";
import {
  useChat,
  useDeleteMessage,
  useLinkClient,
  useMarkRead,
  useSendMessage,
  useSetDraft,
  useStarMessage,
} from "@/features/chats/store";

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

export default function ChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chat = useChat(id);
  const { data: clients = [] } = useClients();

  const send = useSendMessage();
  const star = useStarMessage();
  const del = useDeleteMessage();
  const setDraftMut = useSetDraft();
  const linkClient = useLinkClient();
  const markRead = useMarkRead();

  const listRef = useRef<FlatList>(null);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [menuMsg, setMenuMsg] = useState<ChatMessage | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [clientQuery, setClientQuery] = useState("");

  // hydrate draft + mark read on open
  useEffect(() => {
    if (!chat) return;
    setDraft(chat.draft ?? "");
    if (chat.unread_count > 0) markRead.mutate(chat.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id]);

  const byId = useMemo(
    () => new Map((chat?.messages ?? []).map((m) => [m.id, m])),
    [chat?.messages],
  );
  const lang = useMemo(
    () => detectLanguage((chat?.messages ?? []).map((m) => m.text)),
    [chat?.messages],
  );
  const linkedClient = chat?.client_id
    ? clients.find((c) => c.id === chat.client_id)
    : null;

  if (!chat) {
    return (
      <Screen edges={["top"]}>
        <ScreenHeader title="Чат" />
        <EmptyState fill title="Диалог не найден" />
      </Screen>
    );
  }

  const persistDraft = () => {
    if ((chat.draft ?? "") !== draft) setDraftMut.mutate({ chatId: chat.id, draft });
  };

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    send.mutate({ chatId: chat.id, text, replyToId: replyTo?.id ?? null });
    setReplyTo(null);
  };

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    const base = q
      ? clients.filter(
          (c) =>
            c.full_name.toLowerCase().includes(q) ||
            (c.phone ?? "").includes(q),
        )
      : clients;
    return base.slice(0, 50);
  }, [clients, clientQuery]);

  return (
    <Screen edges={["top"]}>
      <ScreenHeader
        title={chat.contact_name || "Без имени"}
        subtitle={
          linkedClient
            ? `${CHANNEL_LABELS[chat.channel]} · ${linkedClient.full_name}`
            : CHANNEL_LABELS[chat.channel]
        }
        right={
          <Pressable
            onPress={() => setLinkOpen(true)}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-neutral-100"
          >
            <Link2 color={linkedClient ? COLORS.brand : COLORS.faint} size={ICON.sm} />
          </Pressable>
        }
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
          renderItem={({ item }) => {
            const out = item.direction === "out";
            const quoted = item.reply_to_id ? byId.get(item.reply_to_id) : null;
            return (
              <Pressable
                onLongPress={() => setMenuMsg(item)}
                className={`my-0.5 max-w-[82%] ${out ? "self-end" : "self-start"}`}
              >
                <View
                  className={`rounded-2xl px-3.5 py-2 ${out ? "bg-brand" : "bg-neutral-100"}`}
                >
                  {quoted ? (
                    <View
                      className={`mb-1 rounded-md border-l-2 px-2 py-1 ${out ? "border-white/60 bg-white/15" : "border-brand/50 bg-black/5"}`}
                    >
                      <Text
                        className={`text-[11px] ${out ? "text-white/80" : "text-neutral-500"}`}
                        numberOfLines={1}
                      >
                        {bodyOf(quoted)}
                      </Text>
                    </View>
                  ) : null}
                  <Text className={`text-base ${out ? "text-white" : "text-neutral-900"}`}>
                    {bodyOf(item)}
                  </Text>
                </View>
                <View className={`mt-0.5 flex-row items-center gap-1 px-1 ${out ? "justify-end" : ""}`}>
                  {item.is_starred ? (
                    <Star color={COLORS.warning} size={11} fill={COLORS.warning} />
                  ) : null}
                  <Text className="text-[10px] text-neutral-400">{msgTime(item.timestamp)}</Text>
                </View>
              </Pressable>
            );
          }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <EmptyState title="Нет сообщений" subtitle="Напишите первым" />
          }
        />

        {/* reply quote bar */}
        {replyTo ? (
          <View className="flex-row items-center border-t border-neutral-100 bg-neutral-50 px-3 py-2">
            <View className="mr-2 h-8 w-1 rounded-full bg-brand" />
            <Text className="flex-1 text-sm text-neutral-600" numberOfLines={1}>
              {bodyOf(replyTo)}
            </Text>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
              <X color={COLORS.sub} size={16} />
            </Pressable>
          </View>
        ) : null}

        {/* composer */}
        <View className="flex-row items-end gap-2 border-t border-neutral-200 bg-white px-3 py-2 pb-6">
          <Pressable
            onPress={() => setQrOpen(true)}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-neutral-100"
          >
            <Zap color={COLORS.brand} size={ICON.sm} />
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onBlur={persistDraft}
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

      {/* message context menu */}
      <Modal visible={!!menuMsg} transparent animationType="fade" onRequestClose={() => setMenuMsg(null)}>
        <Pressable className="flex-1 justify-end bg-black/30" onPress={() => setMenuMsg(null)}>
          <View className="m-3 overflow-hidden rounded-2xl bg-white">
            {[
              {
                label: "Ответить",
                icon: CornerUpLeft,
                onPress: () => {
                  setReplyTo(menuMsg);
                  setMenuMsg(null);
                },
              },
              {
                label: menuMsg?.is_starred ? "Убрать из избранного" : "В избранное",
                icon: Star,
                onPress: () => {
                  if (menuMsg) star.mutate({ chatId: chat.id, messageId: menuMsg.id });
                  setMenuMsg(null);
                },
              },
              {
                label: "Удалить",
                icon: Trash2,
                danger: true,
                onPress: () => {
                  if (menuMsg) del.mutate({ chatId: chat.id, messageId: menuMsg.id });
                  setMenuMsg(null);
                },
              },
            ].map((a, i) => (
              <Pressable
                key={a.label}
                onPress={a.onPress}
                className={`flex-row items-center gap-3 px-4 py-3.5 active:bg-neutral-50 ${i > 0 ? "border-t border-neutral-100" : ""}`}
              >
                <a.icon color={a.danger ? COLORS.danger : COLORS.body} size={ICON.sm} />
                <Text className={`text-base ${a.danger ? "text-danger" : "text-neutral-900"}`}>
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* quick replies */}
      <Modal visible={qrOpen} transparent animationType="slide" onRequestClose={() => setQrOpen(false)}>
        <Pressable className="flex-1 bg-black/30" onPress={() => setQrOpen(false)} />
        <View className="absolute bottom-0 left-0 right-0 max-h-[70%] rounded-t-3xl bg-white p-4 pb-8">
          <Text className="mb-2 text-lg font-bold text-neutral-900">Быстрые ответы</Text>
          <FlatList
            data={QUICK_REPLIES}
            keyExtractor={(q) => q.id}
            renderItem={({ item }) => {
              const variant =
                item.variants.find((v) => v.lang === lang) ?? item.variants[0];
              return (
                <Pressable
                  onPress={() => {
                    setDraft((d) => (d ? `${d} ${variant.text}` : variant.text));
                    setQrOpen(false);
                  }}
                  className="border-b border-neutral-100 py-3 active:opacity-70"
                >
                  <Text className="text-sm font-semibold text-neutral-900">
                    {item.emoji} {item.title}
                  </Text>
                  <Text className="mt-0.5 text-sm text-neutral-500" numberOfLines={2}>
                    {variant.text}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>

      {/* link client */}
      <Modal visible={linkOpen} transparent animationType="slide" onRequestClose={() => setLinkOpen(false)}>
        <Pressable className="flex-1 bg-black/30" onPress={() => setLinkOpen(false)} />
        <View className="absolute bottom-0 left-0 right-0 h-[70%] rounded-t-3xl bg-white">
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text className="text-lg font-bold text-neutral-900">Привязать клиента</Text>
            {linkedClient ? (
              <Pressable
                onPress={() => {
                  linkClient.mutate({ chatId: chat.id, clientId: null });
                  setLinkOpen(false);
                }}
              >
                <Text className="text-sm font-medium text-danger">Отвязать</Text>
              </Pressable>
            ) : null}
          </View>
          <View className="mx-4 mb-2 flex-row items-center gap-2 rounded-xl bg-neutral-100 px-3">
            <Search color={COLORS.faint} size={ICON.sm} />
            <TextInput
              value={clientQuery}
              onChangeText={setClientQuery}
              placeholder="Поиск клиента"
              placeholderTextColor={COLORS.faint}
              className="flex-1 py-2 text-base text-neutral-900"
            />
          </View>
          <FlatList
            data={filteredClients}
            keyExtractor={(c) => c.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  linkClient.mutate({ chatId: chat.id, clientId: item.id });
                  setLinkOpen(false);
                }}
                className="flex-row items-center justify-between px-4 py-3 active:bg-neutral-50"
              >
                <View>
                  <Text className="text-base text-neutral-900">{item.full_name}</Text>
                  {item.phone ? (
                    <Text className="text-sm text-neutral-500">{item.phone}</Text>
                  ) : null}
                </View>
                {chat.client_id === item.id ? (
                  <Star color={COLORS.brand} size={ICON.sm} fill={COLORS.brand} />
                ) : null}
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View className="ml-4 h-px bg-neutral-100" />}
          />
        </View>
      </Modal>
    </Screen>
  );
}
