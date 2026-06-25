import { ActivityIndicator, Pressable, Text } from "react-native";

type Variant = "primary" | "secondary";

export function Button({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
}) {
  const isDisabled = disabled || loading;
  const base = "items-center rounded-xl py-4";
  const cls =
    variant === "primary"
      ? `${base} ${isDisabled ? "bg-neutral-300" : "bg-brand"}`
      : `${base} border border-neutral-300`;
  const textCls = variant === "primary" ? "text-white" : "text-neutral-900";

  return (
    <Pressable onPress={onPress} disabled={isDisabled} className={cls}>
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : "#4338ca"} />
      ) : (
        <Text className={`text-base font-semibold ${textCls}`}>{label}</Text>
      )}
    </Pressable>
  );
}
