// STORY-056 — Babun mark for iOS home-screen. iOS rounds the icon further
// at the OS level, so we render the squircle at 22% radius here and let
// iOS do the final mask. The SVG already has rx="112" on a 512 canvas
// (~22%) so visually the corners line up after iOS rounding.

import { ImageResponse } from "next/og";
import { BABUN_MARK_DATA_URL } from "@/lib/brand/babun-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
        }}
      >
        <img
          src={BABUN_MARK_DATA_URL}
          width={180}
          height={180}
          alt="Babun"
        />
      </div>
    ),
    { ...size },
  );
}
