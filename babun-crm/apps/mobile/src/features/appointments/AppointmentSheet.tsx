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
import { Check, Minus, Plus, Search, X } from "lucide-react-native";
import {
  appointmentTotal,
  globalDiscountAmount,
  totalDuration,
} from "@babun/shared/local/finance/appointment-calc";
import {
  createBlankAppointment,
  type Appointment,
  type AppointmentStatus,
  type Discount,
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
import {
  addMinutesHM,
  buildServices,
  formatHM,
  formatYMD,
  parseHM,
  parseYMD,
  type ServiceOverride,
} from "./helpers";

const CANCEL_REASONS = [
  "Клиент перенёс",
  "Клиент отменил",
  "Погода",
  "Не дозвонились",
  "Нет доступа",
  "Дубль",
];

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
  defaults?: {
    date?: string;
    time_start?: string;
    client_id?: string | null;
    team_id?: string | null;
  };
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
  const [locationId, setLocationId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, ServiceOverride>>({});
  const [discountType, setDiscountType] = useState<"fixed" | "percent" | null>(null);
  const [discountValue, setDiscountValue] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [kind, setKind] = useState<"work" | "event">("work");
  const [eventColor, setEventColor] = useState<string | null>(null);

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
      setLocationId(appointment.location_id ?? null);
      setOverrides(
        Object.fromEntries(
          (appointment.services ?? []).map((s) => [
            s.serviceId,
            { qty: s.quantity, price: s.pricePerUnit },
          ]),
        ),
      );
      setDiscountType(appointment.global_discount?.type ?? null);
      setDiscountValue(
        appointment.global_discount ? String(appointment.global_discount.value) : "",
      );
      setCancelReason(appointment.cancel_reason ?? "");
      setKind(appointment.kind === "work" ? "work" : "event");
      setEventColor(appointment.color_override ?? null);
      setDurationTouched(true);
    } else {
      const today = formatYMD(new Date());
      setClientId(defaults?.client_id ?? null);
      setDate(defaults?.date ?? today);
      setTimeStart(defaults?.time_start ?? "10:00");
      setTimeEnd(addMinutesHM(defaults?.time_start ?? "10:00", 60));
      setServiceIds([]);
      setTeamId(defaults?.team_id ?? null);
      setMasterId(null);
      setTotal("0");
      setCustomTotal(false);
      setStatus("scheduled");
      setComment("");
      setLocationId(null);
      setOverrides({});
      setDiscountType(null);
      setDiscountValue("");
      setCancelReason("");
      setKind("work");
      setEventColor(null);
      setDurationTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, appointment?.id]);

  const globalDiscount = useMemo<Discount | null>(
    () =>
      discountType && Number(discountValue) > 0
        ? { type: discountType, value: Number(discountValue) }
        : null,
    [discountType, discountValue],
  );
  const selectedServices = useMemo(
    () => buildServices(serviceIds, catalog, overrides),
    [serviceIds, catalog, overrides],
  );
  const computedTotal = useMemo(
    () => appointmentTotal(selectedServices, globalDiscount),
    [selectedServices, globalDiscount],
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

  const buildPatch = (): Partial<Appointment> => {
    const cancel =
      status === "cancelled" ? cancelReason.trim() || null : null;
    if (kind === "event") {
      // Personal/team event (meeting, lunch, break) — no client/services/money.
      return {
        kind: "event",
        date,
        time_start: timeStart,
        time_end: timeEnd,
        team_id: teamId,
        master_id: masterId,
        status,
        comment: comment.trim(),
        color_override: eventColor,
        client_id: null,
        location_id: null,
        service_ids: [],
        services: [],
        total_amount: 0,
        custom_total: false,
        global_discount: null,
        discount_amount: 0,
        cancel_reason: cancel,
      };
    }
    return {
      kind: "work",
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
      location_id: locationId,
      color_override: eventColor,
      global_discount: globalDiscount,
      discount_amount: globalDiscountAmount(selectedServices, globalDiscount),
      cancel_reason: cancel,
    };
  };

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
              {kind === "event"
                ? isEdit
                  ? "Событие"
                  : "Новое событие"
                : isEdit
                  ? "Запись"
                  : "Новая запись"}
            </Text>
            <View className="w-10" />
          </View>

          <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
            {/* kind toggle */}
            <View className="mx-3 mt-3 flex-row rounded-xl bg-neutral-200 p-1">
              {(["work", "event"] as const).map((k) => (
                <Pressable
                  key={k}
                  onPress={() => setKind(k)}
                  className={`flex-1 items-center rounded-lg py-2 ${kind === k ? "bg-white" : ""}`}
                >
                  <Text
                    className={`text-sm font-semibold ${kind === k ? "text-neutral-900" : "text-neutral-500"}`}
                  >
                    {k === "work" ? "Работа" : "Событие"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {kind === "work" ? (
              <>
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

            {/* object / location */}
            {client?.locations && client.locations.length > 0 ? (
              <SectionCard title="Объект">
                <ChipRow
                  items={client.locations.map((l) => ({
                    id: l.id,
                    label: l.label || "Объект",
                  }))}
                  selected={locationId}
                  onSelect={(id) => setLocationId(id === locationId ? null : id)}
                />
                {locationId ? (
                  <Text className="px-4 pb-3 text-sm text-neutral-500">
                    {client.locations.find((l) => l.id === locationId)?.address}
                  </Text>
                ) : null}
              </SectionCard>
            ) : null}

              </>
            ) : null}

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

            {kind === "work" ? (
              <>
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
                  const ov = overrides[id] ?? {};
                  const qty = ov.qty ?? 1;
                  const price = ov.price ?? (s ? Number(s.price) : 0);
                  const setOv = (p: ServiceOverride) =>
                    setOverrides((o) => ({ ...o, [id]: { ...o[id], ...p } }));
                  return (
                    <View
                      key={id}
                      className="flex-row items-center px-4 py-2.5"
                    >
                      <Text className="flex-1 pr-2 text-base text-neutral-900" numberOfLines={1}>
                        {s?.name ?? "Услуга"}
                      </Text>
                      <Pressable
                        onPress={() => setOv({ qty: Math.max(1, qty - 1) })}
                        className="h-7 w-7 items-center justify-center rounded-full bg-neutral-100 active:opacity-70"
                      >
                        <Minus color={COLORS.body} size={13} />
                      </Pressable>
                      <Text className="w-6 text-center text-sm text-neutral-700 tabular-nums">
                        {qty}
                      </Text>
                      <Pressable
                        onPress={() => setOv({ qty: qty + 1 })}
                        className="h-7 w-7 items-center justify-center rounded-full bg-neutral-100 active:opacity-70"
                      >
                        <Plus color={COLORS.body} size={13} />
                      </Pressable>
                      <TextInput
                        value={String(price)}
                        onChangeText={(v) =>
                          setOv({ price: Number(v.replace(",", ".")) || 0 })
                        }
                        keyboardType="decimal-pad"
                        className="ml-2 w-14 text-right text-sm text-neutral-700 tabular-nums"
                      />
                      <Text className="text-sm text-neutral-400">€</Text>
                    </View>
                  );
                })
              )}
            </SectionCard>

              </>
            ) : null}

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

            {kind === "work" ? (
              <>
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

            {/* discount */}
            <SectionCard title="Скидка">
              <View className="flex-row items-center gap-2 p-3">
                {(
                  [
                    { v: null, label: "Нет" },
                    { v: "fixed", label: "€" },
                    { v: "percent", label: "%" },
                  ] as const
                ).map((opt) => {
                  const active = discountType === opt.v;
                  return (
                    <Pressable
                      key={opt.label}
                      onPress={() => setDiscountType(opt.v)}
                      className={`rounded-full px-3.5 py-1.5 ${active ? "bg-brand" : "bg-neutral-100"}`}
                    >
                      <Text
                        className={`text-sm font-medium ${active ? "text-white" : "text-neutral-600"}`}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
                {discountType ? (
                  <TextInput
                    value={discountValue}
                    onChangeText={setDiscountValue}
                    keyboardType="decimal-pad"
                    placeholder={discountType === "percent" ? "10" : "20"}
                    placeholderTextColor={COLORS.faint}
                    className="ml-2 flex-1 text-base text-neutral-900"
                  />
                ) : null}
              </View>
              {globalDiscount ? (
                <Text className="px-4 pb-3 text-sm font-medium text-success">
                  −{formatEUR(globalDiscountAmount(selectedServices, globalDiscount))}
                </Text>
              ) : null}
            </SectionCard>

              </>
            ) : null}

            {/* event color (event only) */}
            {kind === "event" ? (
              <SectionCard title="Цвет">
                <View className="flex-row flex-wrap gap-3 p-3">
                  {[
                    "#4338ca", "#10b981", "#ef4444", "#f59e0b",
                    "#06b6d4", "#a855f7", "#ec4899", "#737373",
                  ].map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setEventColor(c)}
                      className={`h-9 w-9 rounded-full ${eventColor === c ? "border-2 border-neutral-900" : ""}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </View>
              </SectionCard>
            ) : null}

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

            {/* cancel reason */}
            {status === "cancelled" ? (
              <SectionCard title="Причина отмены">
                <View className="flex-row flex-wrap gap-2 p-3">
                  {CANCEL_REASONS.map((r) => {
                    const active = cancelReason === r;
                    return (
                      <Pressable
                        key={r}
                        onPress={() => setCancelReason(active ? "" : r)}
                        className={`rounded-full px-3 py-1.5 ${active ? "bg-danger" : "bg-neutral-100"}`}
                      >
                        <Text
                          className={`text-sm font-medium ${active ? "text-white" : "text-neutral-600"}`}
                        >
                          {r}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  value={cancelReason}
                  onChangeText={setCancelReason}
                  placeholder="Своя причина…"
                  placeholderTextColor={COLORS.faint}
                  className="px-4 pb-3 text-base text-neutral-900"
                />
              </SectionCard>
            ) : null}

            {/* comment / event title */}
            <SectionCard title={kind === "event" ? "Название" : "Комментарий"}>
              <TextInput
                value={comment}
                onChangeText={setComment}
                multiline
                placeholder={kind === "event" ? "Обед, встреча, перерыв…" : "Заметка для бригады…"}
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
                kind === "event"
                  ? isEdit
                    ? "Сохранить"
                    : "Создать событие"
                  : isEdit
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
