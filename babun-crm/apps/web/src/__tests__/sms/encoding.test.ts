// v547 §3.10 — SMS encoding analyzer coverage.
//
// GSM-7 vs UCS-2 detection, segment math, extended-char weight.

import { describe, it, expect } from "vitest";
import { analyzeSmsEncoding } from "@babun/shared/local/sms-encoding";

describe("analyzeSmsEncoding", () => {
  it("treats plain Latin as GSM-7 with 160-char single segment", () => {
    const r = analyzeSmsEncoding("Hello World");
    expect(r.encoding).toBe("gsm7");
    expect(r.length).toBe(11);
    expect(r.weight).toBe(11);
    expect(r.segments).toBe(1);
    expect(r.singleLimit).toBe(160);
    expect(r.remaining).toBe(149);
  });

  it("flips to UCS-2 the moment one Cyrillic char appears", () => {
    const r = analyzeSmsEncoding("Привет!");
    expect(r.encoding).toBe("ucs2");
    expect(r.singleLimit).toBe(70);
    expect(r.segments).toBe(1);
  });

  it("counts extended GSM-7 chars (€ { }) as 2 each", () => {
    // 3 extended chars = 6 weight; visible length is 3.
    const r = analyzeSmsEncoding("€{}");
    expect(r.encoding).toBe("gsm7");
    expect(r.length).toBe(3);
    expect(r.weight).toBe(6);
  });

  it("splits long GSM-7 into 153-char multipart segments", () => {
    const body = "a".repeat(161); // just over single-SMS limit
    const r = analyzeSmsEncoding(body);
    expect(r.encoding).toBe("gsm7");
    expect(r.weight).toBe(161);
    expect(r.segments).toBe(2);
    // 2 * 153 = 306 cap, 145 remaining
    expect(r.remaining).toBe(306 - 161);
  });

  it("splits long UCS-2 into 67-char multipart segments", () => {
    const body = "я".repeat(71); // just over single-UCS2 limit
    const r = analyzeSmsEncoding(body);
    expect(r.encoding).toBe("ucs2");
    expect(r.weight).toBe(71);
    expect(r.segments).toBe(2);
    expect(r.remaining).toBe(2 * 67 - 71);
  });

  it("empty body is one segment with full capacity remaining", () => {
    const r = analyzeSmsEncoding("");
    expect(r.segments).toBe(1);
    expect(r.weight).toBe(0);
    expect(r.remaining).toBe(160);
  });
});
