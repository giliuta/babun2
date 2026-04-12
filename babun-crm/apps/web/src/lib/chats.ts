// Chat / Inbox data model — unified messaging across WhatsApp,
// Instagram, Telegram, and SMS. Stored in localStorage for now;
// will migrate to Supabase with real webhook integrations later.

import { generateId } from "./masters";

export type ChatChannel = "whatsapp" | "instagram" | "telegram" | "sms";

export const CHANNEL_LABELS: Record<ChatChannel, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  telegram: "Telegram",
  sms: "SMS",
};

export const CHANNEL_COLORS: Record<ChatChannel, string> = {
  whatsapp: "#25D366",
  instagram: "#E1306C",
  telegram: "#229ED9",
  sms: "#6b7280",
};

export interface ChatMessage {
  id: string;
  direction: "in" | "out";
  text: string;
  timestamp: string; // ISO
}

export interface Chat {
  id: string;
  channel: ChatChannel;
  contact_name: string;
  contact_phone: string;
  contact_handle: string; // @username for IG/TG
  client_id: string | null; // linked Babun client, null = not yet created
  messages: ChatMessage[];
  unread_count: number;
  last_message_at: string; // ISO
  created_at: string;
}

const STORAGE_KEY = "babun-chats";

export function loadChats(): Chat[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedChats();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seedChats();
  } catch {
    return seedChats();
  }
}

export function saveChats(list: Chat[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function getTotalUnread(chats: Chat[]): number {
  return chats.reduce((sum, c) => sum + c.unread_count, 0);
}

export function createBlankChat(channel: ChatChannel): Chat {
  const now = new Date().toISOString();
  return {
    id: generateId("chat"),
    channel,
    contact_name: "",
    contact_phone: "",
    contact_handle: "",
    client_id: null,
    messages: [],
    unread_count: 0,
    last_message_at: now,
    created_at: now,
  };
}

// Seed data so the page isn't empty on first visit
function seedChats(): Chat[] {
  const now = new Date();
  const ago = (mins: number) => new Date(now.getTime() - mins * 60000).toISOString();

  const chats: Chat[] = [
    {
      id: "chat-1",
      channel: "whatsapp",
      contact_name: "Иванов Алексей",
      contact_phone: "+35799123456",
      contact_handle: "",
      client_id: null,
      messages: [
        { id: "m1", direction: "in", text: "Здравствуйте, хочу записаться на чистку кондиционера", timestamp: ago(120) },
        { id: "m2", direction: "out", text: "Добрый день! Какой адрес? Можем на эту неделю", timestamp: ago(115) },
        { id: "m3", direction: "in", text: "Лимассол, ул. Макариос 45, квартира 3", timestamp: ago(110) },
      ],
      unread_count: 1,
      last_message_at: ago(110),
      created_at: ago(120),
    },
    {
      id: "chat-2",
      channel: "instagram",
      contact_name: "Maria K.",
      contact_phone: "",
      contact_handle: "@maria_k_limassol",
      client_id: null,
      messages: [
        { id: "m4", direction: "in", text: "Hi! Do you service Samsung AC units?", timestamp: ago(300) },
        { id: "m5", direction: "out", text: "Hello! Yes, we service all brands. Where are you located?", timestamp: ago(290) },
      ],
      unread_count: 0,
      last_message_at: ago(290),
      created_at: ago(300),
    },
    {
      id: "chat-3",
      channel: "telegram",
      contact_name: "Петрова Елена",
      contact_phone: "+35796554433",
      contact_handle: "@elena_p",
      client_id: null,
      messages: [
        { id: "m6", direction: "in", text: "Нужна установка 2 кондиционеров в новый офис", timestamp: ago(45) },
      ],
      unread_count: 1,
      last_message_at: ago(45),
      created_at: ago(45),
    },
  ];

  saveChats(chats);
  return chats;
}
