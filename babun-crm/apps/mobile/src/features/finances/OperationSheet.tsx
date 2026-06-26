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
import type {
  FinanceTransaction,
  PaymentMethod,
} from "@babun/shared/local/finance/transaction";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { COLORS, ICON } from "@/components/ui/tokens";
import { useToast } from "@/components/ui/Toast";
import { formatEUR } from "@babun/shared/common/utils/money";
import { formatYMD, parseYMD } from "@/features/appointments/helpers";
import { useTeams } from "@/features/reference/queries";
import {
  useAccounts,
  useDeleteTransaction,
  useFinanceCategories,
  useInsertTransaction,
  useUpdateTransaction,
} from "./queries";
import { useFinanceTemplates } from "./templates-queries";

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
  transaction,
}: {
  visible: boolean;
  onClose: () => void;
  defaultTeamId?: string | null;
  transaction?: FinanceTransaction | null;
}) {
  const { data: categories = [] } = useFinanceCategories();
  const { data: teams = [] } = useTeams();
  const { data: accounts = [] } = useAccounts();
  const { data: templates = [] } = useFinanceTemplates();
  const insert = useInsertTransaction();
  const update = useUpdateTransaction();
  const del = useDeleteTransaction();
  const toast = useToast();
  const isEdit = !!transaction;

  const [type, setType] = useState<"income" | "expense" | "refund">("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(defaultTeamId ?? null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [date, setDate] = useState(formatYMD(new Date()));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!visible) return;
    if (transaction) {
      setType(transaction.type === "transfer" ? "expense" : transaction.type);
      setAmount(String(transaction.amount));
      setCategoryId(transaction.category_id ?? null);
      setTeamId(transaction.team_id ?? null);
      setAccountId(transaction.account_id ?? null);
      setPayment((transaction.payment_method as PaymentMethod) ?? "cash");
      setDate(transaction.occurred_on);
      setNotes(transaction.notes ?? "");
    } else {
      setType("expense");
      setAmount("");
      setCategoryId(null);
      setTeamId(defaultTeamId ?? null);
      setAccountId(null);
      setPayment("cash");
      setDate(formatYMD(new Date()));
      setNotes("");
    }
  }, [visible, defaultTeamId, transaction?.id]);

  // Refund relates to income, so it picks income categories.
  const cats = useMemo(
    () =>
      categories.filter((c) =>
        type === "expense" ? c.type === "expense" : c.type === "income",
      ),
    [categories, type],
  );
  // Accounts for the chosen brigade (or all when none selected).
  const teamAccounts = useMemo(
    () => (teamId ? accounts.filter((a) => a.brigade_id === teamId) : accounts),
    [accounts, teamId],
  );

  const amountNum = Number(amount.replace(",", ".")) || 0;
  const busy = insert.isPending || update.isPending;
  const canSave = amountNum > 0 && !busy;
  const isExpense = type === "expense";

  const save = async () => {
    try {
      const draft = {
        amount: amountNum,
        category_id: categoryId,
        team_id: teamId,
        account_id: accountId,
        payment_method: payment,
        notes: notes.trim() || null,
        occurred_on: date,
      };
      if (isEdit && transaction) {
        await update.mutateAsync({ id: transaction.id, patch: draft });
      } else {
        await insert.mutateAsync({ type, ...draft });
      }
      toast(isEdit ? "Сохранено" : "Операция добавлена");
      onClose();
    } catch (e) {
      Alert.alert("Ошибка", (e as Error).message);
    }
  };

  const remove = () => {
    if (!transaction) return;
    Alert.alert("Удалить операцию?", "", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          await del.mutateAsync(transaction.id);
          onClose();
        },
      },
    ]);
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
              {isEdit ? "Операция" : "Новая операция"}
            </Text>
            {isEdit ? (
              <Pressable onPress={remove} hitSlop={8} className="w-10 items-center">
                <Text className="text-sm font-medium text-danger">Удалить</Text>
              </Pressable>
            ) : (
              <View className="w-10" />
            )}
          </View>

          <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
            {/* template quick-chips */}
            {!isEdit && templates.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0, maxHeight: 50 }}
                contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, gap: 8, alignItems: "center" }}
              >
                {templates.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => {
                      setType(t.kind);
                      setAmount(String(t.amount));
                      setCategoryId(t.category_id ?? null);
                      if (t.brigade_id) setTeamId(t.brigade_id);
                      if (t.account_id) setAccountId(t.account_id);
                      if (t.payment_method) setPayment(t.payment_method as PaymentMethod);
                    }}
                    className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 active:opacity-70"
                  >
                    <Text className="text-sm font-medium text-neutral-700">
                      {t.name} · {formatEUR(Number(t.amount))}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {/* type segmented */}
            <View className="mx-3 mt-3 flex-row rounded-xl bg-neutral-200 p-1">
              {(["expense", "income", "refund"] as const).map((t) => {
                const active = type === t;
                const tone =
                  t === "expense"
                    ? "text-danger"
                    : t === "income"
                      ? "text-success"
                      : "text-amber-700";
                const label =
                  t === "expense" ? "Расход" : t === "income" ? "Доход" : "Возврат";
                return (
                  <Pressable
                    key={t}
                    disabled={isEdit}
                    onPress={() => {
                      setType(t);
                      setCategoryId(null);
                    }}
                    className={`flex-1 items-center rounded-lg py-2 ${active ? "bg-white" : ""} ${isEdit && !active ? "opacity-40" : ""}`}
                  >
                    <Text
                      className={`text-sm font-semibold ${active ? tone : "text-neutral-500"}`}
                    >
                      {label}
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
                      onPress={() => {
                        setTeamId(teamId === t.id ? null : t.id);
                        setAccountId(null);
                      }}
                    />
                  ))}
                </ScrollView>
              </SectionCard>
            ) : null}

            {/* account */}
            {teamAccounts.length > 0 ? (
              <SectionCard title="Счёт">
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    gap: 8,
                  }}
                >
                  {teamAccounts.map((a) => (
                    <Chip
                      key={a.id}
                      label={a.name}
                      active={accountId === a.id}
                      onPress={() =>
                        setAccountId(accountId === a.id ? null : a.id)
                      }
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
              label={
                isEdit
                  ? "Сохранить"
                  : isExpense
                    ? "Добавить расход"
                    : type === "income"
                      ? "Добавить доход"
                      : "Добавить возврат"
              }
              onPress={save}
              disabled={!canSave}
              loading={busy}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
