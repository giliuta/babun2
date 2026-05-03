// STORY-056 — PLACEHOLDER icon. Final brand drops with the designed
// mark; until then this and apple-icon.tsx share the same gradient
// (#1F66D7 → #1850A8) used by IOSInstallPrompt and the manifest
// theme_color. Keep them in lockstep when swapping in the real icon.

import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 360,
          background: "linear-gradient(135deg, #1F66D7 0%, #1850A8 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: 800,
          fontFamily: "system-ui, sans-serif",
          letterSpacing: "-0.05em",
        }}
      >
        B
      </div>
    ),
    { ...size }
  );
}
