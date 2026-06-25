import { useState, type ReactElement } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
  type KeyboardTypeOptions,
} from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, Plus } from "lucide-react-native";
import { Screen } from "@/components/ui/Screen";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export interface RefField {
  key: string;
  label: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  required?: boolean;
}

// Generic reference-data screen: header (back + add), a list, and a create
// bottom-sheet with configurable fields. Used by teams / masters / cities.
export function RefListScreen<T extends { id: string }>({
  title,
  items,
  isLoading,
  fields,
  onCreate,
  renderItem,
  emptyText,
}: {
  title: string;
  items: T[];
  isLoading: boolean;
  fields: RefField[];
  onCreate: (values: Record<string, string>) => Promise<void>;
  renderItem: (item: T) => ReactElement;
  emptyText: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const canSubmit = fields
    .filter((f) => f.required)
    .every((f) => (values[f.key] ?? "").trim().length > 0);

  const submit = async () => {
    setBusy(true);
    try {
      await onCreate(values);
      setValues({});
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={["top"]}>
      <View className="flex-row items-center border-b border-neutral-100 px-2 py-2">
        <Pressable
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-lg active:bg-neutral-100"
        >
          <ChevronLeft color="#404040" size={22} />
        </Pressable>
        <Text className="flex-1 text-base font-semibold text-neutral-900">
          {title}
        </Text>
        <Pressable
          onPress={() => setOpen(true)}
          className="h-9 w-9 items-center justify-center rounded-lg active:bg-neutral-100"
        >
          <Plus color="#4338ca" size={22} />
        </Pressable>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => renderItem(item)}
          ItemSeparatorComponent={() => (
            <View className="ml-4 h-px bg-neutral-100" />
          )}
          ListEmptyComponent={
            <View className="items-center pt-20">
              <Text className="text-sm text-neutral-400">{emptyText}</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable className="flex-1 bg-black/30" onPress={() => setOpen(false)} />
        <View className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white p-5 pb-8">
          <Text className="mb-3 text-lg font-bold text-neutral-900">Добавить</Text>
          {fields.map((f, i) => (
            <Field
              key={f.key}
              label={f.label}
              value={values[f.key] ?? ""}
              onChangeText={(v) =>
                setValues((s) => ({ ...s, [f.key]: v }))
              }
              placeholder={f.placeholder}
              keyboardType={f.keyboardType}
              autoFocus={i === 0}
            />
          ))}
          <Button
            label="Создать"
            onPress={submit}
            disabled={!canSubmit || busy}
            loading={busy}
          />
        </View>
      </Modal>
    </Screen>
  );
}
