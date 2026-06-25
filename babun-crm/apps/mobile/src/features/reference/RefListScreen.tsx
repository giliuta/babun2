import { useState, type ReactElement } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
  type KeyboardTypeOptions,
} from "react-native";
import { Plus } from "lucide-react-native";
import { Screen } from "@/components/ui/Screen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Divider } from "@/components/ui/Divider";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { COLORS, ICON } from "@/components/ui/tokens";

export interface RefField {
  key: string;
  label: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  required?: boolean;
}

// Generic reference-data screen: list + create/edit bottom-sheet + delete.
// When itemToValues + onUpdate are provided, tapping a row opens it for edit.
export function RefListScreen<T extends { id: string }>({
  title,
  items,
  isLoading,
  fields,
  onCreate,
  onUpdate,
  onDelete,
  itemToValues,
  renderItem,
  emptyText,
}: {
  title: string;
  items: T[];
  isLoading: boolean;
  fields: RefField[];
  onCreate: (values: Record<string, string>) => Promise<void>;
  onUpdate?: (id: string, values: Record<string, string>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  itemToValues?: (item: T) => Record<string, string>;
  renderItem: (item: T) => ReactElement;
  emptyText: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const editable = !!(itemToValues && onUpdate);
  const canSubmit = fields
    .filter((f) => f.required)
    .every((f) => (values[f.key] ?? "").trim().length > 0);

  const openCreate = () => {
    setEditing(null);
    setValues({});
    setOpen(true);
  };
  const openEdit = (item: T) => {
    setEditing(item);
    setValues(itemToValues ? itemToValues(item) : {});
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setEditing(null);
  };

  const submit = async () => {
    setBusy(true);
    try {
      if (editing && onUpdate) await onUpdate(editing.id, values);
      else await onCreate(values);
      close();
      setValues({});
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!editing || !onDelete) return;
    Alert.alert("Удалить?", "Запись будет скрыта из списка.", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await onDelete(editing.id);
            close();
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <Screen edges={["top"]}>
      <ScreenHeader
        title={title}
        right={
          <Pressable
            onPress={openCreate}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-neutral-100"
          >
            <Plus color={COLORS.brand} size={ICON.md} />
          </Pressable>
        }
      />

      {isLoading ? (
        <EmptyState state="loading" fill />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ flexGrow: 1 }}
          renderItem={({ item }) =>
            editable ? (
              <Pressable
                onPress={() => openEdit(item)}
                className="active:bg-neutral-50"
              >
                {renderItem(item)}
              </Pressable>
            ) : (
              renderItem(item)
            )
          }
          ItemSeparatorComponent={() => <Divider inset={16} />}
          ListEmptyComponent={<EmptyState fill title={emptyText} />}
        />
      )}

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        <Pressable className="flex-1 bg-black/30" onPress={close} />
        <View className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white p-5 pb-8">
          <Text className="mb-3 text-lg font-bold text-neutral-900">
            {editing ? "Изменить" : "Добавить"}
          </Text>
          {fields.map((f, i) => (
            <Field
              key={f.key}
              label={f.label}
              value={values[f.key] ?? ""}
              onChangeText={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
              placeholder={f.placeholder}
              keyboardType={f.keyboardType}
              autoFocus={i === 0}
            />
          ))}
          <Button
            label={editing ? "Сохранить" : "Создать"}
            onPress={submit}
            disabled={!canSubmit || busy}
            loading={busy}
          />
          {editing && onDelete ? (
            <Pressable
              onPress={remove}
              className="mt-1 items-center py-3 active:opacity-70"
            >
              <Text className="text-base font-medium text-danger">Удалить</Text>
            </Pressable>
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}
