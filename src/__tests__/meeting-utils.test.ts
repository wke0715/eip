import { describe, it, expect } from "vitest";
import {
  timeToMinutes,
  isTimeOverlap,
  generateTimeSlots,
} from "@/lib/meeting-utils";

describe("timeToMinutes", () => {
  it("09:00 應為 540", () => {
    expect(timeToMinutes("09:00")).toBe(540);
  });

  it("13:30 應為 810", () => {
    expect(timeToMinutes("13:30")).toBe(810);
  });
});

describe("isTimeOverlap", () => {
  it("完全重疊應回傳 true", () => {
    expect(isTimeOverlap("09:00", "10:00", "09:00", "10:00")).toBe(true);
  });

  it("部分重疊應回傳 true", () => {
    expect(isTimeOverlap("09:00", "10:30", "10:00", "11:00")).toBe(true);
  });

  it("A 包含 B 應回傳 true", () => {
    expect(isTimeOverlap("09:00", "12:00", "10:00", "11:00")).toBe(true);
  });

  it("完全不重疊應回傳 false", () => {
    expect(isTimeOverlap("09:00", "10:00", "10:00", "11:00")).toBe(false);
  });

  it("前後緊接應回傳 false", () => {
    expect(isTimeOverlap("09:00", "10:00", "10:00", "11:00")).toBe(false);
  });
});

describe("generateTimeSlots", () => {
  it("預設應產生 08:00 到 18:00 的時段", () => {
    const slots = generateTimeSlots();
    expect(slots[0]).toBe("08:00");
    expect(slots[slots.length - 1]).toBe("18:00");
  });

  it("30 分鐘粒度，08:00~18:00 應有 21 個時段", () => {
    const slots = generateTimeSlots();
    expect(slots.length).toBe(21);
  });

  it("應包含半點時段", () => {
    const slots = generateTimeSlots();
    expect(slots).toContain("09:30");
    expect(slots).toContain("14:30");
  });
});
