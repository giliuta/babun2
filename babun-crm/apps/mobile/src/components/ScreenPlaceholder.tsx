import { Text } from "react-native";
import { Screen } from "@/components/ui/Screen";

// Phase 0 stub. Each tab gets its real screen in its dedicated phase.
export function ScreenPlaceholder({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <Screen className="items-center justify-center px-6">
      <Text className="mb-2 text-2xl font-bold text-neutral-900">{title}</Text>
      <Text className="text-center text-sm text-neutral-500">
        {subtitle ?? "Phase 0 — экран будет реализован в своей фазе."}
      </Text>
    </Screen>
  );
}
