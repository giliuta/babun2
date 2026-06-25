import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Plus, Trash2 } from "lucide-react-native";
import {
  DEFAULT_LOYALTY,
  generateLoyaltyTierId,
  STARTER_LOYALTY_TIERS,
  type LoyaltySettings,
  type LoyaltyTier,
} from "@babun/shared/local/loyalty";
import { Screen } from "@/components/ui/Screen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { Divider } from "@/components/ui/Divider";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { COLORS, ICON } from "@/components/ui/tokens";
import { useLoyalty, useSaveLoyalty } from "@/features/settings/local-settings";

export default function LoyaltyScreen() {
  const { data } = useLoyalty();
  const save = useSaveLoyalty();
  const [s, setS] = useState<LoyaltySettings>(DEFAULT_LOYALTY);
  const [dirty, setDirty] = useState(false);

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [threshold, setThreshold] = useState("");
  const [percent, setPercent] = useState("");

  useEffect(() => {
    if (data) {
      setS(data);
      setDirty(false);
    }
  }, [data]);

  const patch = (p: Partial<LoyaltySettings>) => {
    setS((prev) => ({ ...prev, ...p }));
    setDirty(true);
  };

  const addTier = () => {
    const t: LoyaltyTier = {
      id: generateLoyaltyTierId(),
      label: label.trim() || "Уровень",
      threshold: Number(threshold) || 0,
      percent: Number(percent) || 0,
    };
    patch({
      tiers: [...s.tiers, t].sort((a, b) => a.threshold - b.threshold),
    });
    setLabel("");
    setThreshold("");
    setPercent("");
    setOpen(false);
  };

  const removeTier = (id: string) =>
    patch({ tiers: s.tiers.filter((t) => t.id !== id) });

  return (
    <Screen edges={["top"]}>
      <ScreenHeader
        title="Лояльность"
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

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <SectionCard padded>
          <View className="flex-row items-center justify-between px-1 py-1">
            <Text className="text-base text-neutral-900">Программа лояльности</Text>
            <Switch
              value={s.enabled}
              onValueChange={(v) => patch({ enabled: v })}
              trackColor={{ true: COLORS.brand }}
            />
          </View>
        </SectionCard>

        <SectionCard title="Уровни — по числу визитов">
          {s.tiers.length === 0 ? (
            <View className="px-4 py-4">
              <Text className="text-sm text-neutral-400">
                Уровней пока нет. Клиент со столькими-то выполненными визитами
                получает скидку.
              </Text>
              <Pressable
                onPress={() =>
                  patch({ tiers: STARTER_LOYALTY_TIERS, enabled: true })
                }
                className="mt-2 active:opacity-70"
              >
                <Text className="text-sm font-medium text-brand">
                  Загрузить пример (3 / 10 / 25 визитов)
                </Text>
              </Pressable>
            </View>
          ) : (
            s.tiers.map((t, i) => (
              <View key={t.id}>
                {i > 0 ? <Divider inset={16} /> : null}
                <View className="flex-row items-center px-4 py-3">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-neutral-900">
                      {t.label}
                    </Text>
                    <Text className="text-sm text-neutral-500">
                      от {t.threshold} визитов
                    </Text>
                  </View>
                  <Text className="mr-3 text-base font-bold text-success">
                    −{t.percent}%
                  </Text>
                  <Pressable onPress={() => removeTier(t.id)} hitSlop={8}>
                    <Trash2 color={COLORS.danger} size={ICON.sm} />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </SectionCard>

        <View className="mx-3 mt-5">
          <Button
            label="Сохранить"
            onPress={() => save.mutate(s, { onSuccess: () => setDirty(false) })}
            disabled={!dirty || save.isPending}
            loading={save.isPending}
          />
        </View>
      </ScrollView>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/30" onPress={() => setOpen(false)} />
        <View className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white p-5 pb-8">
          <Text className="mb-3 text-lg font-bold text-neutral-900">Новый уровень</Text>
          <Field label="Название" value={label} onChangeText={setLabel} placeholder="Серебро" autoFocus />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field
                label="От N визитов"
                value={threshold}
                onChangeText={setThreshold}
                placeholder="10"
                keyboardType="number-pad"
              />
            </View>
            <View className="flex-1">
              <Field
                label="Скидка %"
                value={percent}
                onChangeText={setPercent}
                placeholder="10"
                keyboardType="number-pad"
              />
            </View>
          </View>
          <Button label="Добавить" onPress={addTier} disabled={!threshold.trim()} />
        </View>
      </Modal>
    </Screen>
  );
}
