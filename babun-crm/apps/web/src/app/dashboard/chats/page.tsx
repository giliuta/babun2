"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useClients, useAppointments } from "@/app/dashboard/layout";
import { createBlankClient, type Client } from "@/lib/clients";
import ClientPanel from "@/components/clients/ClientPanel";
import CreateClientModal from "@/components/clients/CreateClientModal";
import { useMediaQuery } from "@/lib/useMediaQuery";
import {
  type Chat,
  type ChatChannel,
  type ChatMessage,
  type ConversationStatus,
  loadChats,
  saveChats,
  CHANNEL_LABELS,
  CHANNEL_COLORS,
  getTotalUnread,
} from "@/lib/chats";
import { generateId } from "@/lib/masters";
import { haptic } from "@/lib/haptics";
import { QUICK_REPLIES } from "@/lib/quick-replies";
import { pluralizeAC } from "@/lib/pluralize";
import { PROPERTY_LABELS, type PropertyType } from "@/lib/clients";
import SwipeableRow from "@/components/ui/SwipeableRow";

type FilterChannel = ChatChannel | "all" | "unanswered";

export default function ChatsPage() {
  const { clients, upsertClient } = useClients();
  const { appointments } = useAppointments();
  const [showClientPanel, setShowClientPanel] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalTab, setCreateModalTab] = useState<"new" | "existing">("new");
  const isXL = useMediaQuery("(min-width: 1280px)");
  const isLG = useMediaQuery("(min-width: 1024px)");
  const [chats, setChats] = useState<Chat[]>([]);
  const [filter, setFilter] = useState<FilterChannel>("all");
  const [search, setSearch] = useState("");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [msgMenu, setMsgMenu] = useState<ChatMessage | null>(null);
  const [headerMenu, setHeaderMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChats(loadChats());
  }, []);

  const persist = (next: Chat[]) => {
    setChats(next);
    saveChats(next);
  };

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) ?? null,
    [chats, activeChatId]
  );

  const isUnanswered = (c: Chat) => {
    const last = c.messages[c.messages.length - 1];
    return last?.direction === "in" && c.status !== "closed" && c.status !== "archived";
  };

  const unansweredCount = chats.filter(isUnanswered).length;

  const filtered = useMemo(() => {
    let list: Chat[];
    if (filter === "unanswered") {
      list = chats.filter(isUnanswered);
    } else if (filter === "all") {
      list = chats;
    } else {
      list = chats.filter((c) => c.channel === filter);
    }
    list = list.filter((c) => c.status !== "archived");
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
    return list.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });
  }, [chats, filter, search]);

  const totalUnread = getTotalUnread(chats);

  const openChat = (chat: Chat) => {
    haptic("tap");
    if (chat.unread_count > 0) {
      persist(chats.map((c) => c.id === chat.id ? { ...c, unread_count: 0, status: c.status === "new" ? "active" as ConversationStatus : c.status } : c));
    }
    setActiveChatId(chat.id);
    setReplyTo(null);
    setMsgMenu(null);
    setHeaderMenu(false);
  };

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
      status: "active",
    };
    persist(chats.map((c) => (c.id === updated.id ? updated : c)));
    setDraft("");
    setReplyTo(null);
  };

  const deleteMessage = (msgId: string) => {
    if (!activeChat) return;
    haptic("warning");
    const updated = { ...activeChat, messages: activeChat.messages.filter((m) => m.id !== msgId) };
    persist(chats.map((c) => (c.id === updated.id ? updated : c)));
    setMsgMenu(null);
  };

  const copyMessage = (text: string) => {
    navigator.clipboard?.writeText(text);
    haptic("success");
    setMsgMenu(null);
  };

  const togglePin = (chatId: string) => {
    haptic("tap");
    persist(chats.map((c) => c.id === chatId ? { ...c, is_pinned: !c.is_pinned } : c));
  };

  const archiveChat = (chatId: string) => {
    haptic("tap");
    persist(chats.map((c) => c.id === chatId ? { ...c, status: "archived" as ConversationStatus } : c));
    if (activeChatId === chatId) setActiveChatId(null);
  };

  const closeChat = (chatId: string) => {
    haptic("tap");
    persist(chats.map((c) => c.id === chatId ? { ...c, status: "closed" as ConversationStatus } : c));
    setHeaderMenu(false);
  };

  const openCreateModal = (tab: "new" | "existing" = "new") => {
    setCreateModalTab(tab);
    setShowCreateModal(true);
  };

  const handleClientCreated = (newClient: Client) => {
    upsertClient(newClient);
    if (activeChat) {
      persist(chats.map((c) => c.id === activeChat.id ? { ...c, client_id: newClient.id } : c));
      setShowClientPanel(true);
    }
  };

  const handleClientLinked = (clientId: string) => {
    if (activeChat) {
      persist(chats.map((c) => c.id === activeChat.id ? { ...c, client_id: clientId } : c));
      setShowClientPanel(true);
    }
  };

  // Auto-open client panel on xl+ when chat has linked client
  useEffect(() => {
    if (isXL && activeChat?.client_id) {
      setShowClientPanel(true);
    }
  }, [isXL, activeChat?.client_id]);

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

  // ─── RENDERS ──────────────────────────────────────────────────────

  const chatListEl = (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex-shrink-0 bg-violet-600 px-3 py-3">
        <div className="text-[17px] font-semibold text-white tracking-tight">
          Чаты{totalUnread > 0 && <span className="text-violet-200 font-normal"> ({totalUnread})</span>}
        </div>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 px-3 py-2 bg-white border-b border-gray-100">
        <div className="relative">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
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

      {/* Filters */}
      <div className="flex-shrink-0 flex gap-1.5 px-3 py-2 overflow-x-auto scrollbar-hide border-b border-gray-100">
        {(["all", "unanswered", "whatsapp", "instagram", "telegram", "sms"] as FilterChannel[]).map((ch) => {
          const label = ch === "all" ? "Все" : ch === "unanswered" ? "⏳ Без ответа" : CHANNEL_LABELS[ch as ChatChannel];
          const count = ch === "all" ? chats.filter((c) => c.status !== "archived").length
            : ch === "unanswered" ? unansweredCount
            : chats.filter((c) => c.channel === ch && c.status !== "archived").length;
          const isOrange = ch === "unanswered" && filter === ch;
          return (
            <button key={ch} type="button" onClick={() => setFilter(ch)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition ${
                filter === ch
                  ? isOrange ? "bg-orange-500 text-white" : "bg-violet-600 text-white"
                  : ch === "unanswered" && count > 0 ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"
              }`}
            >{label} ({count})</button>
          );
        })}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((chat) => {
          const lastMsg = chat.messages[chat.messages.length - 1];
          const isActive = activeChatId === chat.id;
          return (
            <SwipeableRow
              key={chat.id}
              leftActions={[{ label: chat.is_pinned ? "Открепить" : "Закрепить", color: "bg-blue-500", onSelect: () => togglePin(chat.id) }]}
              rightActions={[
                { label: "Архив", color: "bg-amber-500", onSelect: () => archiveChat(chat.id) },
              ]}
            >
              <button
                type="button"
                onClick={() => openChat(chat)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-100 transition ${
                  isActive ? "bg-violet-50" : "active:bg-gray-50"
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-[15px]"
                    style={{ backgroundColor: CHANNEL_COLORS[chat.channel] }}
                  >
                    {(chat.contact_name || "?").charAt(0).toUpperCase()}
                  </div>
                  {/* Channel icon badge */}
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center"
                    style={{ backgroundColor: CHANNEL_COLORS[chat.channel] }}
                  >
                    <ChannelIcon channel={chat.channel} size={10} />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 min-w-0">
                      {chat.is_pinned && <span className="text-[11px]">📌</span>}
                      <span className="text-[15px] font-semibold text-gray-900 truncate">
                        {chat.contact_name || chat.contact_handle || "Без имени"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <WaitingBadge chat={chat} />
                      <span className={`text-[11px] ${chat.unread_count > 0 ? "text-green-600 font-semibold" : "text-gray-400"}`}>
                        {formatTimeAgo(chat.last_message_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-[13px] text-gray-500 truncate">
                      {lastMsg?.direction === "out" && <span className="text-gray-400">Вы: </span>}
                      {lastMsg?.photo ? "📷 Фото" : lastMsg?.text || "Нет сообщений"}
                    </span>
                    {chat.unread_count > 0 && (
                      <span className="flex-shrink-0 min-w-[20px] h-[20px] rounded-full bg-green-500 text-white text-[11px] font-bold flex items-center justify-center px-1">
                        {chat.unread_count}
                      </span>
                    )}
                  </div>
                  {chat.client_id && (() => {
                    const cl = clients.find((c) => c.id === chat.client_id);
                    if (!cl) return <div className="text-[10px] text-green-600 font-medium mt-0.5">✓ Клиент привязан</div>;
                    const parts = [cl.city, cl.property_type ? PROPERTY_LABELS[cl.property_type as PropertyType] : null];
                    if (cl.equipment.length > 0) parts.push(pluralizeAC(cl.equipment.length));
                    return (
                      <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                        ✓ {parts.filter(Boolean).join(" · ")}
                      </div>
                    );
                  })()}
                </div>
              </button>
            </SwipeableRow>
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
  );

  const chatViewEl = activeChat ? (
    <ChatDetailView
      chat={activeChat}
      clients={clients}
      replyTo={replyTo}
      setReplyTo={setReplyTo}
      msgMenu={msgMenu}
      setMsgMenu={setMsgMenu}
      headerMenu={headerMenu}
      setHeaderMenu={setHeaderMenu}
      draft={draft}
      setDraft={setDraft}
      messagesEndRef={messagesEndRef}
      onBack={() => { setActiveChatId(null); setReplyTo(null); setMsgMenu(null); setHeaderMenu(false); }}
      onSend={sendMessage}
      onPhotoAttach={handlePhotoAttach}
      onDeleteMessage={deleteMessage}
      onCopyMessage={copyMessage}
      onTogglePin={() => togglePin(activeChat.id)}
      onArchive={() => archiveChat(activeChat.id)}
      onClose={() => closeChat(activeChat.id)}
      onCreateClient={() => openCreateModal("new")}
      onTogglePanel={() => setShowClientPanel((s) => !s)}
    />
  ) : (
    <div className="hidden lg:flex flex-1 items-center justify-center bg-gray-50">
      <div className="text-center text-gray-400">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="mx-auto mb-3">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        <div className="text-[15px] font-medium">Выберите чат</div>
      </div>
    </div>
  );

  // Linked client for the active chat
  const linkedClient = activeChat?.client_id
    ? clients.find((c) => c.id === activeChat.client_id) ?? null
    : null;

  // Desktop: split view. Mobile: stack.
  return (
    <div className="flex h-full">
      {/* List — always visible on desktop, hidden when chat open on mobile */}
      <div className={`${activeChatId ? "hidden lg:flex" : "flex"} flex-col w-full lg:w-[360px] lg:flex-shrink-0 lg:border-r lg:border-gray-200 h-full`}>
        {chatListEl}
      </div>
      {/* Chat — takes full width on mobile, flex on desktop */}
      <div className={`${activeChatId ? "flex" : "hidden lg:flex"} flex-col flex-1 h-full min-w-0`}>
        {chatViewEl}
      </div>
      {/* Client panel — desktop only, slide-in right */}
      {showClientPanel && linkedClient && isLG && (
        <div className="hidden lg:flex flex-col w-[340px] flex-shrink-0 h-full animate-fade-in-up">
          <ClientPanel
            client={linkedClient}
            appointments={appointments}
            onUpdate={(updated: Client) => upsertClient(updated)}
            onClose={() => setShowClientPanel(false)}
          />
        </div>
      )}

      {/* Client panel — mobile bottom sheet */}
      {showClientPanel && linkedClient && !isLG && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowClientPanel(false)} />
          <div className="absolute bottom-0 left-0 right-0 h-[85vh] bg-white rounded-t-2xl overflow-hidden animate-fade-in-up">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 mb-1" />
            <div className="h-full overflow-y-auto" style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}>
              <ClientPanel
                client={linkedClient}
                appointments={appointments}
                onUpdate={(updated: Client) => upsertClient(updated)}
                onClose={() => setShowClientPanel(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Empty state for panel when no client linked — desktop xl+ */}
      {showClientPanel && !linkedClient && isLG && (
        <div className="hidden lg:flex flex-col w-[340px] flex-shrink-0 h-full bg-white border-l border-gray-200 items-center justify-center text-center p-6">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300 mb-3">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <div className="text-[15px] font-medium text-gray-600 mb-1">Клиент не привязан</div>
          <div className="text-[12px] text-gray-400 mb-4">Привяжите существующего или создайте нового</div>
          <div className="flex flex-col gap-2 w-full">
            <button
              type="button"
              onClick={() => openCreateModal("existing")}
              className="h-10 rounded-lg border border-gray-200 text-[13px] font-medium text-gray-700 active:bg-gray-50"
            >
              Найти клиента
            </button>
            <button
              type="button"
              onClick={() => openCreateModal("new")}
              className="h-10 rounded-lg bg-violet-600 text-white text-[13px] font-semibold active:scale-[0.98]"
            >
              + Создать нового
            </button>
          </div>
        </div>
      )}

      {/* Create/link client modal */}
      <CreateClientModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        clients={clients}
        prefillName={activeChat?.contact_name ?? ""}
        prefillPhone={
          activeChat && (activeChat.channel === "whatsapp" || activeChat.channel === "sms")
            ? activeChat.contact_phone
            : ""
        }
        initialTab={createModalTab}
        onCreate={handleClientCreated}
        onLink={handleClientLinked}
      />
    </div>
  );
}

// ─── CHAT DETAIL VIEW ──────────────────────────────────────────────

function ChatDetailView({
  chat, clients, replyTo, setReplyTo, msgMenu, setMsgMenu,
  headerMenu, setHeaderMenu, draft, setDraft, messagesEndRef,
  onBack, onSend, onPhotoAttach, onDeleteMessage, onCopyMessage,
  onTogglePin, onArchive, onClose, onCreateClient, onTogglePanel,
}: {
  chat: Chat;
  clients: { id: string; full_name: string }[];
  replyTo: ChatMessage | null;
  setReplyTo: (m: ChatMessage | null) => void;
  msgMenu: ChatMessage | null;
  setMsgMenu: (m: ChatMessage | null) => void;
  headerMenu: boolean;
  setHeaderMenu: (v: boolean) => void;
  draft: string;
  setDraft: (v: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onBack: () => void;
  onSend: (photo?: string) => void;
  onPhotoAttach: () => void;
  onDeleteMessage: (id: string) => void;
  onCopyMessage: (text: string) => void;
  onTogglePin: () => void;
  onArchive: () => void;
  onClose: () => void;
  onCreateClient: () => void;
  onTogglePanel: () => void;
}) {
  const linkedClient = chat.client_id ? clients.find((c) => c.id === chat.client_id) ?? null : null;
  const [showQR, setShowQR] = useState(false);

  const groupedMessages: { date: string; messages: ChatMessage[] }[] = [];
  for (const msg of chat.messages) {
    const dateKey = msg.timestamp.slice(0, 10);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === dateKey) last.messages.push(msg);
    else groupedMessages.push({ date: dateKey, messages: [msg] });
  }

  return (
    <>
      {/* Header */}
      <div className="flex-shrink-0 bg-violet-600 z-30 relative">
        <div className="px-2 py-2 flex items-center gap-2">
          <button type="button" onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-xl text-white active:bg-white/10 lg:hidden">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button type="button" onClick={onTogglePanel} className="flex items-center gap-2 flex-1 min-w-0 active:opacity-80">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ backgroundColor: CHANNEL_COLORS[chat.channel] }}>
              {(chat.contact_name || "?").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-[14px] font-semibold text-white truncate">{chat.contact_name || chat.contact_handle || "Чат"}</div>
              <div className="text-[11px] text-violet-200 truncate">
                {chat.last_seen ? `был(а) ${formatTimeAgo(chat.last_seen)}` : CHANNEL_LABELS[chat.channel]}
                {chat.contact_handle && ` · ${chat.contact_handle}`}
              </div>
            </div>
          </button>
          <button type="button" onClick={() => setHeaderMenu(!headerMenu)} className="w-10 h-10 flex items-center justify-center rounded-xl text-white active:bg-white/10">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </button>
        </div>

        {/* ⋮ Menu */}
        {headerMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setHeaderMenu(false)} />
            <div className="absolute right-2 top-full mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 py-1 z-50 min-w-[200px]">
              <MenuItem label={chat.is_pinned ? "Открепить" : "Закрепить"} onClick={onTogglePin} />
              {linkedClient && <MenuItem label="Открыть карточку" onClick={() => { onTogglePanel(); setHeaderMenu(false); }} />}
              {!linkedClient && <MenuItem label="Создать клиента" onClick={onCreateClient} />}
              <MenuItem label="Закрыть чат" onClick={onClose} />
              <MenuItem label="В архив" onClick={onArchive} />
            </div>
          </>
        )}
      </div>

      {/* Client link banner */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-gray-200" style={{ backgroundColor: linkedClient ? "#f0fdf4" : "#f5f3ff" }}>
        {linkedClient ? (
          <button type="button" onClick={onTogglePanel} className="flex items-center gap-2 text-[12px] text-green-700 active:opacity-80 w-full text-left">
            <span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[9px] font-bold">{linkedClient.full_name.charAt(0)}</span>
            <span className="flex-1">✓ {linkedClient.full_name}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-400"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        ) : (
          <button type="button" onClick={onCreateClient} className="text-[12px] font-semibold text-violet-600">
            + Привязать к клиенту
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1" style={{ backgroundColor: "#efeae2" }}>
          {groupedMessages.map((group) => (
            <div key={group.date}>
              <div className="flex justify-center my-3">
                <span className="px-3 py-1 rounded-full bg-white/80 backdrop-blur-sm text-[11px] font-medium text-gray-500 shadow-sm">
                  {formatDateLabel(group.date)}
                </span>
              </div>
              {group.messages.map((msg, idx) => {
                const isOut = msg.direction === "out";
                const prevSame = idx > 0 && group.messages[idx - 1].direction === msg.direction;
                const replyMsg = msg.reply_to_id ? chat.messages.find((m) => m.id === msg.reply_to_id) : null;
                return (
                  <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"} ${prevSame ? "mt-0.5" : "mt-2"}`}>
                    <div
                      className={`relative max-w-[75%] px-2.5 py-1.5 text-[14px] leading-relaxed ${
                        isOut ? "bg-violet-500 text-white rounded-2xl rounded-br-sm" : "bg-white text-gray-900 rounded-2xl rounded-bl-sm shadow-sm"
                      }`}
                      onContextMenu={(e) => { e.preventDefault(); haptic("select"); setMsgMenu(msg); }}
                    >
                      {replyMsg && (
                        <div className={`mb-1 px-2 py-1 rounded-md text-[11px] border-l-2 ${isOut ? "bg-violet-400/40 border-white/60 text-violet-100" : "bg-gray-100 border-violet-400 text-gray-600"}`}>
                          {replyMsg.text.slice(0, 50)}{replyMsg.text.length > 50 ? "…" : ""}
                        </div>
                      )}
                      {msg.photo && <img src={msg.photo} alt="" className="rounded-lg mb-1 max-w-full max-h-[200px] object-cover" />}
                      {msg.text && <span>{msg.text}</span>}
                      <span className={`inline-flex items-center gap-0.5 ml-2 text-[10px] align-bottom float-right mt-1 ${isOut ? "text-violet-200" : "text-gray-400"}`}>
                        {new Date(msg.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                        {isOut && <StatusChecks status={msg.status} />}
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
          <div className="fixed inset-0 z-[80]" onClick={() => setMsgMenu(null)}>
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden min-w-[180px]" onClick={(e) => e.stopPropagation()}>
              <MenuItem label="Ответить" onClick={() => { setReplyTo(msgMenu); setMsgMenu(null); }} icon="↩" />
              <MenuItem label="Копировать" onClick={() => onCopyMessage(msgMenu.text)} icon="📋" border />
              <MenuItem label="Удалить" onClick={() => onDeleteMessage(msgMenu.id)} icon="🗑" danger border />
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
            <button type="button" onClick={() => setReplyTo(null)} className="w-8 h-8 flex items-center justify-center text-gray-400">✕</button>
          </div>
        )}

        {/* Quick replies sheet */}
        {showQR && (
          <QuickReplySheet
            onSelect={(text) => { setDraft(text); setShowQR(false); }}
            onClose={() => setShowQR(false)}
          />
        )}

        {/* Input */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-white px-2 py-2 flex items-end gap-1.5">
          <button type="button" onClick={onPhotoAttach} className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 active:bg-gray-100 flex-shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
            </svg>
          </button>
          <button type="button" onClick={() => setShowQR(true)} className="w-10 h-10 flex items-center justify-center rounded-full text-amber-500 active:bg-amber-50 flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </button>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            placeholder="Сообщение..."
            className="flex-1 min-h-[40px] px-4 rounded-full bg-gray-100 text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          {draft.trim() ? (
            <button type="button" onClick={() => onSend()} className="w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center active:scale-95 flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
            </button>
          ) : (
            <button type="button" className="w-10 h-10 rounded-full text-gray-400 flex items-center justify-center flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── SMALL COMPONENTS ──────────────────────────────────────────────

function StatusChecks({ status }: { status?: string }) {
  if (!status) return null;
  const color = status === "read" ? "text-sky-300" : "currentColor";
  return (
    <svg width="16" height="10" viewBox="0 0 16 10" fill="none" className={`inline ${color}`}>
      <path d="M1.5 5l2.5 2.5L11 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      {(status === "delivered" || status === "read") && (
        <path d="M5 5l2.5 2.5L14.5 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function ChannelIcon({ channel, size = 10 }: { channel: ChatChannel; size?: number }) {
  if (channel === "whatsapp") return <svg width={size} height={size} viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.875 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>;
  if (channel === "telegram") return <svg width={size} height={size} viewBox="0 0 24 24" fill="white"><path d="M9.417 15.181l-.397 5.584c.568 0 .814-.244 1.109-.537l2.663-2.545 5.518 4.041c1.012.564 1.725.267 1.998-.931L23.93 3.821c.321-1.496-.541-2.081-1.527-1.714L1.114 10.247c-1.462.568-1.44 1.384-.249 1.752l5.535 1.723 12.856-8.09c.605-.402 1.155-.179.703.223z"/></svg>;
  if (channel === "instagram") return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><rect x="2" y="2" width="20" height="20" rx="5"/></svg>;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
}

function MenuItem({ label, onClick, icon, danger, border }: { label: string; onClick: () => void; icon?: string; danger?: boolean; border?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-[14px] active:bg-gray-50 ${border ? "border-t border-gray-100" : ""} ${danger ? "text-red-600" : "text-gray-900"}`}
    >
      {icon && <span className="text-[16px]">{icon}</span>}
      {label}
    </button>
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
  const [, m, d] = dateKey.split("-").map(Number);
  const months = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
  return `${d} ${months[m - 1]}`;
}

// ─── WAITING BADGE ────────────────────────────────────────────────
// Shows elapsed time since the client's last unanswered message.
// Color escalates: gray < 30m, orange 30m–4h, red > 4h.

function WaitingBadge({ chat }: { chat: Chat }) {
  const last = chat.messages[chat.messages.length - 1];
  if (!last || last.direction !== "in" || chat.status === "closed" || chat.status === "archived") return null;

  const diff = Date.now() - new Date(last.timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 30) return null;

  const label = mins < 60 ? `${mins}м` : mins < 1440 ? `${Math.floor(mins / 60)}ч` : `${Math.floor(mins / 1440)}д`;
  const color = mins > 240 ? "text-red-500 font-bold" : mins > 60 ? "text-orange-500" : "text-gray-400";

  return (
    <span className={`text-[10px] tabular-nums ${color}`}>⏱ {label}</span>
  );
}

// ─── QUICK REPLY SHEET ────────────────────────────────────────────

function QuickReplySheet({
  onSelect,
  onClose,
}: {
  onSelect: (text: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () =>
      QUICK_REPLIES.filter(
        (r) =>
          !search.trim() ||
          r.title.toLowerCase().includes(search.toLowerCase()) ||
          r.text.toLowerCase().includes(search.toLowerCase())
      ),
    [search]
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center lg:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full lg:max-w-md bg-white rounded-t-2xl lg:rounded-2xl max-h-[70vh] flex flex-col overflow-hidden">
        <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 mb-1 lg:hidden" />
        <div className="px-4 pt-2 pb-3 border-b border-gray-100">
          <div className="text-[15px] font-semibold text-gray-900 mb-2">Быстрые ответы</div>
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск шаблона..."
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-gray-100 text-[14px] placeholder-gray-400 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelect(r.text)}
              className="w-full text-left px-4 py-3 border-b border-gray-100 active:bg-gray-50"
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[15px]">{r.emoji}</span>
                <span className="text-[14px] font-medium text-gray-900">{r.title}</span>
              </div>
              <div className="text-[13px] text-gray-500 leading-snug line-clamp-2 pl-7">
                {r.text}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-gray-400 py-8 text-[13px]">Не найдено</div>
          )}
        </div>
      </div>
    </div>
  );
}
