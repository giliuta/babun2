import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { X } from "lucide-react-native";
import type { PaymentMethod } from "@babun/shared/local/finance/transaction";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { COLORS, ICON } from "@/components/ui/tokens";
import { formatYMD, parseYMD } from "@/features/appointments/helpers";
import { useTeams } from "@/features/reference/queries";
import { useFinanceCategories, useInsertTransaction } from "./queries";

const PAYMENTS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Наличные" },
  { value: "card", label: "Карта" },
  { value: "transfer", label: "Перевод" },
  { value: "other", label: "Другое" },
];

function Chip({
  label,
  active,
  onPress,
  tone = "brand",
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  tone?: "brand" | "danger" | "success";
}) {
  const bg = active
    ? tone === "danger"
      ? "bg-danger"
      : tone === "success"
        ? "bg-success"
        : "bg-brand"
    : "bg-neutral-100";
  return (
    <Pressable onPress={onPress} className={`rounded-full px-3.5 py-1.5 ${bg}`}>
      <Text
        className={`text-sm font-medium ${active ? "text-white" : "text-neutral-700"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function OperationSheet({
  visible,
  onClose,
  defaultTeamId,
}: {
  visible: boolean;
  onClose: () => void;
  defaultTeamId?: string | null;
}) {
  const { data: categories = [] } = useFinanceCategories();
  const { data: teams = [] } = useTeams();
  const insert = useInsertTransaction();

  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(defaultTeamId ?? null);
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [date, setDate] = useState(formatYMD(new Date()));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!visible) return;
    setType("expense");
    setAmount("");
    setCategoryId(null);
    setTeamId(defaultTeamId ?? null);
    setPayment("cash");
    setDate(formatYMD(new Date()));
    setNotes("");
  }, [visible, defaultTeamId]);

  const cats = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type],
  );

  const amountNum = Number(amount.replace(",", ".")) || 0;
  const canSave = amountNum > 0 && !insert.isPending;
  const isExpense = type === "expense";

  const save = async () => {
    try {
      await insert.mutateAsync({
        type,
        amount: amountNum,
        category_id: categoryId,
        team_id: teamId,
        payment_method: payment,
        notes: notes.trim() || null,
        occurred_on: date,
      });
      onClose();
    } catch (e) {
      Alert.alert("Ошибка", (e as Error).message);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="h-[86%] overflow-hidden rounded-t-3xl bg-neutral-50">
          <View className="flex-row items-center border-b border-neutral-200 bg-white px-2 py-2">
            <Pressable
              onPress={onClose}
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full active:bg-neutral-100"
            >
              <X color={COLORS.body} size={ICON.md} />
            </Pressable>
            <Text className="flex-1 text-center text-base font-semibold text-neutral-900">
              Операция
            </Text>
            <View className="w-10" />
          </View>

          <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
            {/* type segmented */}
            <View className="mx-3 mt-3 flex-row rounded-xl bg-neutral-200 p-1">
              {(["expense", "income"] as const).map((t) => {
                const active = type === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => {
                      setType(t);
                      setCategoryId(null);
                    }}
                    className={`flex-1 items-center rounded-lg py-2 ${active ? "bg-white" : ""}`}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        active
                          ? t === "expense"
                            ? "text-danger"
                            : "text-success"
                          : "text-neutral-500"
                      }`}
                    >
                      {t === "expense" ? "Расход" : "Доход"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* amount */}
            <SectionCard title="Сумма">
              <View className="flex-row items-center px-4 py-2.5">
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  autoFocus
                  placeholder="0"
                  placeholderTextColor={COLORS.faint}
                  className={`flex-1 text-3xl font-bold ${isExpense ? "text-danger" : "text-success"}`}
                />
                <Text className="text-3xl font-bold text-neutral-300">€</Text>
              </View>
            </SectionCard>

            {/* category */}
            {cats.length > 0 ? (
              <SectionCard title="Категория">
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    gap: 8,
                  }}
                >
                  {cats.map((c) => (
                    <Chip
                      key={c.id}
                      label={c.name}
                      active={categoryId === c.id}
                      tone={isExpense ? "danger" : "success"}
                      onPress={() =>
                        setCategoryId(categoryId === c.id ? null : c.id)
                      }
                    />
                  ))}
                </ScrollView>
              </SectionCard>
            ) : null}

            {/* team */}
            {teams.length > 0 ? (
              <SectionCard title="Команда">
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    gap: 8,
                  }}
                >
                  {teams.map((t) => (
                    <Chip
                      key={t.id}
                      label={t.name}
                      active={teamId === t.id}
                      onPress={() => setTeamId(teamId === t.id ? null : t.id)}
                    />
                  ))}
                </ScrollView>
              </SectionCard>
            ) : null}

            {/* payment + date */}
            <SectionCard title="Оплата">
              <View className="flex-row flex-wrap gap-2 p-3">
                {PAYMENTS.map((p) => (
                  <Chip
                    key={p.value}
                    label={p.label}
                    active={payment === p.value}
                    onPress={() => setPayment(p.value)}
                  />
                ))}
              </View>
              <View className="ml-4 h-px bg-neutral-100" />
              <View className="flex-row items-center justify-between px-4 py-2.5">
                <Text className="text-base text-neutral-900">Дата</Text>
                <DateTimePicker
                  value={parseYMD(date)}
                  mode="date"
                  display="compact"
                  onChange={(_, d) => d && setDate(formatYMD(d))}
                />
              </View>
            </SectionCard>

            {/* notes */}
            <SectionCard title="Заметка">
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Напр. бензин, материалы…"
                placeholderTextColor={COLORS.faint}
                className="px-4 py-3 text-base text-neutral-900"
              />
            </SectionCard>

            <View className="h-6" />
          </ScrollView>

          <View className="border-t border-neutral-200 bg-white px-4 pb-7 pt-3">
            <Button
              label={isExpense ? "Добавить расход" : "Добавить доход"}
              onPress={save}
              disabled={!canSave}
              loading={insert.isPending}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
