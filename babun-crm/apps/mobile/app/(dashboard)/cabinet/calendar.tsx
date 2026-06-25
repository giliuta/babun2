import { useEffect, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import {
  DEFAULT_CALENDAR_SETTINGS,
  type CalendarSettings,
} from "@babun/shared/local/calendar-settings";
import { Screen } from "@/components/ui/Screen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { Divider } from "@/components/ui/Divider";
import { Button } from "@/components/ui/Button";
import { COLORS } from "@/components/ui/tokens";
import {
  useCalendarSettings,
  useSaveCalendarSettings,
} from "@/features/settings/local-settings";

function Row({ label, right }: { label: string; right: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between px-1 py-2.5">
      <Text className="text-base text-neutral-900">{label}</Text>
      {right}
    </View>
  );
}

function Stepper({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        className="h-8 w-8 items-center justify-center rounded-full bg-neutral-100 active:opacity-70"
      >
        <Minus color={COLORS.body} size={16} />
      </Pressable>
      <Text className="w-14 text-center text-base font-semibold text-neutral-900 tabular-nums">
        {String(value).padStart(2, "0")}:00
      </Text>
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        className="h-8 w-8 items-center justify-center rounded-full bg-neutral-100 active:opacity-70"
      >
        <Plus color={COLORS.body} size={16} />
      </Pressable>
    </View>
  );
}

export default function CalendarSettingsScreen() {
  const { data: settings } = useCalendarSettings();
  const save = useSaveCalendarSettings();
  const [s, setS] = useState<CalendarSettings>(DEFAULT_CALENDAR_SETTINGS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setS(settings);
      setDirty(false);
    }
  }, [settings]);

  const patch = (p: Partial<CalendarSettings>) => {
    setS((prev) => ({ ...prev, ...p }));
    setDirty(true);
  };

  return (
    <Screen edges={["top"]}>
      <ScreenHeader title="Календарь" />

      <SectionCard title="Рабочие часы (сетка «День»)" padded>
        <Row
          label="Начало"
          right={
            <Stepper
              value={s.workStartHour ?? 6}
              min={0}
              max={(s.workEndHour ?? 22) - 1}
              onChange={(v) => patch({ workStartHour: v })}
            />
          }
        />
        <Divider />
        <Row
          label="Конец"
          right={
            <Stepper
              value={s.workEndHour ?? 22}
              min={(s.workStartHour ?? 6) + 1}
              max={24}
              onChange={(v) => patch({ workEndHour: v })}
            />
          }
        />
      </SectionCard>

      <SectionCard title="Шаг сетки" padded>
        <View className="flex-row gap-2">
          {([15, 30, 60] as const).map((g) => {
            const active = s.gridStep === g;
            return (
              <Pressable
                key={g}
                onPress={() => patch({ gridStep: g })}
                className={`flex-1 items-center rounded-xl py-2.5 ${active ? "bg-brand" : "bg-neutral-100"}`}
              >
                <Text
                  className={`text-sm font-semibold ${active ? "text-white" : "text-neutral-700"}`}
                >
                  {g} мин
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SectionCard>

      <SectionCard title="Отображение" padded>
        <Row
          label="Скрывать отменённые"
          right={
            <Switch
              value={!!s.hideCancelled}
              onValueChange={(v) => patch({ hideCancelled: v })}
              trackColor={{ true: COLORS.brand }}
            />
          }
        />
      </SectionCard>

      <View className="mx-3 mt-5">
        <Button
          label="Сохранить"
          onPress={() => save.mutate(s, { onSuccess: () => setDirty(false) })}
          disabled={!dirty || save.isPending}
          loading={save.isPending}
        />
      </View>
    </Screen>
  );
}
