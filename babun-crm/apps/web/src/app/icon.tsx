// STORY-056 — Babun mark. The dynamic /icon route renders a 512×512 PNG
// of the baboon for clients that don't fetch /icon.svg directly. The SVG
// itself lives in src/lib/brand/babun-mark.ts and /public/icon.svg —
// keep all three in lockstep when iterating on the mark.

import { ImageResponse } from "next/og";
import { BABUN_MARK_DATA_URL } from "@/lib/brand/babun-mark";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          width={512}
          height={512}
          alt="Babun"
        />
      </div>
    ),
    { ...size },
  );
}
