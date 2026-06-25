import { Text, View } from "react-native";
import { RefListScreen } from "@/features/reference/RefListScreen";
import {
  useCreateTeam,
  useDeleteTeam,
  useTeams,
  useUpdateTeam,
  type Team,
} from "@/features/reference/queries";

export default function TeamsScreen() {
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
      renderItem={(t) => (
        <View className="px-4 py-3">
          <Text className="text-base font-semibold text-neutral-900">{t.name}</Text>
          {t.region ? (
            <Text className="text-sm text-neutral-500">{t.region}</Text>
          ) : null}
        </View>
      )}
    />
  );
}
