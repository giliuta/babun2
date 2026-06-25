import { useMemo, useState } from "react";
import { Pressable, SectionList, Text, View } from "react-native";
import { Plus } from "lucide-react-native";
import type { Appointment } from "@babun/shared/local/appointments";
import { formatEUR } from "@babun/shared/common/utils/money";
import { Screen } from "@/components/ui/Screen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { COLORS } from "@/components/ui/tokens";
import { humanDay } from "@/features/appointments/helpers";
import { AppointmentSheet } from "@/features/appointments/AppointmentSheet";
import { useAppointments } from "@/features/calendar/queries";
import { useClients } from "@/features/clients/queries";

function AppointmentRow({
  apt,
  clientName,
  onPress,
}: {
  apt: Appointment;
  clientName: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center bg-white px-4 py-3 active:bg-neutral-50"
    >
      <View className="w-14">
        <Text className="text-sm font-semibold text-neutral-900 tabular-nums">
          {apt.time_start}
        </Text>
        <Text className="text-xs text-neutral-400 tabular-nums">
          {apt.time_end}
        </Text>
      </View>
      <View className="ml-2 flex-1 border-l border-neutral-100 pl-3">
        <Text className="text-base font-semibold text-neutral-900" numberOfLines={1}>
          {clientName || apt.comment || "Запись"}
        </Text>
        {apt.comment ? (
          <Text className="text-sm text-neutral-500" numberOfLines={1}>
            {apt.comment}
          </Text>
        ) : null}
        <View className="mt-1 flex-row items-center gap-2">
          <StatusBadge status={apt.status} />
          {apt.total_amount ? (
            <Text className="text-xs font-semibold text-neutral-700 tabular-nums">
              {formatEUR(apt.total_amount)}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function CalendarTab() {
  const { data: appts = [], isLoading, error } = useAppointments();
  const { data: clients = [] } = useClients();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);

  const nameById = useMemo(
    () => new Map(clients.map((c) => [c.id, c.full_name])),
    [clients],
  );

  const sections = useMemo(() => {
    const byDate = new Map<string, Appointment[]>();
    for (const a of appts) {
      const arr = byDate.get(a.date) ?? [];
      arr.push(a);
      byDate.set(a.date, arr);
    }
    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([d, data]) => ({
        title: d,
        data: data.sort((x, y) => x.time_start.localeCompare(y.time_start)),
      }));
  }, [appts]);

  const openCreate = () => {
    setEditing(null);
    setSheetOpen(true);
  };
  const openEdit = (apt: Appointment) => {
    setEditing(apt);
    setSheetOpen(true);
  };

  return (
    <Screen>
      <ScreenHeader large title="Календарь" subtitle={`${appts.length} записей`} />

      {isLoading ? (
        <EmptyState state="loading" fill />
      ) : error ? (
        <EmptyState state="error" fill subtitle={(error as Error).message} />
      ) : (
        <SectionList
          style={{ flex: 1 }}
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled
          contentContainerStyle={{ paddingBottom: 96, flexGrow: 1 }}
          renderSectionHeader={({ section }) => (
            <Text className="bg-neutral-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {humanDay(section.title)}
            </Text>
          )}
          renderItem={({ item }) => (
            <AppointmentRow
              apt={item}
              clientName={item.client_id ? nameById.get(item.client_id) ?? "" : ""}
              onPress={() => openEdit(item)}
            />
          )}
          ItemSeparatorComponent={() => <View className="h-px bg-neutral-100" />}
          ListEmptyComponent={
            <EmptyState
              fill
              title="Записей пока нет"
              subtitle="Нажмите + чтобы создать первую"
              action={{ label: "Новая запись", onPress: openCreate }}
            />
          }
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={openCreate}
        className="absolute bottom-6 right-5 h-14 w-14 items-center justify-center rounded-full bg-brand active:opacity-90"
        style={{
          shadowColor: COLORS.brand,
          shadowOpacity: 0.3,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <Plus color="#fff" size={28} />
      </Pressable>

      <AppointmentSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        appointment={editing}
      />
    </Screen>
  );
}
