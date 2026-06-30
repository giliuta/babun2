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
import { Filter, Plus, Search, Upload } from "lucide-react-native";
import type { Client } from "@babun/shared/local/clients";
import { matchesClient } from "@babun/shared/local/selectors/client-search";
import { Screen } from "@/components/ui/Screen";
import { useClients, useClientTags } from "@/features/clients/queries";
import {
  EMPTY_FILTER,
  applyClientsFilter,
  cityOptions,
  filterActiveCount,
  type ClientsFilter,
} from "@/features/clients/filter";
import { ClientsFilterSheet } from "@/features/clients/ClientsFilterSheet";
import { ImportSheet } from "@/features/clients/ImportSheet";
import { useThemeColors } from "@/theme/colors";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function ClientRow({ client, onPress }: { client: Client; onPress: () => void }) {
  const t = useThemeColors();
  const owes = client.balance < 0;
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3 active:opacity-60"
    >
      <View
        className="h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: t.dark ? "rgba(44,91,224,0.18)" : "rgba(44,91,224,0.1)" }}
      >
        <Text className="text-base font-semibold" style={{ color: t.accent }}>
          {initials(client.full_name)}
        </Text>
      </View>
      <View className="ml-3 flex-1">
        <Text
          className="text-base font-semibold"
          style={{ color: t.ink }}
          numberOfLines={1}
        >
          {client.full_name || "Без имени"}
        </Text>
        <Text className="text-sm" style={{ color: t.sub }} numberOfLines={1}>
          {client.phone}
          {client.city ? ` · ${client.city}` : ""}
        </Text>
      </View>
      {client.balance !== 0 ? (
        <Text
          className="text-sm font-semibold"
          style={{ color: owes ? t.danger : t.success }}
        >
          {owes ? "−" : "+"}€{Math.abs(client.balance)}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function ClientsListScreen() {
  const t = useThemeColors();
  const router = useRouter();
  const { data, isLoading, isRefetching, refetch, error } = useClients();
  const { data: tags = [] } = useClientTags();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ClientsFilter>(EMPTY_FILTER);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const clients = data ?? [];
  const cities = useMemo(() => cityOptions(clients), [clients]);
  const activeCount = filterActiveCount(filter);

  const visible = useMemo(() => {
    const sorted = [...clients].sort((a, b) =>
      a.full_name.localeCompare(b.full_name, "ru"),
    );
    const byFilter = applyClientsFilter(sorted, filter);
    const q = query.trim();
    return q ? byFilter.filter((c) => matchesClient(c, q)) : byFilter;
  }, [clients, query, filter]);

  const filtering = activeCount > 0 || query.trim().length > 0;

  return (
    <Screen>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
        <View>
          <Text className="text-2xl font-bold" style={{ color: t.ink }}>Клиенты</Text>
          <Text className="text-sm" style={{ color: t.sub }}>
            {filtering
              ? `Найдено: ${visible.length} из ${clients.length}`
              : `${clients.length} всего`}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => setImportOpen(true)}
            className="h-10 w-10 items-center justify-center rounded-full active:opacity-80"
            style={{ backgroundColor: t.dark ? "rgba(255,255,255,0.07)" : "#eef1f5" }}
          >
            <Upload color={t.body} size={20} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/clients/new")}
            className="h-10 w-10 items-center justify-center rounded-full active:opacity-80"
            style={{ backgroundColor: t.accent }}
          >
            <Plus color="#fff" size={22} />
          </Pressable>
        </View>
      </View>

      <View
        className="mx-4 mb-2 flex-row items-center gap-2 rounded-xl px-3"
        style={{ backgroundColor: t.dark ? "rgba(255,255,255,0.07)" : "#eef1f5" }}
      >
        <Search color={t.faint} size={18} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск по имени, телефону, адресу"
          placeholderTextColor={t.placeholder}
          selectionColor={t.accent}
          keyboardAppearance={t.dark ? "dark" : "light"}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          className="flex-1 py-2.5 text-base"
          style={{ color: t.ink }}
        />
      </View>

      <Pressable
        onPress={() => setSheetOpen(true)}
        className="mx-4 mb-2 flex-row items-center gap-2 rounded-xl border px-3 py-2.5 active:opacity-60"
        style={
          activeCount
            ? { borderColor: t.accent + "66", backgroundColor: t.dark ? "rgba(44,91,224,0.1)" : "rgba(44,91,224,0.05)" }
            : { borderColor: t.separator, backgroundColor: t.surface }
        }
      >
        <Filter color={activeCount ? t.accent : t.faint} size={16} />
        <Text
          className="flex-1 text-sm"
          style={{ color: activeCount ? t.accent : t.sub, fontWeight: activeCount ? "600" : "400" }}
        >
          {activeCount ? `Фильтры · ${activeCount}` : "Фильтры"}
        </Text>
        {activeCount ? (
          <Pressable
            hitSlop={8}
            onPress={() => setFilter(EMPTY_FILTER)}
            className="active:opacity-60"
          >
            <Text className="text-xs" style={{ color: t.faint }}>Сбросить</Text>
          </Pressable>
        ) : null}
      </Pressable>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm" style={{ color: t.danger }}>
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
            <View className="ml-[68px] h-px" style={{ backgroundColor: t.separator }} />
          )}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <View className="items-center px-6 pt-20">
              <Text className="text-sm" style={{ color: t.faint }}>
                {filtering ? "Ничего не найдено" : "Пока нет клиентов"}
              </Text>
            </View>
          }
        />
      )}

      <ClientsFilterSheet
        visible={sheetOpen}
        filter={filter}
        onChange={setFilter}
        onClose={() => setSheetOpen(false)}
        tags={tags}
        cities={cities}
      />
      <ImportSheet visible={importOpen} onClose={() => setImportOpen(false)} />
    </Screen>
  );
}
