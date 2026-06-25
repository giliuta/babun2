import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Plus, Search } from "lucide-react-native";
import type { Client } from "@babun/shared/local/clients";
import { matchesClient } from "@babun/shared/local/selectors/client-search";
import { Screen } from "@/components/ui/Screen";
import { useClients } from "@/features/clients/queries";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function ClientRow({ client, onPress }: { client: Client; onPress: () => void }) {
  const owes = client.balance < 0;
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3 active:bg-neutral-100"
    >
      <View className="h-11 w-11 items-center justify-center rounded-full bg-brand/10">
        <Text className="text-base font-semibold text-brand">
          {initials(client.full_name)}
        </Text>
      </View>
      <View className="ml-3 flex-1">
        <Text
          className="text-base font-semibold text-neutral-900"
          numberOfLines={1}
        >
          {client.full_name || "Без имени"}
        </Text>
        <Text className="text-sm text-neutral-500" numberOfLines={1}>
          {client.phone}
          {client.city ? ` · ${client.city}` : ""}
        </Text>
      </View>
      {client.balance !== 0 ? (
        <Text
          className={`text-sm font-semibold ${owes ? "text-danger" : "text-success"}`}
        >
          {owes ? "−" : "+"}€{Math.abs(client.balance)}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function ClientsListScreen() {
  const router = useRouter();
  const { data, isLoading, isRefetching, refetch, error } = useClients();
  const [query, setQuery] = useState("");
  const clients = data ?? [];

  const visible = useMemo(() => {
    const sorted = [...clients].sort((a, b) =>
      a.full_name.localeCompare(b.full_name, "ru"),
    );
    const q = query.trim();
    return q ? sorted.filter((c) => matchesClient(c, q)) : sorted;
  }, [clients, query]);

  return (
    <Screen>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
        <View>
          <Text className="text-2xl font-bold text-neutral-900">Клиенты</Text>
          <Text className="text-sm text-neutral-500">{clients.length} всего</Text>
        </View>
        <Pressable
          onPress={() => router.push("/clients/new")}
          className="h-10 w-10 items-center justify-center rounded-full bg-brand active:opacity-80"
        >
          <Plus color="#fff" size={22} />
        </Pressable>
      </View>

      <View className="mx-4 mb-2 flex-row items-center gap-2 rounded-xl bg-neutral-100 px-3">
        <Search color="#a3a3a3" size={18} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск по имени, телефону, адресу"
          placeholderTextColor="#a3a3a3"
          autoCapitalize="none"
          clearButtonMode="while-editing"
          className="flex-1 py-2.5 text-base text-neutral-900"
        />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm text-danger">
            {(error as Error).message}
          </Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={visible}
          keyExtractor={(c) => c.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <ClientRow
              client={item}
              onPress={() => router.push(`/clients/${item.id}`)}
            />
          )}
          ItemSeparatorComponent={() => (
            <View className="ml-[68px] h-px bg-neutral-100" />
          )}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <View className="items-center px-6 pt-20">
              <Text className="text-sm text-neutral-400">
                {query.trim() ? "Ничего не найдено" : "Пока нет клиентов"}
              </Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}
