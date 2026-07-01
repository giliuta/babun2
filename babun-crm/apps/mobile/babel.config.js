// NativeWind v5 + Expo Router babel config.
//
//   * "nativewind/babel" (= react-native-css/babel) is a babel-PLUGIN-based
//     transform in v5 — NO `jsxImportSource` needed (that was the v4 way,
//     and v5 doesn't ship nativewind/jsx-runtime).
//   * react-native-reanimated/plugin (worklets) MUST be the LAST plugin.
//     (If SDK 54's babel-preset-expo auto-injects worklets and errors on a
//     duplicate, drop this line — see apps/mobile/SETUP.md.)
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo", "nativewind/babel"],
    plugins: ["react-native-reanimated/plugin"],
  };
};
