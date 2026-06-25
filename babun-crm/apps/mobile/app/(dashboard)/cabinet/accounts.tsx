import { useMemo, useState } from "react";
import { Alert, FlatList, Modal, Pressable, Text, View } from "react-native";
import {
  Banknote,
  CreditCard,
  Landmark,
  Plus,
  Wallet,
  type LucideIcon,
} from "lucide-react-native";
import { formatEUR } from "@babun/shared/common/utils/money";
import type { AccountKind } from "@babun/shared/local/finance/account";
import { Screen } from "@/components/ui/Screen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Divider } from "@/components/ui/Divider";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { COLORS, ICON } from "@/components/ui/tokens";
import { useTeams } from "@/features/reference/queries";
import {
  useAccountsWithBalances,
  useInsertAccount,
  useSoftCloseAccount,
  type AccountWithBalance,
} from "@/features/finances/accounts";

const KIND_ICON: Record<AccountKind, LucideIcon> = {
  cash: Banknote,
  card: CreditCard,
  bank: Landmark,
  other: Wallet,
};
const KINDS: { value: AccountKind; label: string }[] = [
  { value: "cash", label: "Наличные" },
  { value: "card", label: "Карта" },
  { value: "bank", label: "Банк" },
  { value: "other", label: "Другое" },
];

export default function AccountsScreen() {
  const { data: accounts = [], isLoading } = useAccountsWithBalances();
  const { data: teams = [] } = useTeams();
  const insert = useInsertAccount();
  const closeAcc = useSoftCloseAccount();

  const teamName = useMemo(
    () => new Map(teams.map((t) => [t.id, t.name])),
    [teams],
  );
  const total = useMemo(
    () => accounts.reduce((s, a) => s + a.balance, 0),
    [accounts],
  );

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("cash");
  const [brigadeId, setBrigadeId] = useState<string | null>(null);
  const [opening, setOpening] = useState("");

  const reset = () => {
    setName("");
    setKind("cash");
    setBrigadeId(null);
    setOpening("");
  };
  const canSave = !!name.trim() && !!brigadeId && !insert.isPending;

  const add = async () => {
    if (!brigadeId) return;
    await insert.mutateAsync({
      name: name.trim(),
      kind,
      brigade_id: brigadeId,
      opening_balance: Number(opening.replace(",", ".")) || 0,
    });
    reset();
    setOpen(false);
  };

  const confirmClose = (a: AccountWithBalance) =>
    Alert.alert("Закрыть счёт?", `${a.name} — история сохранится`, [
      { text: "Отмена", style: "cancel" },
      { text: "Закрыть", style: "destructive", onPress: () => closeAcc.mutate(a.id) },
    ]);

  return (
    <Screen edges={["top"]}>
      <ScreenHeader
        title="Счета"
        right={
          <Pressable
            onPress={() => setOpen(true)}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-neutral-100"
          >
            <Plus color={COLORS.brand} size={ICON.md} />
          </Pressable>
        }
      />

      <View className="mx-3 mt-2 rounded-2xl bg-white p-4 shadow-sm">
        <Text className="text-xs text-neutral-500">Всего на счетах</Text>
        <Text
          className="mt-0.5 text-2xl font-bold"
          style={{ color: COLORS.brandAccent }}
        >
          {formatEUR(total)}
        </Text>
      </View>

      {isLoading ? (
        <EmptyState state="loading" fill />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={accounts}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ flexGrow: 1, paddingTop: 8 }}
          renderItem={({ item }) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <Pressable
                onLongPress={() => confirmClose(item)}
                className="flex-row items-center px-4 py-3 active:bg-neutral-50"
              >
                <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-brand/10">
                  <Icon color={COLORS.brand} size={ICON.sm} />
                </View>
                <View className="flex-1 pr-2">
                  <Text className="text-base font-semibold text-neutral-900" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text className="text-xs text-neutral-500">
                    {teamName.get(item.brigade_id) ?? "—"}
                  </Text>
                </View>
                <Text className="text-base font-bold text-neutral-900 tabular-nums">
                  {formatEUR(item.balance)}
                </Text>
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <Divider inset={64} />}
          ListEmptyComponent={
            <EmptyState
              fill
              title="Нет счетов"
              subtitle="Добавьте кассу или карту бригады через +"
            />
          }
        />
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/30" onPress={() => setOpen(false)} />
        <View className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white p-5 pb-8">
          <Text className="mb-3 text-lg font-bold text-neutral-900">Новый счёт</Text>
          <Field
            label="Название"
            value={name}
            onChangeText={setName}
            placeholder="Напр. Касса"
            autoFocus
          />
          <Text className="mb-2 text-xs font-medium text-neutral-500">Тип</Text>
          <View className="mb-3 flex-row flex-wrap gap-2">
            {KINDS.map((k) => (
              <Pressable
                key={k.value}
                onPress={() => setKind(k.value)}
                className={`rounded-full px-3.5 py-1.5 ${kind === k.value ? "bg-brand" : "bg-neutral-100"}`}
              >
                <Text className={`text-sm font-medium ${kind === k.value ? "text-white" : "text-neutral-700"}`}>
                  {k.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text className="mb-2 text-xs font-medium text-neutral-500">Бригада</Text>
          {teams.length === 0 ? (
            <Text className="mb-3 text-sm text-neutral-400">
              Сначала добавьте команду в справочниках.
            </Text>
          ) : (
            <View className="mb-3 flex-row flex-wrap gap-2">
              {teams.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => setBrigadeId(t.id)}
                  className={`rounded-full px-3.5 py-1.5 ${brigadeId === t.id ? "bg-brand" : "bg-neutral-100"}`}
                >
                  <Text className={`text-sm font-medium ${brigadeId === t.id ? "text-white" : "text-neutral-700"}`}>
                    {t.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          <Field
            label="Начальный баланс €"
            value={opening}
            onChangeText={setOpening}
            placeholder="0"
            keyboardType="decimal-pad"
          />
          <Button
            label="Создать"
            onPress={add}
            disabled={!canSave}
            loading={insert.isPending}
          />
        </View>
      </Modal>
    </Screen>
  );
}
