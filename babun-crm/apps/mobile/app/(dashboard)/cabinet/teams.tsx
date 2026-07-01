import { Text, View } from "react-native";
import { RefListScreen } from "@/features/reference/RefListScreen";
import { useThemeColors } from "@/theme/colors";
import {
  useCreateTeam,
  useDeleteTeam,
  useTeams,
  useUpdateTeam,
  type Team,
} from "@/features/reference/queries";

export default function TeamsScreen() {
  const th = useThemeColors();
  const { data: teams = [], isLoading } = useTeams();
  const create = useCreateTeam();
  const update = useUpdateTeam();
  const del = useDeleteTeam();
  return (
    <RefListScreen<Team>
      title="Команды"
      items={teams}
      isLoading={isLoading}
      emptyText="Нет команд — добавьте первую через +"
      fields={[
        { key: "name", label: "Название", placeholder: "Бригада 1", required: true },
        { key: "region", label: "Регион", placeholder: "Limassol" },
      ]}
      onCreate={async (v) => {
        await create.mutateAsync({ name: v.name, region: v.region });
      }}
      onUpdate={async (id, v) => {
        await update.mutateAsync({
          id,
          patch: { name: v.name, region: v.region || null },
        });
      }}
      onDelete={async (id) => {
        await del.mutateAsync(id);
      }}
      itemToValues={(t) => ({ name: t.name, region: t.region ?? "" })}
      renderItem={(item) => (
        <View className="px-4 py-3">
          <Text style={{ fontSize: 16, fontWeight: "600", color: th.ink }}>{item.name}</Text>
          {item.region ? (
            <Text style={{ fontSize: 14, color: th.sub }}>{item.region}</Text>
          ) : null}
        </View>
      )}
    />
  );
}
