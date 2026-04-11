import { describe, it, expect } from "vitest";
import { calculateWorkingDays, calculateLeaveHours } from "@/lib/leave-utils";

describe("calculateWorkingDays", () => {
  it("同一天（平日）應回傳 1", () => {
    // 2026-04-13 是星期一
    const date = new Date(2026, 3, 13);
    expect(calculateWorkingDays(date, date)).toBe(1);
  });

  it("同一天（週末）應回傳 0", () => {
    // 2026-04-11 是星期六
    const date = new Date(2026, 3, 11);
    expect(calculateWorkingDays(date, date)).toBe(0);
  });

  it("一整週（週一到週五）應回傳 5", () => {
    const start = new Date(2026, 3, 13); // 週一
    const end = new Date(2026, 3, 17); // 週五
    expect(calculateWorkingDays(start, end)).toBe(5);
  });

  it("跨週（週一到下週一）應回傳 6", () => {
    const start = new Date(2026, 3, 13); // 週一
    const end = new Date(2026, 3, 20); // 下週一
    expect(calculateWorkingDays(start, end)).toBe(6);
  });

  it("結束日早於起始日應回傳 0", () => {
    const start = new Date(2026, 3, 15);
    const end = new Date(2026, 3, 13);
    expect(calculateWorkingDays(start, end)).toBe(0);
  });

  it("兩週應回傳 10 個工作天", () => {
    const start = new Date(2026, 3, 13); // 週一
    const end = new Date(2026, 3, 24); // 下下週五
    expect(calculateWorkingDays(start, end)).toBe(10);
  });
});

describe("calculateLeaveHours", () => {
  it("一個工作天應為 8 小時", () => {
    const date = new Date(2026, 3, 13);
    expect(calculateLeaveHours(date, date)).toBe(8);
  });

  it("五個工作天應為 40 小時", () => {
    const start = new Date(2026, 3, 13);
    const end = new Date(2026, 3, 17);
    expect(calculateLeaveHours(start, end)).toBe(40);
  });
});
