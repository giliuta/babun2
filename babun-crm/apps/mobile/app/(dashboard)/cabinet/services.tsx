import { Text, View } from "react-native";
import { formatEUR } from "@babun/shared/common/utils/money";
import { RefListScreen } from "@/features/reference/RefListScreen";
import { useThemeColors } from "@/theme/colors";
import {
  useCreateService,
  useServices,
  type Service,
} from "@/features/services/queries";
import { useDeleteService, useUpdateService } from "@/features/reference/queries";

export default function ServicesScreen() {
  const t = useThemeColors();
  const { data: services = [], isLoading } = useServices();
  const create = useCreateService();
  const update = useUpdateService();
  const del = useDeleteService();

  const toInput = (v: Record<string, string>) => ({
    name: v.name,
    price: Number(v.price) || 0,
    duration_minutes: Number(v.duration_minutes) || 60,
  });

  return (
    <RefListScreen<Service>
      title="Услуги"
      items={services}
      isLoading={isLoading}
      emptyText="Нет услуг — добавьте первую через +"
      fields={[
        { key: "name", label: "Название", placeholder: "Чистка кондиционера", required: true },
        { key: "price", label: "Цена €", placeholder: "0", keyboardType: "decimal-pad" },
        { key: "duration_minutes", label: "Минут", placeholder: "60", keyboardType: "number-pad" },
      ]}
      onCreate={async (v) => {
        await create.mutateAsync(toInput(v));
      }}
      onUpdate={async (id, v) => {
        await update.mutateAsync({ id, patch: toInput(v) });
      }}
      onDelete={async (id) => {
        await del.mutateAsync(id);
      }}
      itemToValues={(s) => ({
        name: s.name,
        price: String(Number(s.price)),
        duration_minutes: String(s.duration_minutes),
      })}
      renderItem={(s) => (
        <View className="flex-row items-center px-4 py-3">
          <View className="flex-1 pr-3">
            <Text
              style={{ fontSize: 16, fontWeight: "600", color: t.ink }}
              numberOfLines={1}
            >
              {s.name}
            </Text>
            <Text style={{ fontSize: 14, color: t.sub }}>{s.duration_minutes} мин</Text>
          </View>
          <Text
            className="tabular-nums"
            style={{ fontSize: 16, fontWeight: "600", color: t.ink }}
          >
            {formatEUR(Number(s.price))}
          </Text>
        </View>
      )}
    />
  );
}
