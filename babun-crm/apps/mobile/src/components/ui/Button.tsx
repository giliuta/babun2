import { ActivityIndicator, Pressable, Text } from "react-native";
import { GradientButton } from "./GradientButton";

type Variant = "primary" | "secondary";

// App-wide button — «Halo Cobalt» (apps/mobile/docs/DESIGN-SYSTEM.md).
// primary → cobalt gradient pill (halo sheen + press dip).
// secondary → clean outline pill on white.
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
  if (variant === "primary") {
    return (
      <GradientButton
        label={label}
        onPress={onPress}
        disabled={disabled}
        loading={loading}
      />
    );
  }

  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      style={{
        height: 52,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#e7ebf0",
        backgroundColor: "#ffffff",
        opacity: isDisabled ? 0.5 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color="#2c5be0" />
      ) : (
        <Text style={{ fontSize: 17, fontWeight: "600", color: "#0b1220" }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
