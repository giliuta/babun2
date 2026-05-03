// STORY-056 — PLACEHOLDER apple-touch-icon. Renders 180×180 PNG
// served at /apple-icon. iOS uses this for the home-screen icon
// after "Add to Home Screen". 22% border-radius matches the
// iOS squircle; iOS itself rounds the icon further so the visible
// corner is softer than 22%.

import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 130,
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
          borderRadius: "22%",
        }}
      >
        B
      </div>
    ),
    { ...size }
  );
}
