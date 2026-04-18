import * as XLSX from "xlsx";

export interface OtherExpenseExportItem {
  date: Date;
  itemName: string;
  purpose: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  receipts: number;
}

export interface OtherExpenseExportData {
  formNumber: string;
  year: number;
  month: number;
  applicantName: string;
  items: OtherExpenseExportItem[];
  totalAmount: number;
  totalReceipts: number;
}

export function buildOtherExpenseWorkbook(data: OtherExpenseExportData): XLSX.WorkBook {
  const TW_OFFSET_MS = 8 * 60 * 60 * 1000;
  function toDateStr(d: Date) {
    return new Date(d.getTime() + TW_OFFSET_MS).toISOString().slice(0, 10);
  }

  const header = ["日期", "品名", "用途", "數量", "單價", "合計", "單據數"];

  const rows = data.items.map((it) => [
    toDateStr(it.date),
    it.itemName,
    it.purpose,
    it.quantity,
    it.unitPrice,
    it.subtotal,
    it.receipts,
  ]);

  const totalRow = ["合計", "", "", "", "", data.totalAmount, data.totalReceipts];

  const aoa = [header, ...rows, totalRow];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws["!cols"] = [
    { wch: 12 },
    { wch: 20 },
    { wch: 30 },
    { wch: 8 },
    { wch: 10 },
    { wch: 12 },
    { wch: 8 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "其他費用申請單");
  return wb;
}
