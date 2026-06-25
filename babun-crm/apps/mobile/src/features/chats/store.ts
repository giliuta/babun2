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

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ chatId, text }: { chatId: string; text: string }) => {
      const now = new Date().toISOString();
      const msg: ChatMessage = {
        id: msgId(),
        direction: "out",
        text,
        status: "sent",
        content_type: "text",
        timestamp: now,
      };
      const next = loadChats().map((c) =>
        c.id === chatId
          ? {
              ...c,
              messages: [...c.messages, msg],
              last_message_at: now,
              draft: "",
            }
          : c,
      );
      saveChats(next);
      return next;
    },
    onSuccess: (next) => qc.setQueryData(["chats"], next),
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (chatId: string) => {
      const next = loadChats().map((c) =>
        c.id === chatId ? { ...c, unread_count: 0 } : c,
      );
      saveChats(next);
      return next;
    },
    onSuccess: (next) => qc.setQueryData(["chats"], next),
  });
}
