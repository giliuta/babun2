import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Check, Search, X } from "lucide-react-native";
import {
  appointmentTotal,
  totalDuration,
} from "@babun/shared/local/finance/appointment-calc";
import {
  createBlankAppointment,
  type Appointment,
  type AppointmentStatus,
} from "@babun/shared/local/appointments";
import { formatEUR } from "@babun/shared/common/utils/money";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { COLORS, ICON } from "@/components/ui/tokens";
import { useClients } from "@/features/clients/queries";
import { useServices, type Service } from "@/features/services/queries";
import { useMasters, useTeams } from "@/features/reference/queries";
import {
  useCreateAppointment,
  useDeleteAppointment,
  useUpdateAppointment,
} from "@/features/calendar/mutations";
import { addMinutesHM, buildServices, formatHM, formatYMD, parseHM, parseYMD } from "./helpers";

const STATUSES: { value: AppointmentStatus; label: string }[] = [
  { value: "scheduled", label: "Запланировано" },
  { value: "in_progress", label: "В работе" },
  { value: "completed", label: "Выполнено" },
  { value: "cancelled", label: "Отменено" },
];

export function AppointmentSheet({
  visible,
  onClose,
  appointment,
  defaults,
}: {
  visible: boolean;
  onClose: () => void;
  appointment?: Appointment | null;
  defaults?: { date?: string; time_start?: string };
}) {
  const isEdit = !!appointment;
  const { data: clients = [] } = useClients();
  const { data: services = [] } = useServices();
  const { data: teams = [] } = useTeams();
  const { data: masters = [] } = useMasters();
  const createMut = useCreateAppointment();
  const updateMut = useUpdateAppointment();
  const deleteMut = useDeleteAppointment();

  const catalog = useMemo(
    () => new Map(services.map((s) => [s.id, s])),
    [services],
  );

  const [clientId, setClientId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [timeStart, setTimeStart] = useState("10:00");
  const [timeEnd, setTimeEnd] = useState("11:00");
  const [durationTouched, setDurationTouched] = useState(false);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [masterId, setMasterId] = useState<string | null>(null);
  const [total, setTotal] = useState("0");
  const [customTotal, setCustomTotal] = useState(false);
  const [status, setStatus] = useState<AppointmentStatus>("scheduled");
  const [comment, setComment] = useState("");

  const [clientPicker, setClientPicker] = useState(false);
  const [servicePicker, setServicePicker] = useState(false);

  // Hydrate on open.
  useEffect(() => {
    if (!visible) return;
    if (appointment) {
      setClientId(appointment.client_id);
      setDate(appointment.date);
      setTimeStart(appointment.time_start);
      setTimeEnd(appointment.time_end);
      setServiceIds(
        appointment.service_ids?.length
          ? appointment.service_ids
          : (appointment.services ?? []).map((s) => s.serviceId),
      );
      setTeamId(appointment.team_id);
      setMasterId(appointment.master_id ?? null);
      setTotal(String(appointment.total_amount ?? 0));
      setCustomTotal(!!appointment.custom_total);
      setStatus(appointment.status);
      setComment(appointment.comment ?? "");
      setDurationTouched(true);
    } else {
      const today = formatYMD(new Date());
      setClientId(null);
      setDate(defaults?.date ?? today);
      setTimeStart(defaults?.time_start ?? "10:00");
      setTimeEnd(addMinutesHM(defaults?.time_start ?? "10:00", 60));
      setServiceIds([]);
      setTeamId(null);
      setMasterId(null);
      setTotal("0");
      setCustomTotal(false);
      setStatus("scheduled");
      setComment("");
      setDurationTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, appointment?.id]);

  const selectedServices = useMemo(
    () => buildServices(serviceIds, catalog),
    [serviceIds, catalog],
  );
  const computedTotal = useMemo(
    () => appointmentTotal(selectedServices),
    [selectedServices],
  );
  const computedDuration = useMemo(
    () => totalDuration(selectedServices),
    [selectedServices],
  );

  // Auto-extend end time from service duration unless the operator set it.
  useEffect(() => {
    if (durationTouched) return;
    setTimeEnd(addMinutesHM(timeStart, computedDuration || 60));
  }, [timeStart, computedDuration, durationTouched]);

  // Keep total in sync with catalog unless the operator overrode it.
  useEffect(() => {
    if (!customTotal) setTotal(String(computedTotal));
  }, [computedTotal, customTotal]);

  const effectiveTotal = customTotal ? Number(total) || 0 : computedTotal;
  const client = clients.find((c) => c.id === clientId) ?? null;
  const canSave = !!date && !createMut.isPending && !updateMut.isPending;

  const buildPatch = (): Partial<Appointment> => ({
    client_id: clientId,
    date,
    time_start: timeStart,
    time_end: timeEnd,
    team_id: teamId,
    master_id: masterId,
    service_ids: serviceIds,
    services: selectedServices,
    total_amount: effectiveTotal,
    custom_total: customTotal,
    total_duration: computedDuration,
    comment: comment.trim(),
    status,
  });

  const save = async () => {
    try {
      if (isEdit && appointment) {
        await updateMut.mutateAsync({ id: appointment.id, patch: buildPatch() });
      } else {
        await createMut.mutateAsync(createBlankAppointment(buildPatch()));
      }
      onClose();
    } catch (e) {
      Alert.alert("Ошибка", (e as Error).message);
    }
  };

  const remove = () => {
    if (!appointment) return;
    Alert.alert("Удалить запись?", "Действие необратимо.", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMut.mutateAsync(appointment.id);
            onClose();
          } catch (e) {
            Alert.alert("Ошибка", (e as Error).message);
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="h-[88%] overflow-hidden rounded-t-3xl bg-neutral-50">
          {/* header */}
          <View className="flex-row items-center border-b border-neutral-200 bg-white px-2 py-2">
            <Pressable
              onPress={onClose}
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full active:bg-neutral-100"
            >
              <X color={COLORS.body} size={ICON.md} />
            </Pressable>
            <Text className="flex-1 text-center text-base font-semibold text-neutral-900">
              {isEdit ? "Запись" : "Новая запись"}
            </Text>
            <View className="w-10" />
          </View>

          <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
            {/* client */}
            <SectionCard title="Клиент">
              <Pressable
                onPress={() => setClientPicker(true)}
                className="flex-row items-center px-4 py-3 active:bg-neutral-50"
              >
                <View className="flex-1">
                  {client ? (
                    <>
                      <Text className="text-base font-semibold text-neutral-900">
                        {client.full_name || "Без имени"}
                      </Text>
                      {client.phone ? (
                        <Text className="text-sm text-neutral-500">
                          {client.phone}
                        </Text>
                      ) : null}
                    </>
                  ) : (
                    <Text className="text-base text-brand">Выбрать клиента</Text>
                  )}
                </View>
                {client ? (
                  <Text className="text-sm font-medium text-brand">Изменить</Text>
                ) : null}
              </Pressable>
            </SectionCard>

            {/* date + time */}
            <SectionCard title="Когда">
              <View className="flex-row items-center justify-between px-4 py-2.5">
                <Text className="text-base text-neutral-900">Дата</Text>
                <DateTimePicker
                  value={date ? parseYMD(date) : new Date()}
                  mode="date"
                  display="compact"
                  onChange={(_, d) => d && setDate(formatYMD(d))}
                />
              </View>
              <View className="ml-4 h-px bg-neutral-100" />
              <View className="flex-row items-center justify-between px-4 py-2.5">
                <Text className="text-base text-neutral-900">Время</Text>
                <View className="flex-row items-center">
                  <DateTimePicker
                    value={parseHM(timeStart)}
                    mode="time"
                    display="compact"
                    minuteInterval={5}
                    onChange={(_, d) => d && setTimeStart(formatHM(d))}
                  />
                  <Text className="px-1 text-neutral-400">–</Text>
                  <DateTimePicker
                    value={parseHM(timeEnd)}
                    mode="time"
                    display="compact"
                    minuteInterval={5}
                    onChange={(_, d) => {
                      if (d) {
                        setTimeEnd(formatHM(d));
                        setDurationTouched(true);
                      }
                    }}
                  />
                </View>
              </View>
            </SectionCard>

            {/* services */}
            <SectionCard
              title="Услуги"
              action={{ label: "Изменить", onPress: () => setServicePicker(true) }}
            >
              {serviceIds.length === 0 ? (
                <Pressable
                  onPress={() => setServicePicker(true)}
                  className="px-4 py-3 active:bg-neutral-50"
                >
                  <Text className="text-base text-brand">Добавить услуги</Text>
                </Pressable>
              ) : (
                serviceIds.map((id) => {
                  const s = catalog.get(id);
                  return (
                    <View
                      key={id}
                      className="flex-row items-center justify-between px-4 py-2.5"
                    >
                      <Text className="flex-1 pr-2 text-base text-neutral-900" numberOfLines={1}>
                        {s?.name ?? "Услуга"}
                      </Text>
                      <Text className="text-sm text-neutral-500 tabular-nums">
                        {formatEUR(s ? Number(s.price) : 0)}
                      </Text>
                    </View>
                  );
                })
              )}
            </SectionCard>

            {/* team / master */}
            {teams.length > 0 ? (
              <SectionCard title="Команда">
                <ChipRow
                  items={teams.map((t) => ({ id: t.id, label: t.name }))}
                  selected={teamId}
                  onSelect={(id) => setTeamId(id === teamId ? null : id)}
                />
              </SectionCard>
            ) : null}
            {masters.length > 0 ? (
              <SectionCard title="Мастер">
                <ChipRow
                  items={masters.map((m) => ({ id: m.id, label: m.full_name }))}
                  selected={masterId}
                  onSelect={(id) => setMasterId(id === masterId ? null : id)}
                />
              </SectionCard>
            ) : null}

            {/* total */}
            <SectionCard title="Сумма">
              <View className="flex-row items-center px-4 py-2.5">
                <TextInput
                  value={customTotal ? total : String(computedTotal)}
                  onChangeText={(v) => {
                    setCustomTotal(true);
                    setTotal(v);
                  }}
                  keyboardType="decimal-pad"
                  className="flex-1 text-2xl font-bold text-neutral-900"
                  placeholder="0"
                  placeholderTextColor={COLORS.faint}
                />
                <Text className="text-2xl font-bold text-neutral-400">€</Text>
                {customTotal ? (
                  <Pressable
                    onPress={() => setCustomTotal(false)}
                    hitSlop={8}
                    className="ml-3"
                  >
                    <Text className="text-sm font-medium text-brand">Авто</Text>
                  </Pressable>
                ) : null}
              </View>
            </SectionCard>

            {/* status */}
            <SectionCard title="Статус">
              <View className="flex-row flex-wrap gap-2 p-3">
                {STATUSES.map((s) => {
                  const active = status === s.value;
                  return (
                    <Pressable
                      key={s.value}
                      onPress={() => setStatus(s.value)}
                      className={`rounded-full px-3 py-1.5 ${active ? "bg-brand" : "bg-neutral-100"}`}
                    >
                      <Text
                        className={`text-sm font-medium ${active ? "text-white" : "text-neutral-600"}`}
                      >
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </SectionCard>

            {/* comment */}
            <SectionCard title="Комментарий">
              <TextInput
                value={comment}
                onChangeText={setComment}
                multiline
                placeholder="Заметка для бригады…"
                placeholderTextColor={COLORS.faint}
                className="min-h-[64px] px-4 py-3 text-base text-neutral-900"
                textAlignVertical="top"
              />
            </SectionCard>

            {isEdit ? (
              <Pressable onPress={remove} className="items-center py-5 active:opacity-70">
                <Text className="text-base font-medium text-danger">
                  Удалить запись
                </Text>
              </Pressable>
            ) : (
              <View className="h-6" />
            )}
          </ScrollView>

          {/* sticky footer */}
          <View className="border-t border-neutral-200 bg-white px-4 pb-7 pt-3">
            <Button
              label={
                isEdit
                  ? `Сохранить · ${formatEUR(effectiveTotal)}`
                  : `Создать · ${formatEUR(effectiveTotal)}`
              }
              onPress={save}
              disabled={!canSave}
              loading={createMut.isPending || updateMut.isPending}
            />
          </View>
        </View>
      </View>

      {/* client picker */}
      <PickerModal
        visible={clientPicker}
        onClose={() => setClientPicker(false)}
        title="Клиент"
        items={clients.map((c) => ({
          id: c.id,
          title: c.full_name || "Без имени",
          subtitle: c.phone ?? undefined,
        }))}
        selectedIds={clientId ? [clientId] : []}
        onPick={(id) => {
          setClientId(id);
          setClientPicker(false);
        }}
      />

      {/* service picker (multi) */}
      <PickerModal
        visible={servicePicker}
        onClose={() => setServicePicker(false)}
        title="Услуги"
        multi
        items={services.map((s) => ({
          id: s.id,
          title: s.name,
          subtitle: `${formatEUR(Number(s.price))} · ${s.duration_minutes} мин`,
        }))}
        selectedIds={serviceIds}
        onToggle={(id) =>
          setServiceIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
          )
        }
      />
    </Modal>
  );
}

function ChipRow({
  items,
  selected,
  onSelect,
}: {
  items: { id: string; label: string }[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
    >
      {items.map((it) => {
        const active = selected === it.id;
        return (
          <Pressable
            key={it.id}
            onPress={() => onSelect(it.id)}
            className={`rounded-full px-3.5 py-1.5 ${active ? "bg-brand" : "bg-neutral-100"}`}
          >
            <Text
              className={`text-sm font-medium ${active ? "text-white" : "text-neutral-700"}`}
            >
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

type PickerItem = { id: string; title: string; subtitle?: string };

function PickerModal({
  visible,
  onClose,
  title,
  items,
  selectedIds,
  multi,
  onPick,
  onToggle,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  items: PickerItem[];
  selectedIds: string[];
  multi?: boolean;
  onPick?: (id: string) => void;
  onToggle?: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(t) ||
        (i.subtitle ?? "").toLowerCase().includes(t),
    );
  }, [q, items]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="h-[80%] overflow-hidden rounded-t-3xl bg-white">
          <View className="flex-row items-center border-b border-neutral-100 px-2 py-2">
            <Text className="flex-1 px-2 text-base font-semibold text-neutral-900">
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              className={`h-10 items-center justify-center rounded-full active:bg-neutral-100 ${multi ? "px-3" : "w-10"}`}
            >
              {multi ? (
                <Text className="text-sm font-semibold text-brand">Готово</Text>
              ) : (
                <X color={COLORS.body} size={ICON.md} />
              )}
            </Pressable>
          </View>
          <View className="flex-row items-center gap-2 px-4 py-2">
            <Search color={COLORS.faint} size={ICON.sm} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Поиск…"
              placeholderTextColor={COLORS.faint}
              className="flex-1 py-1 text-base text-neutral-900"
            />
          </View>
          <FlatList
            style={{ flex: 1 }}
            data={filtered}
            keyExtractor={(i) => i.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const sel = selectedIds.includes(item.id);
              return (
                <Pressable
                  onPress={() => (multi ? onToggle?.(item.id) : onPick?.(item.id))}
                  className="flex-row items-center px-4 py-3 active:bg-neutral-50"
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-base text-neutral-900" numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.subtitle ? (
                      <Text className="text-sm text-neutral-500" numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  {sel ? <Check color={COLORS.brand} size={ICON.md} /> : null}
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => (
              <View className="ml-4 h-px bg-neutral-100" />
            )}
          />
        </View>
      </View>
    </Modal>
  );
}
