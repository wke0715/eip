import * as XLSX from "xlsx";
import type { ExpenseItemInput } from "../validators/expense";

export interface ExportExpenseInput {
  formNumber: string;
  applicantName: string;
  year: number;
  month: number;
  totalAmount: number;
  totalReceipts: number;
  items: ExpenseItemInput[];
}

const HEADER_ROW_1 = [
  "日期",
  "天數",
  "工作項目及起訖地點",
  "私車補貼",
  "停車費",
  "ETC",
  "油資",
  "交通類型",
  "交通費",
  "膳食類型",
  "膳食費",
  "其他類型",
  "其他費",
  "小計",
  "單據數",
  "備註",
];

function toRow(it: ExpenseItemInput): (string | number)[] {
  return [
    it.date,
    it.days ?? 1,
    it.workDetail,
    it.mileageSubsidy ?? 0,
    it.parkingFee ?? 0,
    it.etcFee ?? 0,
    it.gasFee ?? 0,
    it.transportType ?? "",
    it.transportAmount ?? 0,
    it.mealType ?? "",
    it.mealAmount ?? 0,
    it.otherKind ?? "",
    it.otherAmount ?? 0,
    it.subtotal ?? 0,
    it.receipts ?? 0,
    it.remark ?? "",
  ];
}

/** 匯出單張出差旅費報告單為 xlsx buffer */
export function buildExpenseWorkbook(input: ExportExpenseInput): ArrayBuffer {
  const title = `${input.year}年${input.month}月出差旅費報告單 - ${input.applicantName}`;
  // 兩行 header（第 1 行為標題，第 2 行為欄位名），對應 expense-parser 的 `rows[2..]` 為資料列
  const aoa: (string | number)[][] = [
    [title],
    HEADER_ROW_1,
    ...input.items.map(toRow),
    [
      "總計",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      input.totalAmount,
      input.totalReceipts,
      "",
    ],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = [
    { wch: 12 }, { wch: 6 }, { wch: 30 }, { wch: 10 }, { wch: 8 },
    { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 8 },
    { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 20 },
  ];
  sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 15 } }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "出差旅費報告單");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return buf;
}
