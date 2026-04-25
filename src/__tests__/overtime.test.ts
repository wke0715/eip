import { describe, it, expect } from "vitest";
import {
  calcWorkHoursFromRange,
  splitHolidayHours,
  shouldWarnOvertimeLimit,
  createOvertimeRequestSchema,
  OVERTIME_WARNING_HOURS,
} from "@/lib/validators/overtime";

describe("calcWorkHoursFromRange", () => {
  it("09:00~18:00 應為 9 小時", () => {
    expect(calcWorkHoursFromRange("09:00~18:00")).toBe(9);
  });

  it("09:00~12:30 應為 3.5 小時", () => {
    expect(calcWorkHoursFromRange("09:00~12:30")).toBe(3.5);
  });

  it("結束時間早於開始時間應回傳 0", () => {
    expect(calcWorkHoursFromRange("18:00~09:00")).toBe(0);
  });

  it("相同起始與結束時間應回傳 0", () => {
    expect(calcWorkHoursFromRange("09:00~09:00")).toBe(0);
  });

  it("格式錯誤應回傳 0", () => {
    expect(calcWorkHoursFromRange("invalid")).toBe(0);
    expect(calcWorkHoursFromRange("")).toBe(0);
  });
});

describe("splitHolidayHours", () => {
  it("HOLIDAY 不超過 8 小時：全部為 2 倍薪，無加班", () => {
    const result = splitHolidayHours(6, "HOLIDAY");
    expect(result.doublePayHours).toBe(6);
    expect(result.overtimeHours).toBe(0);
  });

  it("HOLIDAY 超過 8 小時：8 小時為 2 倍薪，超出為加班", () => {
    const result = splitHolidayHours(10, "HOLIDAY");
    expect(result.doublePayHours).toBe(8);
    expect(result.overtimeHours).toBe(2);
  });

  it("HOLIDAY 剛好 8 小時：全部為 2 倍薪，無加班", () => {
    const result = splitHolidayHours(8, "HOLIDAY");
    expect(result.doublePayHours).toBe(8);
    expect(result.overtimeHours).toBe(0);
  });

  it("REST_DAY：無 2 倍薪，全部為加班時數", () => {
    const result = splitHolidayHours(7, "REST_DAY");
    expect(result.doublePayHours).toBe(0);
    expect(result.overtimeHours).toBe(7);
  });
});

describe("shouldWarnOvertimeLimit", () => {
  it(`超過 ${OVERTIME_WARNING_HOURS} 小時應回傳 true`, () => {
    expect(shouldWarnOvertimeLimit(OVERTIME_WARNING_HOURS + 1)).toBe(true);
  });

  it(`剛好 ${OVERTIME_WARNING_HOURS} 小時不應警示`, () => {
    expect(shouldWarnOvertimeLimit(OVERTIME_WARNING_HOURS)).toBe(false);
  });

  it("0 小時不應警示", () => {
    expect(shouldWarnOvertimeLimit(0)).toBe(false);
  });
});

describe("createOvertimeRequestSchema", () => {
  const validItem = {
    date: "2026-04-25",
    workerName: "佑霖",
    clientOrWork: "客戶 ABC 系統維護",
    dayType: "REST_DAY" as const,
    workTime: "09:00~18:00",
    workHours: 9,
    overtimeHours: 9,
  };

  it("合法表單應通過驗證", () => {
    const result = createOvertimeRequestSchema.safeParse({
      year: 2026,
      month: 4,
      items: [validItem],
    });
    expect(result.success).toBe(true);
  });

  it("日期格式錯誤應失敗", () => {
    const result = createOvertimeRequestSchema.safeParse({
      year: 2026,
      month: 4,
      items: [{ ...validItem, date: "26-4-25" }],
    });
    expect(result.success).toBe(false);
  });

  it("工作時間格式錯誤應失敗", () => {
    const result = createOvertimeRequestSchema.safeParse({
      year: 2026,
      month: 4,
      items: [{ ...validItem, workTime: "9:00-18:00" }],
    });
    expect(result.success).toBe(false);
  });

  it("無明細應失敗", () => {
    const result = createOvertimeRequestSchema.safeParse({
      year: 2026,
      month: 4,
      items: [],
    });
    expect(result.success).toBe(false);
  });
});
