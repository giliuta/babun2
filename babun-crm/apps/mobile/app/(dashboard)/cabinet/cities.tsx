import { Text, View } from "react-native";
import { RefListScreen } from "@/features/reference/RefListScreen";
import { useCities, useCreateCity, type City } from "@/features/reference/queries";

export default function CitiesScreen() {
  const { data: cities = [], isLoading } = useCities();
  const create = useCreateCity();
  return (
    <RefListScreen<City>
      title="Города"
      items={cities}
      isLoading={isLoading}
      emptyText="Нет городов — добавьте первый через +"
      fields={[
        { key: "name", label: "Город", placeholder: "Limassol", required: true },
        { key: "country", label: "Страна", placeholder: "Кипр" },
      ]}
      onCreate={async (v) => {
        await create.mutateAsync({ name: v.name, country: v.country });
      }}
      renderItem={(c) => (
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-base font-semibold text-neutral-900">{c.name}</Text>
          {c.country ? (
            <Text className="text-sm text-neutral-500">{c.country}</Text>
          ) : null}
        </View>
      )}
    />
  );
}
