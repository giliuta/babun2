import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Check } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { COLORS, ICON } from "@/components/ui/tokens";
import { formatYMD, parseYMD } from "@/features/appointments/helpers";
import {
  makePeriod,
  PRESET_LABELS,
  PRESET_ORDER,
  type Period,
  type PeriodPreset,
} from "./period";

export function PeriodModal({
  visible,
  current,
  onClose,
  onApply,
}: {
  visible: boolean;
  current: Period;
  onClose: () => void;
  onApply: (p: Period) => void;
}) {
  const [from, setFrom] = useState(current.from);
  const [to, setTo] = useState(current.to);

  const pickPreset = (preset: PeriodPreset) => {
    onApply(makePeriod(preset));
    onClose();
  };

  const applyCustom = () => {
    onApply({ preset: "custom", from, to });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="rounded-t-3xl bg-white p-5 pb-8">
          <Text className="mb-3 text-lg font-bold text-neutral-900">Период</Text>

          {PRESET_ORDER.map((preset) => {
            const active = current.preset === preset;
            return (
              <Pressable
                key={preset}
                onPress={() => pickPreset(preset)}
                className="flex-row items-center justify-between border-b border-neutral-100 py-3 active:opacity-70"
              >
                <Text className="text-base text-neutral-900">
                  {PRESET_LABELS[preset]}
                </Text>
                {active ? <Check color={COLORS.brand} size={ICON.md} /> : null}
              </Pressable>
            );
          })}

          {/* custom range */}
          <View className="mt-4 rounded-2xl bg-neutral-50 p-3">
            <Text className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Свой период
            </Text>
            <View className="flex-row items-center justify-between py-1.5">
              <Text className="text-base text-neutral-900">С</Text>
              <DateTimePicker
                value={parseYMD(from)}
                mode="date"
                display="compact"
                onChange={(_, d) => d && setFrom(formatYMD(d))}
              />
            </View>
            <View className="flex-row items-center justify-between py-1.5">
              <Text className="text-base text-neutral-900">По</Text>
              <DateTimePicker
                value={parseYMD(to)}
                mode="date"
                display="compact"
                onChange={(_, d) => d && setTo(formatYMD(d))}
              />
            </View>
            <View className="mt-2">
              <Button label="Применить период" onPress={applyCustom} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
