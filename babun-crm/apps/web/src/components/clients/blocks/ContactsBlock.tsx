"use client";

// STORY-034 — Contacts block.  All phones (primary + extras with
// optional name like "Жена · Мария") and messengers (Telegram /
// Instagram / WhatsApp).  Editable inline.  Compact — most of the
// dispatcher's day-to-day comm lives in the Hero quick actions, this
// block is for record-keeping.

import { Phone as PhoneIcon, Send, Plus, X } from "lucide-react";
import type { Client, PhoneEntry } from "@babun/shared/local/clients";
import { generateId } from "@babun/shared/local/masters";
import {
  whatsappUrl,
  telegramUrl,
  instagramUrl,
} from "@babun/shared/common/utils/messenger-links";
import ClientCard from "../ClientCard";
import { haptic } from "@/lib/haptics";

interface ContactsBlockProps {
  client: Client;
  onUpdate: (next: Client) => void;
}

export default function ContactsBlock({
  client,
  onUpdate,
}: ContactsBlockProps) {
  const updatePhone = (value: string) =>
    onUpdate({ ...client, phone: value });

  const addExtra = () => {
    haptic("tap");
    const next: PhoneEntry = {
      id: generateId("phone"),
      number: "",
      name: "",
      label: "Доп.",
    };
    onUpdate({ ...client, phones: [...(client.phones ?? []), next] });
  };

  const updateExtra = (id: string, patch: Partial<PhoneEntry>) =>
    onUpdate({
      ...client,
      phones: (client.phones ?? []).map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    });

  const removeExtra = (id: string) => {
    haptic("warning");
    onUpdate({
      ...client,
      phones: (client.phones ?? []).filter((p) => p.id !== id),
    });
  };

  const tg = client.telegram_username.replace(/^@/, "");
  const ig = client.instagram_username.replace(/^@/, "");
  const waDigits = (client.whatsapp_phone || "").replace(/\D/g, "");

  return (
    <ClientCard kind="contacts" title="Контакты">
      <div className="px-3 py-3 space-y-3">
        {/* Primary phone */}
        <Field label="Основной телефон">
          <input
            type="tel"
            value={client.phone}
            onChange={(e) => updatePhone(e.target.value)}
            placeholder="+357 99 ..."
            className="flex-1 h-8 px-2 text-[13px] tabular-nums bg-[var(--fill-tertiary)] border border-transparent rounded-md focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
          />
        </Field>

        {/* Extra phones (wife / work / WhatsApp on different number) */}
        {(client.phones ?? []).map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <input
              type="text"
              value={p.name ?? ""}
              onChange={(e) => updateExtra(p.id, { name: e.target.value })}
              placeholder="Жена"
              className="w-20 h-8 px-2 text-[12px] bg-[var(--fill-tertiary)] border border-transparent rounded-md focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
            />
            <input
              type="tel"
              value={p.number}
              onChange={(e) => updateExtra(p.id, { number: e.target.value })}
              placeholder="+357 ..."
              className="flex-1 h-8 px-2 text-[13px] tabular-nums bg-[var(--fill-tertiary)] border border-transparent rounded-md focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
            />
            <button
              type="button"
              onClick={() => removeExtra(p.id)}
              aria-label="Удалить"
              className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--label-tertiary)] active:text-[var(--system-red)]"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addExtra}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)] active:opacity-70"
        >
          <Plus size={12} strokeWidth={2.5} />
          Добавить номер
        </button>

        <div className="border-t border-[var(--separator)] pt-3 space-y-2">
          {/* Messengers — handle/phone fields, with launch buttons */}
          <Messenger
            label="Telegram"
            placeholder="@username"
            value={client.telegram_username}
            onChange={(v) => onUpdate({ ...client, telegram_username: v })}
            href={telegramUrl(tg, client.phone)}
            icon={<Send size={12} strokeWidth={2.2} />}
            tone="bg-[rgba(62,136,247,0.10)] text-[var(--system-blue)]"
          />
          <Messenger
            label="Instagram"
            placeholder="@username"
            value={client.instagram_username}
            onChange={(v) => onUpdate({ ...client, instagram_username: v })}
            href={instagramUrl(ig)}
            icon={<Send size={12} strokeWidth={2.2} />}
            tone="bg-[rgba(236,64,122,0.10)] text-[#EC407A]"
          />
          <Messenger
            label="WhatsApp"
            placeholder="отдельный номер для WA"
            value={client.whatsapp_phone}
            onChange={(v) => onUpdate({ ...client, whatsapp_phone: v })}
            href={
              waDigits
                ? whatsappUrl(client.whatsapp_phone)
                : whatsappUrl(client.phone)
            }
            icon={<PhoneIcon size={12} strokeWidth={2.2} />}
            tone="bg-[rgba(52,199,89,0.10)] text-[var(--system-green)]"
          />
        </div>
      </div>
    </ClientCard>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-[var(--label-secondary)] w-32 shrink-0">
        {label}
      </span>
      {children}
    </div>
  );
}

function Messenger({
  label,
  placeholder,
  value,
  onChange,
  href,
  icon,
  tone,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  href: string | null;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${tone}`}
        aria-label={label}
      >
        {icon}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 h-8 px-2 text-[13px] bg-[var(--fill-tertiary)] border border-transparent rounded-md focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
      />
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 h-7 px-2.5 rounded-md bg-[var(--surface-card)] border border-[var(--separator)] text-[12px] font-semibold text-[var(--accent)] active:bg-[var(--accent-tint)] flex items-center"
        >
          Открыть
        </a>
      )}
    </div>
  );
}
