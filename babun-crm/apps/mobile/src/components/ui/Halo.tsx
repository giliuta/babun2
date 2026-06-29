import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

// The single decorative light source of «Halo Cobalt» — a soft cobalt bloom
// from the top. Drop as the first child of a flex:1 screen container that has
// the canvas (#f4f6f9) background; the halo refracts through surfaces below it.
// apps/mobile/docs/DESIGN-SYSTEM.md.
export function Halo({ intensity = 0.1 }: { intensity?: number }) {
  return (
    <Svg
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      width="100%"
      height="100%"
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id="screenHalo" cx="50%" cy="0%" r="70%">
          <Stop offset="0" stopColor="#3e84ff" stopOpacity={intensity} />
          <Stop offset="1" stopColor="#3e84ff" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#screenHalo)" />
    </Svg>
  );
}
