"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { haptic } from "@/lib/haptics";

type FilterChannel = ChatChannel | "all";

export default function ChatsPage() {
  const { clients, upsertClient } = useClients();
  const [chats, setChats] = useState<Chat[]>([]);
  const [filter, setFilter] = useState<FilterChannel>("all");
  const [search, setSearch] = useState("");
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [msgMenu, setMsgMenu] = useState<ChatMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChats(loadChats());
  }, []);

  const persist = (next: Chat[]) => {
    setChats(next);
    saveChats(next);
  };

  const filtered = useMemo(() => {
    let list = filter === "all" ? chats : chats.filter((c) => c.channel === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.contact_name.toLowerCase().includes(q) ||
          c.contact_handle.toLowerCase().includes(q) ||
          c.contact_phone.includes(q) ||
          c.messages.some((m) => m.text.toLowerCase().includes(q))
      );
    }
    return list.sort(
      (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    );
  }, [chats, filter, search]);

  const totalUnread = getTotalUnread(chats);

  const openChat = (chat: Chat) => {
    haptic("tap");
    if (chat.unread_count > 0) {
      const next = chats.map((c) =>
        c.id === chat.id ? { ...c, unread_count: 0 } : c
      );
      persist(next);
      setActiveChat({ ...chat, unread_count: 0 });
    } else {
      setActiveChat(chat);
    }
    setReplyTo(null);
    setMsgMenu(null);
  };

  // Scroll to bottom when opening chat or sending message
  useEffect(() => {
    if (activeChat) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [activeChat?.messages.length, activeChat?.id]);

  const sendMessage = (photoData?: string) => {
    if (!activeChat || (!draft.trim() && !photoData)) return;
    haptic("tap");
    const msg: ChatMessage = {
      id: generateId("msg"),
      direction: "out",
      text: draft.trim(),
      photo: photoData,
      reply_to_id: replyTo?.id,
      status: "delivered",
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
    setReplyTo(null);
  };

  const deleteMessage = (msgId: string) => {
    if (!activeChat) return;
    haptic("warning");
    const updated = {
      ...activeChat,
      messages: activeChat.messages.filter((m) => m.id !== msgId),
    };
    setActiveChat(updated);
    persist(chats.map((c) => (c.id === updated.id ? updated : c)));
    setMsgMenu(null);
  };

  const copyMessage = (text: string) => {
    navigator.clipboard?.writeText(text);
    haptic("success");
    setMsgMenu(null);
  };

  const createClientFromChat = (chat: Chat) => {
    haptic("success");
    const newClient = createBlankClient({
      full_name: chat.contact_name || "Новый клиент",
      phone: chat.contact_phone,
      telegram_username:
        chat.channel === "telegram" ? chat.contact_handle.replace("@", "") : "",
      instagram_username:
        chat.channel === "instagram" ? chat.contact_handle.replace("@", "") : "",
    });
    upsertClient(newClient);
    const updated = { ...chat, client_id: newClient.id };
    if (activeChat?.id === chat.id) setActiveChat(updated);
    persist(chats.map((c) => (c.id === chat.id ? updated : c)));
  };

  const handlePhotoAttach = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => sendMessage(reader.result as string);
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // ─── CHAT DETAIL VIEW ──────────────────────────────────────────────
  if (activeChat) {
    const linkedClient = activeChat.client_id
      ? clients.find((c) => c.id === activeChat.client_id) ?? null
      : null;

    // Group messages by date for Telegram-style date separators
    const groupedMessages: { date: string; messages: ChatMessage[] }[] = [];
    for (const msg of activeChat.messages) {
      const dateKey = msg.timestamp.slice(0, 10);
      const last = groupedMessages[groupedMessages.length - 1];
      if (last && last.date === dateKey) {
        last.messages.push(msg);
      } else {
        groupedMessages.push({ date: dateKey, messages: [msg] });
      }
    }

    return (
      <>
        {/* Header */}
        <div className="flex-shrink-0 bg-violet-600 z-30">
          <div className="px-2 py-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setActiveChat(null); setReplyTo(null); setMsgMenu(null); }}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-white active:bg-white/10"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ backgroundColor: CHANNEL_COLORS[activeChat.channel] }}
            >
              {(activeChat.contact_name || "?").charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-white truncate">
                {activeChat.contact_name || activeChat.contact_handle || "Чат"}
              </div>
              <div className="text-[11px] text-violet-200 truncate">
                {linkedClient ? `Клиент · ${CHANNEL_LABELS[activeChat.channel]}` :
                  activeChat.last_seen
                    ? `был(а) ${formatTimeAgo(activeChat.last_seen)}`
                    : CHANNEL_LABELS[activeChat.channel]
                }
                {activeChat.contact_handle && ` · ${activeChat.contact_handle}`}
              </div>
            </div>

            {/* Create client button */}
            {!linkedClient && (
              <button
                type="button"
                onClick={() => createClientFromChat(activeChat)}
                className="w-10 h-10 flex items-center justify-center rounded-xl text-white active:bg-white/10"
                title="Создать клиента"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Messages area */}
          <div
            className="flex-1 overflow-y-auto px-3 py-3 space-y-1"
            style={{
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e5e7eb' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
              backgroundColor: "#f3f4f6",
            }}
          >
            {groupedMessages.map((group) => (
              <div key={group.date}>
                {/* Date separator */}
                <div className="flex justify-center my-3">
                  <span className="px-3 py-1 rounded-full bg-white/80 backdrop-blur-sm text-[11px] font-medium text-gray-500 shadow-sm">
                    {formatDateLabel(group.date)}
                  </span>
                </div>

                {group.messages.map((msg, idx) => {
                  const isOut = msg.direction === "out";
                  // Group consecutive messages from same direction
                  const prevSame = idx > 0 && group.messages[idx - 1].direction === msg.direction;
                  const replyMsg = msg.reply_to_id
                    ? activeChat.messages.find((m) => m.id === msg.reply_to_id)
                    : null;

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOut ? "justify-end" : "justify-start"} ${prevSame ? "mt-0.5" : "mt-2"}`}
                    >
                      <div
                        className={`relative max-w-[80%] px-3 py-1.5 text-[14px] leading-relaxed ${
                          isOut
                            ? "bg-violet-500 text-white rounded-2xl rounded-br-md"
                            : "bg-white text-gray-900 rounded-2xl rounded-bl-md shadow-sm"
                        }`}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          haptic("select");
                          setMsgMenu(msg);
                        }}
                        onClick={() => {
                          if (msgMenu) setMsgMenu(null);
                        }}
                      >
                        {/* Reply reference */}
                        {replyMsg && (
                          <div
                            className={`mb-1 px-2 py-1 rounded-md text-[11px] border-l-2 ${
                              isOut
                                ? "bg-violet-400/40 border-white/60 text-violet-100"
                                : "bg-gray-100 border-violet-400 text-gray-600"
                            }`}
                          >
                            {replyMsg.text.slice(0, 60)}{replyMsg.text.length > 60 ? "..." : ""}
                          </div>
                        )}

                        {/* Photo */}
                        {msg.photo && (
                          <img
                            src={msg.photo}
                            alt=""
                            className="rounded-lg mb-1 max-w-full max-h-[200px] object-cover"
                          />
                        )}

                        {msg.text && <span>{msg.text}</span>}

                        {/* Time + read status */}
                        <span
                          className={`inline-flex items-center gap-1 ml-2 text-[10px] align-bottom float-right mt-1 ${
                            isOut ? "text-violet-200" : "text-gray-400"
                          }`}
                        >
                          {new Date(msg.timestamp).toLocaleTimeString("ru-RU", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {isOut && msg.status && (
                            <svg width="16" height="10" viewBox="0 0 16 10" fill="none" className="inline">
                              {msg.status === "read" ? (
                                <>
                                  <path d="M1 5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  <path d="M5 5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </>
                              ) : msg.status === "delivered" ? (
                                <>
                                  <path d="M1 5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  <path d="M5 5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </>
                              ) : (
                                <path d="M2 5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              )}
                            </svg>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Message context menu */}
          {msgMenu && (
            <div
              className="fixed inset-0 z-[80]"
              onClick={() => setMsgMenu(null)}
            >
              <div
                className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden min-w-[180px]"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => { setReplyTo(msgMenu); setMsgMenu(null); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[14px] text-gray-900 active:bg-gray-50"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 17 4 12 9 7" />
                    <path d="M20 18v-2a4 4 0 00-4-4H4" />
                  </svg>
                  Ответить
                </button>
                <button
                  type="button"
                  onClick={() => copyMessage(msgMenu.text)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[14px] text-gray-900 active:bg-gray-50 border-t border-gray-100"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  Копировать
                </button>
                <button
                  type="button"
                  onClick={() => deleteMessage(msgMenu.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[14px] text-red-600 active:bg-red-50 border-t border-gray-100"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6" />
                  </svg>
                  Удалить
                </button>
              </div>
            </div>
          )}

          {/* Reply bar */}
          {replyTo && (
            <div className="flex-shrink-0 px-3 py-2 bg-gray-50 border-t border-gray-200 flex items-center gap-2">
              <div className="flex-1 min-w-0 border-l-2 border-violet-500 pl-2">
                <div className="text-[11px] font-semibold text-violet-600">Ответ</div>
                <div className="text-[12px] text-gray-600 truncate">{replyTo.text}</div>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="w-8 h-8 flex items-center justify-center text-gray-400"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}

          {/* Input bar */}
          <div className="flex-shrink-0 border-t border-gray-200 bg-white px-2 py-2 flex items-end gap-1.5">
            <button
              type="button"
              onClick={handlePhotoAttach}
              className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 active:bg-gray-100 flex-shrink-0"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </button>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Сообщение..."
              className="flex-1 min-h-[40px] px-4 rounded-full bg-gray-100 text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            {draft.trim() ? (
              <button
                type="button"
                onClick={() => sendMessage()}
                className="w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center active:scale-95 flex-shrink-0"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                className="w-10 h-10 rounded-full text-gray-400 flex items-center justify-center active:bg-gray-100 flex-shrink-0"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </>
    );
  }

  // ─── CHAT LIST VIEW ────────────────────────────────────────────────
  return (
    <>
      <PageHeader title={`Чаты${totalUnread > 0 ? ` (${totalUnread})` : ""}`} />

      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-3xl mx-auto">
          {/* Search */}
          <div className="px-3 py-2">
            <div className="relative">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск..."
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-gray-100 text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          {/* Channel filter */}
          <div className="flex gap-1.5 px-3 pb-2 overflow-x-auto scrollbar-hide">
            {(["all", "whatsapp", "instagram", "telegram", "sms"] as FilterChannel[]).map((ch) => {
              const label = ch === "all" ? "Все" : CHANNEL_LABELS[ch as ChatChannel];
              const count = ch === "all" ? chats.length : chats.filter((c) => c.channel === ch).length;
              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setFilter(ch)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition ${
                    filter === ch
                      ? "bg-violet-600 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>

          {/* Conversations */}
          <div>
            {filtered.map((chat) => {
              const lastMsg = chat.messages[chat.messages.length - 1];
              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => openChat(chat)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50 border-b border-gray-100"
                >
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-[15px]"
                      style={{ backgroundColor: CHANNEL_COLORS[chat.channel] }}
                    >
                      {(chat.contact_name || "?").charAt(0).toUpperCase()}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[15px] font-semibold text-gray-900 truncate">
                        {chat.contact_name || chat.contact_handle || "Без имени"}
                      </span>
                      <span className={`text-[11px] flex-shrink-0 ${chat.unread_count > 0 ? "text-violet-600 font-semibold" : "text-gray-400"}`}>
                        {formatTimeAgo(chat.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-[13px] text-gray-500 truncate">
                        {lastMsg?.direction === "out" && (
                          <span className="text-gray-400">Вы: </span>
                        )}
                        {lastMsg?.text || "Нет сообщений"}
                      </span>
                      {chat.unread_count > 0 && (
                        <span className="flex-shrink-0 min-w-[20px] h-[20px] rounded-full bg-violet-600 text-white text-[11px] font-bold flex items-center justify-center px-1">
                          {chat.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                <div className="text-[14px] font-medium text-gray-500">Нет чатов</div>
                <div className="text-[12px] text-gray-400">Сообщения появятся здесь</div>
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
  if (mins < 60) return `${mins} мин`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "вчера";
  return `${days} д`;
}

function formatDateLabel(dateKey: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateKey === today) return "Сегодня";
  if (dateKey === yesterday) return "Вчера";
  const [y, m, d] = dateKey.split("-").map(Number);
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  return `${d} ${months[m - 1]}`;
}
