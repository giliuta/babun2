import { type ReactNode } from "react";
import { Text, View, type ViewProps } from "react-native";

// «Halo Cobalt» surfaces — apps/mobile/docs/DESIGN-SYSTEM.md.

// White grouped card: soft neutral elevation + a 1px frosted top-edge highlight
// that reads as glass thickness without a real blur.
export function Card({
  style,
  children,
  ...rest
}: ViewProps & { children?: ReactNode }) {
  return (
    <View
      {...rest}
      style={[
        {
          borderRadius: 20,
          backgroundColor: "#ffffff",
          overflow: "hidden",
          boxShadow:
            "0px 1px 2px rgba(11,18,32,0.04), 0px 8px 24px rgba(11,18,32,0.06)",
        },
        style,
      ]}
    >
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: "rgba(255,255,255,0.9)",
        }}
      />
      {children}
    </View>
  );
}

// Caption eyebrow above a section («ОПЕРАЦИИ», day dividers, settings groups).
export function SectionHeader({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.6,
        color: "#97a0ae",
        textTransform: "uppercase",
        marginTop: 24,
        marginBottom: 8,
        marginLeft: 4,
      }}
    >
      {children}
    </Text>
  );
}
