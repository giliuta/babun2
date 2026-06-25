// Client detail card — COMPOSER (mobile port of the web ClientCardPage).
//
// This screen does ALL data wiring; the blocks are presentational. It
// fetches the client + its appointments, computes the shared `stats`
// (client-stats selector) and `serviceDue` (service-due selector), then
// renders the header, the next-job hero and the configurable blocks in a
// sensible DEFAULT order:
//
//   ClientHeader · ClientNextJob · Objects · Visits · Finance · Contacts
//   · Notes · Personal · Meta
//
// (AttachmentsBlock is intentionally skipped — it needs Supabase Storage.
//  TODO: add an AttachmentsBlock once the appointment-photos / storage
//  path is wired on mobile.)
//
// A top chrome row owns the back button + a ⋯ action menu (message via
// Linking sms:, share via RN Share, blacklist toggle via update) — the
// blocks stay free of screen-level concerns.

import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, MoreHorizontal } from "lucide-react-native";
import type { Client } from "@babun/shared/local/clients";
import { buildStats } from "@babun/shared/local/selectors/client-stats";
import { buildServiceDue } from "@babun/shared/local/selectors/service-due";
import { Screen } from "@/components/ui/Screen";
import { useClient, useUpdateClient } from "@/features/clients/queries";
import { useClientAppointments } from "@/features/clients/appointments";
import ClientHeader from "@/features/clients/ClientHeader";
import ClientNextJob from "@/features/clients/ClientNextJob";
import ObjectsBlock from "@/features/clients/blocks/ObjectsBlock";
import VisitsBlock from "@/features/clients/blocks/VisitsBlock";
import FinanceBlock from "@/features/clients/blocks/FinanceBlock";
import ContactsBlock from "@/features/clients/blocks/ContactsBlock";
import NotesBlock from "@/features/clients/blocks/NotesBlock";
import PersonalBlock from "@/features/clients/blocks/PersonalBlock";
import MetaBlock from "@/features/clients/blocks/MetaBlock";

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: client, isLoading } = useClient(id);
  const updateClient = useUpdateClient(id);
  const { data: appointments = [] } = useClientAppointments(id);

  const [menuOpen, setMenuOpen] = useState(false);

  // Single persist path for every block (mirrors the web blocks' update()).
  const update = (patch: Partial<Client>) => updateClient.mutate(patch);

  if (isLoading) {
    return (
      <Screen className="items-center justify-center">
        <ActivityIndicator />
      </Screen>
    );
  }

  if (!client) {
    return (
      <Screen className="items-center justify-center px-6">
        <Text className="mb-3 text-sm text-neutral-500">Клиент не найден</Text>
        <Pressable
          onPress={() => router.back()}
          className="rounded-xl bg-brand px-4 py-2 active:opacity-80"
        >
          <Text className="font-semibold text-white">← К списку</Text>
        </Pressable>
      </Screen>
    );
  }

  // Shared selectors — port-as-is. buildStats does its own client_id +
  // legacy name fallback when handed the array; buildServiceDue reads the
  // client's locations[].equipment (no appointments).
  const stats = buildStats(client, appointments);
  const serviceDue = buildServiceDue(client);

  const phoneDigits = client.phone?.replace(/\D/g, "") ?? "";

  const onMessage = () => {
    setMenuOpen(false);
    if (phoneDigits) Linking.openURL(`sms:${phoneDigits}`);
  };

  const onShare = async () => {
    setMenuOpen(false);
    const lines = [
      client.full_name || "Клиент",
      client.phone || "",
      client.locations?.find((l) => l.isPrimary)?.address ??
        client.locations?.[0]?.address ??
        "",
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join("\n") });
    } catch {
      // user dismissed the share sheet — no-op.
    }
  };

  const onToggleBlacklist = () => {
    setMenuOpen(false);
    update({ blacklisted: !client.blacklisted });
  };

  return (
    <Screen edges={["top"]}>
      {/* Chrome: back + title + ⋯ menu */}
      <View className="flex-row items-center border-b border-neutral-100 px-2 py-2">
        <Pressable
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-lg active:bg-neutral-100"
          accessibilityLabel="Назад"
        >
          <ChevronLeft color="#404040" size={22} />
        </Pressable>
        <Text className="flex-1 text-base font-semibold text-neutral-900">
          Клиент
        </Text>
        <Pressable
          onPress={() => setMenuOpen((v) => !v)}
          className="h-9 w-9 items-center justify-center rounded-lg active:bg-neutral-100"
          accessibilityLabel="Ещё"
        >
          <MoreHorizontal color="#404040" size={22} />
        </Pressable>
      </View>

      {/* Lightweight action sheet (no extra deps) */}
      {menuOpen ? (
        <>
          <Pressable
            onPress={() => setMenuOpen(false)}
            className="absolute inset-0 z-10"
          />
          <View className="absolute right-3 top-12 z-20 w-52 overflow-hidden rounded-xl bg-white shadow-lg">
            <MenuItem
              label="Написать SMS"
              onPress={onMessage}
              disabled={!phoneDigits}
            />
            <View className="h-px bg-neutral-100" />
            <MenuItem label="Поделиться" onPress={onShare} />
            <View className="h-px bg-neutral-100" />
            <MenuItem
              label={
                client.blacklisted
                  ? "Убрать из чёрного списка"
                  : "В чёрный список"
              }
              onPress={onToggleBlacklist}
              danger={!client.blacklisted}
            />
          </View>
        </>
      ) : null}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <ClientHeader
          client={client}
          appointments={appointments}
          stats={stats}
          update={update}
        />
        <ClientNextJob
          client={client}
          appointments={appointments}
          stats={stats}
          serviceDue={serviceDue}
        />
        <ObjectsBlock
          client={client}
          appointments={appointments}
          update={update}
        />
        <VisitsBlock appointments={appointments} stats={stats} />
        <FinanceBlock appointments={appointments} stats={stats} />
        <ContactsBlock client={client} update={update} />
        <NotesBlock client={client} update={update} />
        <PersonalBlock client={client} update={update} />
        <MetaBlock client={client} update={update} />
      </ScrollView>
    </Screen>
  );
}

function MenuItem({
  label,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`px-4 py-3 active:bg-neutral-50 ${disabled ? "opacity-40" : ""}`}
    >
      <Text
        className={`text-sm font-medium ${danger ? "text-danger" : "text-neutral-900"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
