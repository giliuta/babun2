import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  loadChats,
  saveChats,
  seedDemoChats,
  type Chat,
  type ChatMessage,
} from "@babun/shared/local/chats";

// Chats persist in MMKV via the shared storage seam. First run seeds the demo
// inbox so the screen isn't empty; afterwards it's the user's own data.
function loadOrSeed(): Chat[] {
  const existing = loadChats();
  if (existing.length) return existing;
  const seeded = seedDemoChats();
  saveChats(seeded);
  return seeded;
}

const msgId = () =>
  `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export function useChats() {
  return useQuery({
    queryKey: ["chats"],
    queryFn: () => loadOrSeed(),
    staleTime: Infinity,
  });
}

export function useChat(id: string): Chat | null {
  const { data } = useChats();
  return data?.find((c) => c.id === id) ?? null;
}

// Apply a transform to one chat, persist, and update the cache.
function useChatMutation<V>(fn: (chats: Chat[], v: V) => Chat[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => {
      const next = fn(loadChats(), v);
      saveChats(next);
      return next;
    },
    onSuccess: (next) => qc.setQueryData(["chats"], next),
  });
}

export function useSendMessage() {
  return useChatMutation<{ chatId: string; text: string; replyToId?: string | null }>(
    (chats, { chatId, text, replyToId }) => {
      const now = new Date().toISOString();
      const msg: ChatMessage = {
        id: msgId(),
        direction: "out",
        text,
        status: "sent",
        content_type: "text",
        timestamp: now,
        ...(replyToId ? { reply_to_id: replyToId } : {}),
      };
      return chats.map((c) =>
        c.id === chatId
          ? { ...c, messages: [...c.messages, msg], last_message_at: now, draft: "" }
          : c,
      );
    },
  );
}

export function useStarMessage() {
  return useChatMutation<{ chatId: string; messageId: string }>(
    (chats, { chatId, messageId }) =>
      chats.map((c) =>
        c.id === chatId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, is_starred: !m.is_starred } : m,
              ),
            }
          : c,
      ),
  );
}

export function useDeleteMessage() {
  return useChatMutation<{ chatId: string; messageId: string }>(
    (chats, { chatId, messageId }) =>
      chats.map((c) =>
        c.id === chatId
          ? { ...c, messages: c.messages.filter((m) => m.id !== messageId) }
          : c,
      ),
  );
}

export function useSetDraft() {
  return useChatMutation<{ chatId: string; draft: string }>(
    (chats, { chatId, draft }) =>
      chats.map((c) => (c.id === chatId ? { ...c, draft } : c)),
  );
}

export function useLinkClient() {
  return useChatMutation<{ chatId: string; clientId: string | null }>(
    (chats, { chatId, clientId }) =>
      chats.map((c) => (c.id === chatId ? { ...c, client_id: clientId } : c)),
  );
}

export function useMarkRead() {
  return useChatMutation<string>((chats, chatId) =>
    chats.map((c) => (c.id === chatId ? { ...c, unread_count: 0 } : c)),
  );
}
