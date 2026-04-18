import { describe, it, expect } from "vitest";
import { calculateWorkingDays, calculateLeaveHours } from "@/lib/leave-utils";

// 以台灣時間（+08:00）建立 Date，確保不受伺服器時區影響
function tw(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00+08:00`);
}

describe("calculateWorkingDays", () => {
  it("同一天（平日）應回傳 1", () => {
    // 2026-04-13 是星期一
    const date = tw("2026-04-13", "00:00");
    expect(calculateWorkingDays(date, date)).toBe(1);
  });

  it("同一天（週末）應回傳 0", () => {
    // 2026-04-11 是星期六
    const date = tw("2026-04-11", "00:00");
    expect(calculateWorkingDays(date, date)).toBe(0);
  });

  it("一整週（週一到週五）應回傳 5", () => {
    const start = tw("2026-04-13", "00:00"); // 週一
    const end   = tw("2026-04-17", "00:00"); // 週五
    expect(calculateWorkingDays(start, end)).toBe(5);
  });

  it("跨週（週一到下週一）應回傳 6", () => {
    const start = tw("2026-04-13", "00:00"); // 週一
    const end   = tw("2026-04-20", "00:00"); // 下週一
    expect(calculateWorkingDays(start, end)).toBe(6);
  });

  it("結束日早於起始日應回傳 0", () => {
    const start = tw("2026-04-15", "00:00");
    const end   = tw("2026-04-13", "00:00");
    expect(calculateWorkingDays(start, end)).toBe(0);
  });

  it("兩週應回傳 10 個工作天", () => {
    const start = tw("2026-04-13", "00:00"); // 週一
    const end   = tw("2026-04-24", "00:00"); // 下下週五
    expect(calculateWorkingDays(start, end)).toBe(10);
  });
});

describe("calculateLeaveHours", () => {
  it("整天（08:00–17:00）應為 8 小時", () => {
    expect(calculateLeaveHours(tw("2026-04-13", "08:00"), tw("2026-04-13", "17:00"))).toBe(8);
  });

  it("上午半天（08:00–12:00）應為 4 小時", () => {
    expect(calculateLeaveHours(tw("2026-04-13", "08:00"), tw("2026-04-13", "12:00"))).toBe(4);
  });

  it("下午半天（13:00–17:00）應為 4 小時", () => {
    expect(calculateLeaveHours(tw("2026-04-13", "13:00"), tw("2026-04-13", "17:00"))).toBe(4);
  });

  it("午休時段（12:00–13:00）不計入，應為 0 小時", () => {
    expect(calculateLeaveHours(tw("2026-04-13", "12:00"), tw("2026-04-13", "13:00"))).toBe(0);
  });

  it("半小時請假（08:00–08:30）應為 0.5 小時", () => {
    expect(calculateLeaveHours(tw("2026-04-13", "08:00"), tw("2026-04-13", "08:30"))).toBe(0.5);
  });

  it("五個工作天（週一 08:00 ～ 週五 17:00）應為 40 小時", () => {
    expect(calculateLeaveHours(tw("2026-04-13", "08:00"), tw("2026-04-17", "17:00"))).toBe(40);
  });

  it("跨週末不計週六日", () => {
    // 週五 08:00 到下週一 17:00 = 8+8=16h
    expect(calculateLeaveHours(tw("2026-04-10", "08:00"), tw("2026-04-13", "17:00"))).toBe(16);
  });
});
