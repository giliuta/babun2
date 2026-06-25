import { Text, View } from "react-native";
import { RefListScreen } from "@/features/reference/RefListScreen";
import {
  useCreateMaster,
  useMasters,
  type Master,
} from "@/features/reference/queries";

export default function MastersScreen() {
  const { data: masters = [], isLoading } = useMasters();
  const create = useCreateMaster();
  return (
    <RefListScreen<Master>
      title="Мастера"
      items={masters}
      isLoading={isLoading}
      emptyText="Нет мастеров — добавьте первого через +"
      fields={[
        { key: "full_name", label: "Имя", placeholder: "Иван Петров", required: true },
        { key: "phone", label: "Телефон", placeholder: "+357…", keyboardType: "phone-pad" },
      ]}
      onCreate={async (v) => {
        await create.mutateAsync({ full_name: v.full_name, phone: v.phone });
      }}
      renderItem={(m) => (
        <View className="px-4 py-3">
          <Text className="text-base font-semibold text-neutral-900">
            {m.full_name}
          </Text>
          {m.phone ? (
            <Text className="text-sm text-neutral-500">{m.phone}</Text>
          ) : null}
        </View>
      )}
    />
  );
}
