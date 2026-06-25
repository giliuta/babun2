// ContactsBlock — mobile port of the web client-card Contacts block
// (apps/web/src/components/clients/blocks/ContactsBlock.tsx).
//
// Primary phone + extra phones (each with an optional name like
// «Жена · Мария») + messengers (Telegram / Instagram / WhatsApp).
// Editable inline. Each phone has a call (tel:) action; each messenger
// has an «Открыть» action via Linking. Presentational: persists via
// `update(patch)`.

import { Linking, Pressable, Text, TextInput, View } from "react-native";
import { Phone as PhoneIcon, Plus, Send, X } from "lucide-react-native";
import type { Client, PhoneEntry } from "@babun/shared/local/clients";
import {
  instagramUrl,
  telegramUrl,
  whatsappUrl,
} from "@babun/shared/common/utils/messenger-links";

interface ContactsBlockProps {
  client: Client;
  update: (patch: Partial<Client>) => void;
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function dialUrl(phone: string): string | null {
  const digits = (phone ?? "").replace(/[^0-9+]/g, "");
  if (digits.replace(/\D/g, "").length < 3) return null;
  return `tel:${digits}`;
}

export default function ContactsBlock({ client, update }: ContactsBlockProps) {
  const extras = client.phones ?? [];

  const addExtra = () => {
    const next: PhoneEntry = {
      id: genId("phone"),
      number: "",
      name: "",
      label: "Доп.",
    };
    update({ phones: [...extras, next] });
  };

  const updateExtra = (id: string, patch: Partial<PhoneEntry>) =>
    update({
      phones: extras.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });

  const removeExtra = (id: string) =>
    update({ phones: extras.filter((p) => p.id !== id) });

  const tg = (client.telegram_username || "").replace(/^@/, "");
  const ig = (client.instagram_username || "").replace(/^@/, "");
  const waDigits = (client.whatsapp_phone || "").replace(/\D/g, "");

  return (
    <View className="mx-3 mt-2 rounded-2xl bg-white p-3 shadow-sm">
      <Text className="px-1 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Контакты
      </Text>

      <View className="gap-3 px-1 pt-1">
        {/* Primary phone */}
        <View className="flex-row items-center gap-2">
          <Text className="w-28 shrink-0 text-xs text-neutral-500">
            Основной телефон
          </Text>
          <TextInput
            value={client.phone}
            onChangeText={(v) => update({ phone: v })}
            placeholder="+357 99 ..."
            placeholderTextColor="#a3a3a3"
            keyboardType="phone-pad"
            className="h-8 flex-1 rounded-md bg-neutral-100 px-2 text-[13px] text-neutral-900"
          />
          {dialUrl(client.phone) ? (
            <Pressable
              onPress={() => Linking.openURL(dialUrl(client.phone) as string)}
              className="h-8 w-8 items-center justify-center rounded-md bg-success/10 active:opacity-70"
            >
              <PhoneIcon color="#10b981" size={14} />
            </Pressable>
          ) : null}
        </View>

        {/* Extra phones (wife / work / WhatsApp on a different number) */}
        {extras.map((p) => (
          <View key={p.id} className="flex-row items-center gap-2">
            <TextInput
              value={p.name ?? ""}
              onChangeText={(v) => updateExtra(p.id, { name: v })}
              placeholder="Жена"
              placeholderTextColor="#a3a3a3"
              className="h-8 w-20 rounded-md bg-neutral-100 px-2 text-[12px] text-neutral-900"
            />
            <TextInput
              value={p.number}
              onChangeText={(v) => updateExtra(p.id, { number: v })}
              placeholder="+357 ..."
              placeholderTextColor="#a3a3a3"
              keyboardType="phone-pad"
              className="h-8 flex-1 rounded-md bg-neutral-100 px-2 text-[13px] text-neutral-900"
            />
            {dialUrl(p.number) ? (
              <Pressable
                onPress={() => Linking.openURL(dialUrl(p.number) as string)}
                className="h-7 w-7 items-center justify-center rounded-md bg-success/10 active:opacity-70"
              >
                <PhoneIcon color="#10b981" size={13} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => removeExtra(p.id)}
              className="h-7 w-7 items-center justify-center rounded-md active:opacity-60"
            >
              <X color="#a3a3a3" size={13} />
            </Pressable>
          </View>
        ))}

        <Pressable
          onPress={addExtra}
          className="flex-row items-center gap-1 self-start active:opacity-70"
        >
          <Plus color="#4f46e5" size={13} />
          <Text className="text-[12px] font-semibold text-brand">
            Добавить номер
          </Text>
        </Pressable>

        {/* Messengers */}
        <View className="gap-2 border-t border-neutral-100 pt-3">
          <Messenger
            label="Telegram"
            placeholder="@username"
            value={client.telegram_username}
            onChange={(v) => update({ telegram_username: v })}
            url={telegramUrl(tg, client.phone)}
            icon={<Send color="#3e88f7" size={13} />}
            tintClass="bg-[#3e88f7]/10"
          />
          <Messenger
            label="Instagram"
            placeholder="@username"
            value={client.instagram_username}
            onChange={(v) => update({ instagram_username: v })}
            url={instagramUrl(ig)}
            icon={<Send color="#ec407a" size={13} />}
            tintClass="bg-[#ec407a]/10"
          />
          <Messenger
            label="WhatsApp"
            placeholder="отдельный номер для WA"
            value={client.whatsapp_phone}
            onChange={(v) => update({ whatsapp_phone: v })}
            url={
              waDigits ? whatsappUrl(client.whatsapp_phone) : whatsappUrl(client.phone)
            }
            icon={<PhoneIcon color="#10b981" size={13} />}
            tintClass="bg-success/10"
          />
        </View>
      </View>
    </View>
  );
}

function Messenger({
  label,
  placeholder,
  value,
  onChange,
  url,
  icon,
  tintClass,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  url: string | null;
  icon: React.ReactNode;
  tintClass: string;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <View
        className={`h-7 w-7 items-center justify-center rounded-full ${tintClass}`}
      >
        {icon}
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#a3a3a3"
        autoCapitalize="none"
        className="h-8 flex-1 rounded-md bg-neutral-100 px-2 text-[13px] text-neutral-900"
      />
      {url ? (
        <Pressable
          onPress={() => Linking.openURL(url)}
          accessibilityLabel={`Открыть ${label}`}
          className="h-7 justify-center rounded-md border border-neutral-100 px-2.5 active:opacity-70"
        >
          <Text className="text-[12px] font-semibold text-brand">Открыть</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
