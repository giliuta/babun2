import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, {
  Defs,
  Line,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

// «Halo Cobalt» auth surfaces — apps/mobile/docs/DESIGN-SYSTEM.md.
// Honest faux-glass (no expo-blur): a cool canvas, one ambient halo as the
// only decorative light, a gradient brand mark + CTA, color = meaning.
const ACCENT = "#2c5be0";
const ACCENT_FROM = "#3e84ff";
const ACCENT_TO = "#1f4fcc";
const CANVAS = "#f4f6f9";
const INK = "#0b1220";
const SUB = "#5b6678";
const FAINT = "#97a0ae";
const SEP = "#e7ebf0";

const FILL = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const;

// The single decorative light source — a soft cobalt bloom from the top.
function AmbientHalo() {
  return (
    <Svg style={FILL} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <RadialGradient id="halo" cx="50%" cy="6%" r="75%">
          <Stop offset="0" stopColor={ACCENT_FROM} stopOpacity={0.12} />
          <Stop offset="1" stopColor={ACCENT_FROM} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={CANVAS} />
      <Rect width="100%" height="100%" fill="url(#halo)" />
    </Svg>
  );
}

// 64×64 gradient tile with a snowflake/AC glyph + wet top sheen — the brand.
function BrandMark() {
  return (
    <View
      style={{
        height: 64,
        width: 64,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0px 8px 28px rgba(44,91,224,0.30)",
      }}
    >
      <Svg width={64} height={64}>
        <Defs>
          <LinearGradient id="mark" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={ACCENT_FROM} />
            <Stop offset="1" stopColor={ACCENT_TO} />
          </LinearGradient>
        </Defs>
        <Rect width={64} height={64} fill="url(#mark)" />
        <Line x1="32" y1="17" x2="32" y2="47" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" opacity={0.95} />
        <Line x1="20" y1="24.5" x2="44" y2="39.5" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" opacity={0.95} />
        <Line x1="20" y1="39.5" x2="44" y2="24.5" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" opacity={0.95} />
      </Svg>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 30, backgroundColor: "rgba(255,255,255,0.16)" }} />
    </View>
  );
}

// Centered auth layout: ambient halo, brand block (mark + wordmark), a
// per-screen title/subtitle, the form children, and a quiet footer. One
// tasteful entrance (fade + 12px rise).
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [enter]);
  const colStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 12 }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: CANVAS }}>
      <AmbientHalo />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: 28,
              paddingTop: 44,
              paddingBottom: 16,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              style={[{ width: "100%", maxWidth: 360, alignSelf: "center" }, colStyle]}
            >
              <View className="items-center">
                <BrandMark />
                <Text style={{ marginTop: 16, fontSize: 34, lineHeight: 40, fontWeight: "800", letterSpacing: -0.6, color: INK }}>
                  Babun
                </Text>
                <Text style={{ marginTop: 2, fontSize: 13, fontWeight: "500", color: FAINT }}>
                  AirFix · Cyprus
                </Text>
                <Text style={{ marginTop: 26, fontSize: 26, lineHeight: 32, fontWeight: "700", letterSpacing: -0.4, color: INK, textAlign: "center" }}>
                  {title}
                </Text>
                <Text style={{ marginTop: 4, fontSize: 15, color: SUB, textAlign: "center" }}>
                  {subtitle}
                </Text>
              </View>
              <View style={{ marginTop: 24 }}>{children}</View>
            </Animated.View>
            <View style={{ flex: 1 }} />
            <Text style={{ textAlign: "center", fontSize: 11, color: FAINT, paddingTop: 24 }}>
              Babun © 2026
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// White grouped card with a frosted top-edge highlight + soft elevation.
export function InputCard({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        borderRadius: 20,
        backgroundColor: "#ffffff",
        overflow: "hidden",
        boxShadow: "0px 1px 2px rgba(11,18,32,0.04), 0px 8px 24px rgba(11,18,32,0.06)",
      }}
    >
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.9)" }} />
      {children}
    </View>
  );
}

// Inset hairline between grouped rows (color, not a border).
export function InputDivider() {
  return <View style={{ marginLeft: 16, height: 1, backgroundColor: SEP }} />;
}

// Full-width accent pill CTA — gradient fill, floating cobalt shadow, a slow
// «halo» sheen sweep, and a press dip. Disabled → flat separator fill.
export function PillButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const filled = loading || !disabled;
  const pressable = !disabled && !loading;
  const [w, setW] = useState(0);
  const scale = useSharedValue(1);
  const sheen = useSharedValue(-160);

  useEffect(() => {
    if (filled && w > 0) {
      sheen.value = -160;
      sheen.value = withRepeat(
        withTiming(w + 60, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
        -1,
        false,
      );
    }
  }, [filled, w, sheen]);

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sheen.value }, { skewX: "-18deg" }],
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
            marginTop: 16,
            height: 52,
            borderRadius: 999,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: filled ? ACCENT_TO : SEP,
            boxShadow: filled ? "0px 8px 28px rgba(44,91,224,0.28)" : undefined,
          },
          scaleStyle,
        ]}
      >
        {filled ? (
          <Svg style={FILL} width="100%" height="100%" pointerEvents="none">
            <Defs>
              <LinearGradient id="cta" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={ACCENT_FROM} />
                <Stop offset="1" stopColor={ACCENT_TO} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#cta)" />
          </Svg>
        ) : null}
        {filled ? (
          <Animated.View
            pointerEvents="none"
            style={[
              { position: "absolute", top: -8, bottom: -8, width: 56, backgroundColor: "rgba(255,255,255,0.18)" },
              sheenStyle,
            ]}
          />
        ) : null}
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ fontSize: 17, fontWeight: "600", color: filled ? "#fff" : FAINT }}>
            {label}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

// Centered accent ghost link below the CTA.
export function GhostLink({
  label,
  onPress,
  muted,
}: {
  label: string;
  onPress: () => void;
  muted?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{ height: 44, alignItems: "center", justifyContent: "center", marginTop: 4 }}
    >
      <Text style={{ fontSize: 14, fontWeight: "500", color: muted ? SUB : ACCENT }}>
        {label}
      </Text>
    </Pressable>
  );
}
