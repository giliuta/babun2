import { useColorScheme } from "react-native";

// «Halo Cobalt» auth palette — light + dark token inversion (DESIGN-SYSTEM §1
// «no component rebuild»). Components read these via useAuthTheme() so the auth
// flow respects the system appearance.
export type AuthTheme = {
  dark: boolean;
  statusBar: "dark" | "light";
  canvas: string;
  surface: string;
  accent: string;
  accentFrom: string;
  accentTo: string;
  ink: string;
  sub: string;
  placeholder: string;
  separator: string;
  danger: string;
  onAccent: string;
  haloOpacity: number;
  cardShadow?: string;
  brandShadow: string;
  highlight: string;
  disabledFill: string;
  googleBg: string;
  googleBorder: string;
  googleText: string;
};

const light: AuthTheme = {
  dark: false,
  statusBar: "dark",
  canvas: "#f4f6f9",
  surface: "#ffffff",
  accent: "#2c5be0",
  accentFrom: "#3e84ff",
  accentTo: "#1f4fcc",
  ink: "#0b1220",
  sub: "#5b6678",
  placeholder: "#8b94a3",
  separator: "#e7ebf0",
  danger: "#f0473c",
  onAccent: "#ffffff",
  haloOpacity: 0.12,
  cardShadow: "0px 1px 2px rgba(11,18,32,0.04), 0px 8px 24px rgba(11,18,32,0.06)",
  brandShadow: "0px 8px 28px rgba(44,91,224,0.28)",
  highlight: "rgba(255,255,255,0.9)",
  disabledFill: "#dde3ea",
  googleBg: "#ffffff",
  googleBorder: "#d9dee5",
  googleText: "#1f1f1f",
};

const dark: AuthTheme = {
  dark: true,
  statusBar: "light",
  canvas: "#0b0e14",
  surface: "#161b24",
  accent: "#5a86ff",
  accentFrom: "#5a86ff",
  accentTo: "#2c5be0",
  ink: "#f2f5f9",
  sub: "#9ba6b6",
  placeholder: "#5e6878",
  separator: "rgba(255,255,255,0.10)",
  danger: "#ff6b68",
  onAccent: "#ffffff",
  haloOpacity: 0.18,
  cardShadow: undefined, // dark surfaces lift by tone, not grey shadow
  brandShadow: "0px 8px 28px rgba(90,134,255,0.34)",
  highlight: "rgba(255,255,255,0.06)",
  disabledFill: "#222834",
  googleBg: "#131314",
  googleBorder: "#3a3f47",
  googleText: "#e3e3e3",
};

export function useAuthTheme(): AuthTheme {
  return useColorScheme() === "dark" ? dark : light;
}
