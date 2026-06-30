import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useThemeColors } from "@/theme/colors";

// The single decorative light source of «Halo Cobalt» — a soft cobalt bloom
// from the top. Drop as the first child of a flex:1 screen container that has
// the canvas background; the halo refracts through surfaces below it. Bloom
// opacity follows the theme (dark needs a stronger bloom). DESIGN-SYSTEM.md.
export function Halo({ intensity }: { intensity?: number }) {
  const t = useThemeColors();
  const op = intensity ?? t.haloOpacity;
  return (
    <Svg
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      width="100%"
      height="100%"
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id="screenHalo" cx="50%" cy="0%" r="70%">
          <Stop offset="0" stopColor={t.accentFrom} stopOpacity={op} />
          <Stop offset="1" stopColor={t.accentFrom} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#screenHalo)" />
    </Svg>
  );
}
