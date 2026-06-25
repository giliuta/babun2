import { Text, View } from "react-native";
import { RefListScreen } from "@/features/reference/RefListScreen";
import {
  useCreateMaster,
  useDeleteMaster,
  useMasters,
  useUpdateMaster,
  type Master,
} from "@/features/reference/queries";

export default function MastersScreen() {
  const { data: masters = [], isLoading } = useMasters();
  const create = useCreateMaster();
  const update = useUpdateMaster();
  const del = useDeleteMaster();
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
      onUpdate={async (id, v) => {
        await update.mutateAsync({
          id,
          patch: { full_name: v.full_name, phone: v.phone || null },
        });
      }}
      onDelete={async (id) => {
        await del.mutateAsync(id);
      }}
      itemToValues={(m) => ({ full_name: m.full_name, phone: m.phone ?? "" })}
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
