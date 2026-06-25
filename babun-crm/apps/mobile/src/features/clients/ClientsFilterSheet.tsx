import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import type { ClientTag } from "@babun/shared/local/clients";
import { Button } from "@/components/ui/Button";
import {
  EMPTY_FILTER,
  STATUS_OPTIONS,
  type ClientsFilter,
} from "./filter";

function Chip({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active: boolean;
  color?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`mb-2 mr-2 flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${
        active ? "border-brand bg-brand/10" : "border-neutral-200 bg-white"
      }`}
    >
      {color ? (
        <View
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }}
        />
      ) : null}
      <Text
        className={`text-sm font-medium ${active ? "text-brand" : "text-neutral-700"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="pt-3">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {title}
      </Text>
      <View className="flex-row flex-wrap">{children}</View>
    </View>
  );
}

export function ClientsFilterSheet({
  visible,
  filter,
  onChange,
  onClose,
  tags,
  cities,
}: {
  visible: boolean;
  filter: ClientsFilter;
  onChange: (f: ClientsFilter) => void;
  onClose: () => void;
  tags: ClientTag[];
  cities: string[];
}) {
  const toggleTag = (id: string) =>
    onChange({
      ...filter,
      tagIds: filter.tagIds.includes(id)
        ? filter.tagIds.filter((x) => x !== id)
        : [...filter.tagIds, id],
    });
  const toggleCity = (c: string) =>
    onChange({
      ...filter,
      cities: filter.cities.includes(c)
        ? filter.cities.filter((x) => x !== c)
        : [...filter.cities, c],
    });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-black/30" onPress={onClose} />
      <View className="absolute bottom-0 left-0 right-0 max-h-[80%] rounded-t-3xl bg-white">
        <View className="items-center pt-2">
          <View className="h-1 w-10 rounded-full bg-neutral-300" />
        </View>
        <View className="flex-row items-center justify-between px-5 py-3">
          <Text className="text-lg font-bold text-neutral-900">Фильтры</Text>
          <Pressable onPress={() => onChange(EMPTY_FILTER)}>
            <Text className="text-sm font-medium text-brand">Сбросить</Text>
          </Pressable>
        </View>

        <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 8 }}>
          <Section title="Статус">
            {STATUS_OPTIONS.map((s) => (
              <Chip
                key={s.key}
                label={s.label}
                active={filter.status === s.key}
                onPress={() => onChange({ ...filter, status: s.key })}
              />
            ))}
          </Section>

          {tags.length ? (
            <Section title="Тег">
              {tags.map((t) => (
                <Chip
                  key={t.id}
                  label={t.name}
                  color={t.color}
                  active={filter.tagIds.includes(t.id)}
                  onPress={() => toggleTag(t.id)}
                />
              ))}
            </Section>
          ) : null}

          {cities.length ? (
            <Section title="Город">
              {cities.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  active={filter.cities.includes(c)}
                  onPress={() => toggleCity(c)}
                />
              ))}
            </Section>
          ) : null}
        </ScrollView>

        <View className="border-t border-neutral-100 p-4">
          <Button label="Показать" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
