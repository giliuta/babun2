import { type ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

// Base screen wrapper. Encapsulates the SafeAreaView flex/bg (NativeWind v5
// className doesn't apply to wrapper components yet, so the wrapper uses
// inline style ONCE here). The inner View is a core RN component → className
// works, so callers style content via `className`.
export function Screen({
  children,
  className = "",
  edges,
}: {
  children: ReactNode;
  className?: string;
  edges?: readonly Edge[];
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={edges}>
      <View className={`flex-1 ${className}`}>{children}</View>
    </SafeAreaView>
  );
}
