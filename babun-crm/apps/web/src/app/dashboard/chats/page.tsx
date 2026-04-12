"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useClients } from "@/app/dashboard/layout";
import { createBlankClient } from "@/lib/clients";
import {
  type Chat,
  type ChatChannel,
  type ChatMessage,
  loadChats,
  saveChats,
  CHANNEL_LABELS,
  CHANNEL_COLORS,
  getTotalUnread,
} from "@/lib/chats";
import { generateId } from "@/lib/masters";

type FilterChannel = ChatChannel | "all";

export default function ChatsPage() {
  const { clients, upsertClient } = useClients();
  const [chats, setChats] = useState<Chat[]>([]);
  const [filter, setFilter] = useState<FilterChannel>("all");
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setChats(loadChats());
  }, []);

  const persist = (next: Chat[]) => {
    setChats(next);
    saveChats(next);
  };

  const filtered = useMemo(
    () =>
      (filter === "all" ? chats : chats.filter((c) => c.channel === filter))
        .sort(
          (a, b) =>
            new Date(b.last_message_at).getTime() -
            new Date(a.last_message_at).getTime()
        ),
    [chats, filter]
  );

  const totalUnread = getTotalUnread(chats);

  const openChat = (chat: Chat) => {
    // Mark as read
    if (chat.unread_count > 0) {
      const next = chats.map((c) =>
        c.id === chat.id ? { ...c, unread_count: 0 } : c
      );
      persist(next);
      setActiveChat({ ...chat, unread_count: 0 });
    } else {
      setActiveChat(chat);
    }
  };

  const sendMessage = () => {
    if (!activeChat || !draft.trim()) return;
    const msg: ChatMessage = {
      id: generateId("msg"),
      direction: "out",
      text: draft.trim(),
      timestamp: new Date().toISOString(),
    };
    const updated: Chat = {
      ...activeChat,
      messages: [...activeChat.messages, msg],
      last_message_at: msg.timestamp,
    };
    setActiveChat(updated);
    persist(chats.map((c) => (c.id === updated.id ? updated : c)));
    setDraft("");
  };

  const createClientFromChat = (chat: Chat) => {
    const newClient = createBlankClient({
      full_name: chat.contact_name || "Новый клиент",
      phone: chat.contact_phone,
      telegram_username:
        chat.channel === "telegram" ? chat.contact_handle.replace("@", "") : "",
      instagram_username:
        chat.channel === "instagram"
          ? chat.contact_handle.replace("@", "")
          : "",
    });
    upsertClient(newClient);
    const updated = { ...chat, client_id: newClient.id };
    if (activeChat?.id === chat.id) setActiveChat(updated);
    persist(chats.map((c) => (c.id === chat.id ? updated : c)));
  };

  // Chat detail view
  if (activeChat) {
    const linkedClient = activeChat.client_id
      ? clients.find((c) => c.id === activeChat.client_id) ?? null
      : null;

    return (
      <>
        <PageHeader
          title={activeChat.contact_name || "Чат"}
          subtitle={
            CHANNEL_LABELS[activeChat.channel] +
            (activeChat.contact_handle
              ? ` · ${activeChat.contact_handle}`
              : "")
          }
          showBack={false}
          rightContent={
            <button
              type="button"
              onClick={() => setActiveChat(null)}
              className="px-2 py-1.5 text-xs font-medium text-white hover:bg-violet-500 rounded-lg"
            >
              Назад
            </button>
          }
        />

        <div className="flex-1 flex flex-col min-h-0">
          {/* Client link bar */}
          <div className="flex-shrink-0 px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
            {linkedClient ? (
              <div className="flex items-center gap-2 text-[12px] text-gray-600">
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">
                  {linkedClient.full_name.charAt(0)}
                </div>
                <span>Клиент: <b className="text-gray-900">{linkedClient.full_name}</b></span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => createClientFromChat(activeChat)}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-violet-600 active:text-violet-700"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
                Создать карточку клиента
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
            {activeChat.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.direction === "out" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-[13px] leading-snug ${
                    msg.direction === "out"
                      ? "bg-violet-600 text-white rounded-br-sm"
                      : "bg-white text-gray-900 border border-gray-200 rounded-bl-sm"
                  }`}
                >
                  {msg.text}
                  <div
                    className={`text-[10px] mt-1 ${
                      msg.direction === "out" ? "text-violet-200" : "text-gray-400"
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="flex-shrink-0 border-t border-gray-200 bg-white px-3 py-2 flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Сообщение..."
              className="flex-1 h-10 px-3 rounded-full bg-gray-100 text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={!draft.trim()}
              className="w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center active:scale-95 disabled:bg-gray-300"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      </>
    );
  }

  // Chat list view
  return (
    <>
      <PageHeader
        title={`Чаты${totalUnread > 0 ? ` (${totalUnread})` : ""}`}
      />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 space-y-3">
          {/* Channel filter */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            {(["all", "whatsapp", "instagram", "telegram", "sms"] as FilterChannel[]).map(
              (ch) => {
                const label = ch === "all" ? "Все" : CHANNEL_LABELS[ch as ChatChannel];
                const count =
                  ch === "all"
                    ? chats.length
                    : chats.filter((c) => c.channel === ch).length;
                const active = filter === ch;
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setFilter(ch)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition ${
                      active
                        ? "bg-violet-600 text-white"
                        : "bg-white border border-gray-200 text-gray-600"
                    }`}
                  >
                    {label} ({count})
                  </button>
                );
              }
            )}
          </div>

          {/* Conversations */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {filtered.map((chat, i) => (
              <button
                key={chat.id}
                type="button"
                onClick={() => openChat(chat)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50 ${
                  i < filtered.length - 1 ? "border-b border-gray-100" : ""
                }`}
              >
                {/* Avatar with channel dot */}
                <div className="relative">
                  <div className="w-11 h-11 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-bold text-sm">
                    {(chat.contact_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center"
                    style={{ backgroundColor: CHANNEL_COLORS[chat.channel] }}
                  >
                    {chat.channel === "whatsapp" && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.875 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                    )}
                    {chat.channel === "instagram" && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><rect x="2" y="2" width="20" height="20" rx="5"/></svg>
                    )}
                    {chat.channel === "telegram" && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><path d="M9.417 15.181l-.397 5.584c.568 0 .814-.244 1.109-.537l2.663-2.545 5.518 4.041c1.012.564 1.725.267 1.998-.931L23.93 3.821c.321-1.496-.541-2.081-1.527-1.714L1.114 10.247c-1.462.568-1.44 1.384-.249 1.752l5.535 1.723 12.856-8.09c.605-.402 1.155-.179.703.223z"/></svg>
                    )}
                    {chat.channel === "sms" && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-semibold text-gray-900 truncate">
                      {chat.contact_name || chat.contact_handle || "Без имени"}
                    </span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">
                      {formatTimeAgo(chat.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-[12px] text-gray-500 truncate">
                      {chat.messages.length > 0
                        ? chat.messages[chat.messages.length - 1].text
                        : "Нет сообщений"}
                    </span>
                    {chat.unread_count > 0 && (
                      <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center px-1">
                        {chat.unread_count}
                      </span>
                    )}
                  </div>
                  {chat.client_id && (
                    <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
                      Клиент привязан
                    </div>
                  )}
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 px-6 text-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                <div className="text-[13px] text-gray-500">Нет чатов</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "сейчас";
  if (mins < 60) return `${mins}м`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}ч`;
  const days = Math.floor(hours / 24);
  return `${days}д`;
}
