import { useMemo, useState } from "react";
import { Alert, FlatList, Modal, Pressable, Text, View } from "react-native";
import { Plus, Trash2 } from "lucide-react-native";
import type { FinanceCategory } from "@babun/shared/db/repositories/finance-categories";
import { Screen } from "@/components/ui/Screen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Divider } from "@/components/ui/Divider";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { COLORS, ICON } from "@/components/ui/tokens";
import {
  useDeleteCategory,
  useFinanceCategories,
  useInsertCategory,
} from "@/features/finances/queries";

const SWATCHES = [
  "#ef4444", "#f97316", "#eab308", "#10b981", "#06b6d4",
  "#4338ca", "#a855f7", "#ec4899", "#737373",
];

export default function CategoriesScreen() {
  const { data: cats = [], isLoading } = useFinanceCategories();
  const insert = useInsertCategory();
  const del = useDeleteCategory();

  const [type, setType] = useState<"expense" | "income">("expense");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[5]);

  const filtered = useMemo(
    () => cats.filter((c) => c.type === type),
    [cats, type],
  );

  const add = async () => {
    if (!name.trim()) return;
    await insert.mutateAsync({ name: name.trim(), type, color });
    setName("");
    setOpen(false);
  };

  const confirmDelete = (c: FinanceCategory) => {
    if (!c.tenant_id) {
      Alert.alert("Системная категория", "Стандартную категорию нельзя удалить.");
      return;
    }
    Alert.alert("Удалить категорию?", c.name, [
      { text: "Отмена", style: "cancel" },
      { text: "Удалить", style: "destructive", onPress: () => del.mutate(c.id) },
    ]);
  };

  return (
    <Screen edges={["top"]}>
      <ScreenHeader
        title="Категории"
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

      <View className="mx-4 mt-3 flex-row rounded-xl bg-neutral-200 p-1">
        {(["expense", "income"] as const).map((t) => {
          const active = type === t;
          return (
            <Pressable
              key={t}
              onPress={() => setType(t)}
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
                {t === "expense" ? "Расходы" : "Доходы"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <EmptyState state="loading" fill />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ flexGrow: 1, paddingTop: 8 }}
          renderItem={({ item }) => (
            <View className="flex-row items-center px-4 py-3">
              <View
                className="mr-3 h-7 w-7 rounded-full"
                style={{ backgroundColor: item.color ?? COLORS.faint }}
              />
              <Text className="flex-1 text-base text-neutral-900">{item.name}</Text>
              {item.tenant_id ? (
                <Pressable onPress={() => confirmDelete(item)} hitSlop={8}>
                  <Trash2 color={COLORS.danger} size={ICON.sm} />
                </Pressable>
              ) : (
                <Text className="text-xs text-neutral-300">станд.</Text>
              )}
            </View>
          )}
          ItemSeparatorComponent={() => <Divider inset={56} />}
          ListEmptyComponent={
            <EmptyState fill title="Нет категорий — добавьте через +" />
          }
        />
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/30" onPress={() => setOpen(false)} />
        <View className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white p-5 pb-8">
          <Text className="mb-3 text-lg font-bold text-neutral-900">
            Новая категория · {type === "expense" ? "расход" : "доход"}
          </Text>
          <Field
            label="Название"
            value={name}
            onChangeText={setName}
            placeholder="Напр. Бензин"
            autoFocus
          />
          <Text className="mb-2 text-xs font-medium text-neutral-500">Цвет</Text>
          <View className="mb-4 flex-row flex-wrap gap-3">
            {SWATCHES.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                className={`h-9 w-9 rounded-full ${color === c ? "border-2 border-neutral-900" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </View>
          <Button
            label="Создать"
            onPress={add}
            disabled={!name.trim() || insert.isPending}
            loading={insert.isPending}
          />
        </View>
      </Modal>
    </Screen>
  );
}
