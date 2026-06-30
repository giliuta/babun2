import { useMemo, useState } from "react";
import { Pressable, ScrollView, SectionList, Share, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronDown, ChevronRight, Plus, Share2 } from "lucide-react-native";
import {
  formatEUR,
  formatEURSigned,
} from "@babun/shared/common/utils/money";
import {
  signedAmount,
  type FinanceTransaction,
} from "@babun/shared/local/finance/transaction";
import { Screen } from "@/components/ui/Screen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useThemeColors } from "@/theme/colors";
import { humanDay } from "@/features/appointments/helpers";
import { useTeams } from "@/features/reference/queries";
import {
  useFinanceCategories,
  useTransactions,
} from "@/features/finances/queries";
import { OperationSheet } from "@/features/finances/OperationSheet";
import { ProfitBreakdown } from "@/features/finances/ProfitBreakdown";
import { PeriodModal } from "@/features/finances/PeriodModal";
import { useAccountsWithBalances } from "@/features/finances/accounts";
import {
  defaultPeriod,
  periodLabel,
  type Period,
} from "@/features/finances/period";

const TYPE_LABEL: Record<FinanceTransaction["type"], string> = {
  income: "Доход",
  expense: "Расход",
  transfer: "Перевод",
  refund: "Возврат",
};

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  const t = useThemeColors();
  return (
    <View className="flex-1">
      <Text className="text-xs" style={{ color: t.sub }}>
        {label}
      </Text>
      <Text className="mt-0.5 text-lg font-bold" style={{ color: tone }}>
        {value}
      </Text>
    </View>
  );
}

function TxRow({ tx, onPress }: { tx: FinanceTransaction; onPress: () => void }) {
  const t = useThemeColors();
  const signed = signedAmount(tx);
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3 active:opacity-60"
      style={{ backgroundColor: t.surface }}
    >
      <View className="flex-1 pr-3">
        <Text className="text-base" style={{ color: t.ink }} numberOfLines={1}>
          {tx.notes || TYPE_LABEL[tx.type]}
        </Text>
        <Text className="text-xs" style={{ color: t.faint }}>
          {TYPE_LABEL[tx.type]}
        </Text>
      </View>
      <Text
        className="text-base font-semibold tabular-nums"
        style={{ color: signed >= 0 ? t.success : t.danger }}
      >
        {formatEURSigned(signed)}
      </Text>
    </Pressable>
  );
}

export default function FinancesTab() {
  const t = useThemeColors();
  const [period, setPeriod] = useState<Period>(defaultPeriod());
  const [scope, setScope] = useState<string | null>(null);
  const [opOpen, setOpOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<FinanceTransaction | null>(null);
  const [finView, setFinView] = useState<"feed" | "breakdown">("feed");
  const { data: categories = [] } = useFinanceCategories();
  const [periodOpen, setPeriodOpen] = useState(false);

  const router = useRouter();
  const { data: teams = [] } = useTeams();
  const { data: accounts = [] } = useAccountsWithBalances();
  const accountsTotal = useMemo(
    () => accounts.reduce((s, a) => s + a.balance, 0),
    [accounts],
  );
  const {
    data: txs = [],
    isLoading,
    error,
  } = useTransactions(period.from, period.to, scope ? [scope] : undefined);

  const { income, expense, profit } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of txs) {
      if (t.type === "income") income += t.amount;
      else if (t.type === "expense") expense += t.amount;
    }
    return { income, expense, profit: income - expense };
  }, [txs]);

  const sections = useMemo(() => {
    const byDate = new Map<string, FinanceTransaction[]>();
    for (const t of txs) {
      const arr = byDate.get(t.occurred_on) ?? [];
      arr.push(t);
      byDate.set(t.occurred_on, arr);
    }
    return [...byDate.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, data]) => ({
        title: date,
        net: data.reduce((s, t) => s + signedAmount(t), 0),
        data,
      }));
  }, [txs]);


  const controls = (
    <View>
      {/* period selector */}
      <Pressable
        onPress={() => setPeriodOpen(true)}
        className="mx-4 mb-1 mt-1 flex-row items-center self-start rounded-full px-3 py-1.5 active:opacity-80"
        style={{ backgroundColor: t.dark ? "rgba(255,255,255,0.07)" : "#eef1f5" }}
      >
        <Text className="text-sm font-semibold" style={{ color: t.ink }}>
          {periodLabel(period)}
        </Text>
        <ChevronDown color={t.sub} size={16} />
      </Pressable>

      {/* team scope */}
      {teams.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, maxHeight: 48 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: "center" }}
        >
          {[{ id: null as string | null, name: "Все" }, ...teams].map((team) => {
            const active = scope === team.id;
            return (
              <Pressable
                key={team.id ?? "all"}
                onPress={() => setScope(team.id)}
                className="rounded-full px-3.5 py-1.5"
                style={{
                  backgroundColor: active
                    ? t.accent
                    : t.dark
                      ? "rgba(255,255,255,0.07)"
                      : "#eef1f5",
                }}
              >
                <Text
                  className="text-sm font-medium"
                  style={{ color: active ? t.onAccent : t.sub }}
                >
                  {team.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );

  const feedHeader = (
    <View>
      {/* overview */}
      <View
        className="mx-4 mb-2 mt-1 rounded-2xl p-4 shadow-sm"
        style={{ backgroundColor: t.surface }}
      >
        <View className="flex-row">
          <Metric label="Доход" value={formatEUR(income)} tone={t.success} />
          <Metric label="Расход" value={formatEUR(expense)} tone={t.danger} />
        </View>
        <View className="my-3 h-px" style={{ backgroundColor: t.separator }} />
        <View className="flex-row items-center justify-between">
          <Text className="text-sm" style={{ color: t.sub }}>
            Прибыль
          </Text>
          <Text className="text-xl font-bold" style={{ color: t.brandAccent }}>
            {formatEUR(profit)}
          </Text>
        </View>
        {accounts.length > 0 ? (
          <>
            <View className="my-3 h-px" style={{ backgroundColor: t.separator }} />
            <Pressable
              onPress={() => router.push("/cabinet/accounts")}
              className="flex-row items-center justify-between active:opacity-70"
            >
              <Text className="text-sm" style={{ color: t.sub }}>
                Счета
              </Text>
              <View className="flex-row items-center gap-1">
                <Text
                  className="text-base font-semibold tabular-nums"
                  style={{ color: t.ink }}
                >
                  {formatEUR(accountsTotal)}
                </Text>
                <ChevronRight color={t.chevron} size={16} />
              </View>
            </Pressable>
          </>
        ) : null}
      </View>

      <Text
        className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider"
        style={{ color: t.sub }}
      >
        Операции · {txs.length}
      </Text>
    </View>
  );

  const exportCsv = async () => {
    if (txs.length === 0) return;
    const catName = new Map(categories.map((c) => [c.id, c.name]));
    const header = "Дата;Тип;Категория;Сумма;Заметка";
    const rows = txs.map((t) =>
      [
        t.occurred_on,
        TYPE_LABEL[t.type],
        t.category_id ? catName.get(t.category_id) ?? "" : "",
        String(t.amount),
        (t.notes ?? "").replace(/[;\n\r]/g, " "),
      ].join(";"),
    );
    await Share.share({
      message: [header, ...rows].join("\n"),
      title: `Финансы ${period.from} – ${period.to}`,
    });
  };

  const toggleSegmented = (
    <View
      className="flex-row rounded-lg p-0.5"
      style={{ backgroundColor: t.dark ? "rgba(255,255,255,0.07)" : "#eef1f5" }}
    >
      {(["feed", "breakdown"] as const).map((v) => (
        <Pressable
          key={v}
          onPress={() => setFinView(v)}
          className="rounded-md px-2.5 py-1"
          style={finView === v ? { backgroundColor: t.surface } : undefined}
        >
          <Text
            className="text-xs font-semibold"
            style={{ color: finView === v ? t.ink : t.sub }}
          >
            {v === "feed" ? "Операции" : "Разбор"}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const headerRight = (
    <View className="flex-row items-center gap-2">
      <Pressable
        onPress={exportCsv}
        hitSlop={8}
        className="h-9 w-9 items-center justify-center rounded-full active:opacity-60"
      >
        <Share2 color={t.body} size={18} />
      </Pressable>
      {toggleSegmented}
    </View>
  );

  return (
    <Screen>
      <ScreenHeader large title="Финансы" right={headerRight} />
      {controls}

      {isLoading ? (
        <EmptyState state="loading" fill />
      ) : error ? (
        <EmptyState state="error" fill subtitle={(error as Error).message} />
      ) : finView === "breakdown" ? (
        <ProfitBreakdown transactions={txs} categories={categories} />
      ) : (
        <SectionList
          style={{ flex: 1 }}
          sections={sections}
          keyExtractor={(t) => t.id}
          ListHeaderComponent={feedHeader}
          contentContainerStyle={{ paddingBottom: 96 }}
          renderSectionHeader={({ section }) => (
            <View
              className="flex-row items-center justify-between px-4 py-1.5"
              style={{ backgroundColor: t.canvas }}
            >
              <Text
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: t.sub }}
              >
                {humanDay(section.title)}
              </Text>
              <Text
                className="text-xs font-semibold tabular-nums"
                style={{ color: t.sub }}
              >
                {formatEURSigned(section.net)}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TxRow
              tx={item}
              onPress={() => {
                setEditingTx(item);
                setOpOpen(true);
              }}
            />
          )}
          ItemSeparatorComponent={() => (
            <View className="ml-4 h-px" style={{ backgroundColor: t.separator }} />
          )}
          ListEmptyComponent={
            <EmptyState
              title="Нет операций за период"
              subtitle="Нажмите + чтобы добавить"
            />
          }
        />
      )}

      <Pressable
        onPress={() => {
          setEditingTx(null);
          setOpOpen(true);
        }}
        className="absolute bottom-6 right-5 h-14 w-14 items-center justify-center rounded-full active:opacity-90"
        style={{
          backgroundColor: t.accent,
          shadowColor: t.accent,
          shadowOpacity: 0.3,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <Plus color={t.onAccent} size={28} />
      </Pressable>

      <OperationSheet
        visible={opOpen}
        onClose={() => {
          setOpOpen(false);
          setEditingTx(null);
        }}
        defaultTeamId={scope}
        transaction={editingTx}
      />
      <PeriodModal
        visible={periodOpen}
        current={period}
        onClose={() => setPeriodOpen(false)}
        onApply={setPeriod}
      />
    </Screen>
  );
}
