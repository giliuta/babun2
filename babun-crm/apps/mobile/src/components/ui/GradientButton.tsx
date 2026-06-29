import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

// The «Halo Cobalt» primary action — full-width cobalt-gradient pill with a
// floating accent shadow, a slow halo sheen sweep, and a press dip. The ONLY
// gradient surface in the app besides the logo/FAB. apps/mobile/docs/DESIGN-SYSTEM.md.
const FILL = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const;

export function GradientButton({
  label,
  onPress,
  disabled,
  loading,
  sheen = true,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  sheen?: boolean;
}) {
  const filled = loading || !disabled;
  const pressable = !disabled && !loading;
  const [w, setW] = useState(0);
  const scale = useSharedValue(1);
  const sweep = useSharedValue(-160);

  useEffect(() => {
    if (filled && sheen && w > 0) {
      sweep.value = -160;
      sweep.value = withRepeat(
        withTiming(w + 60, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
        -1,
        false,
      );
    }
  }, [filled, sheen, w, sweep]);

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweep.value }, { skewX: "-18deg" }],
  }));

  return (
    <Pressable
      onPress={pressable ? onPress : undefined}
      onPressIn={() => {
        if (pressable) scale.value = withTiming(0.97, { duration: 120 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 16 });
      }}
      disabled={!pressable}
    >
      <Animated.View
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={[
          {
            height: 52,
            borderRadius: 999,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: filled ? "#1f4fcc" : "#e7ebf0",
            boxShadow: filled ? "0px 8px 28px rgba(44,91,224,0.28)" : undefined,
          },
          scaleStyle,
        ]}
      >
        {filled ? (
          <Svg style={FILL} width="100%" height="100%" pointerEvents="none">
            <Defs>
              <LinearGradient id="gbtn" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#3e84ff" />
                <Stop offset="1" stopColor="#1f4fcc" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#gbtn)" />
          </Svg>
        ) : null}
        {filled && sheen ? (
          <Animated.View
            pointerEvents="none"
            style={[
              { position: "absolute", top: -8, bottom: -8, width: 56, backgroundColor: "rgba(255,255,255,0.18)" },
              sweepStyle,
            ]}
          />
        ) : null}
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ fontSize: 17, fontWeight: "600", color: filled ? "#fff" : "#97a0ae" }}>
            {label}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}
