import * as XLSX from "xlsx";

export interface OvertimeExportItem {
  date: Date;
  workerName: string;
  clientOrWork: string;
  dayType: string;
  workTime: string;
  workHours: number;
  overtimeHours: number;
  holidayDoublePay: number;
  overtimePay: number;
}

export interface OvertimeExportData {
  formNumber: string;
  year: number;
  month: number;
  applicantName: string;
  items: OvertimeExportItem[];
  totalWorkHours: number;
  totalOvertimeHours: number;
  totalHolidayPay: number;
  totalOvertimePay: number;
}

const DAY_TYPE_LABEL: Record<string, string> = {
  REST_DAY: "休息日",
  HOLIDAY: "國定假日",
};

export function buildOvertimeWorkbook(data: OvertimeExportData): XLSX.WorkBook {
  const TW_OFFSET_MS = 8 * 60 * 60 * 1000;
  function toDateStr(d: Date) {
    return new Date(d.getTime() + TW_OFFSET_MS).toISOString().slice(0, 10);
  }

  const header = [
    "加班日期",
    "加班人員",
    "客戶/工作內容",
    "日期類型",
    "工作時間",
    "工作時數",
    "加班時數",
    "國定假日 2 倍薪資",
    "實際給付加班費",
  ];

  const rows = data.items.map((it) => [
    toDateStr(it.date),
    it.workerName,
    it.clientOrWork,
    DAY_TYPE_LABEL[it.dayType] ?? it.dayType,
    it.workTime,
    it.workHours,
    it.overtimeHours,
    it.holidayDoublePay,
    it.overtimePay,
  ]);

  const totalRow = [
    "合計",
    "",
    "",
    "",
    "",
    data.totalWorkHours,
    data.totalOvertimeHours,
    data.totalHolidayPay,
    data.totalOvertimePay,
  ];

  const aoa = [header, ...rows, totalRow];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws["!cols"] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 30 },
    { wch: 12 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 18 },
    { wch: 16 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "加班單");
  return wb;
}
