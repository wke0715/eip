"use client";

import { useState, useTransition, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { submitExpenseReport } from "@/actions/expense";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";
import {
  calcExpenseItemSubtotal,
  type ExpenseItemInput,
} from "@/lib/validators/expense";
import { parseExpenseOnly } from "@/lib/excel/expense-parser";
import {
  ExpenseFormShell,
  SELECT_CLASS,
  ReceiptsCell,
  DeleteRowCell,
} from "@/components/shared/expense-form-shell";

const WORK_CATEGORY_OPTIONS = [
  { value: "S", label: "S 業務" },
  { value: "C", label: "C 輔導" },
  { value: "T", label: "T 訓練" },
  { value: "O", label: "O 其他" },
];

const TRANSPORT_OPTIONS = [
  { value: "", label: "—" },
  { value: "A", label: "A 飛機" },
  { value: "C", label: "C 計程車" },
  { value: "T", label: "T 鐵路" },
  { value: "M", label: "M 卡加值" },
  { value: "S", label: "S 輪船" },
];

const MEAL_OPTIONS = [
  { value: "", label: "—" },
  { value: "A", label: "A 核實" },
  { value: "B", label: "B 限額" },
];

const OTHER_KIND_OPTIONS = [
  { value: "", label: "—" },
  { value: "H", label: "H 住宿" },
  { value: "O", label: "O 雜支" },
];

function emptyItem(date: string): ExpenseItemInput {
  return {
    date,
    days: 1,
    workCategory: "O",
    workDetail: "",
    mileageSubsidy: 0,
    parkingFee: 0,
    etcFee: 0,
    gasFee: 0,
    transportType: null,
    transportAmount: 0,
    mealType: null,
    mealAmount: 0,
    otherKind: null,
    otherName: null,
    otherAmount: 0,
    subtotal: 0,
    receipts: 0,
    remark: null,
  };
}

export interface ExpenseFormDefaultValues {
  formNumber?: string;
  year: number;
  month: number;
  existingAttachmentName?: string | null;
  submissionId?: string | null;
  maxSizeMb?: number;
  items: ExpenseItemInput[];
}

type ExpenseRow = { key: number; item: ExpenseItemInput };

export function ExpenseForm({
  defaultValues,
  submitAction = submitExpenseReport,
  submitLabel = "送出報告單",
}: {
  defaultValues: ExpenseFormDefaultValues;
  submitAction?: (formData: FormData) => Promise<unknown>;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [year, setYear] = useState<number>(defaultValues.year);
  const [month, setMonth] = useState<number>(defaultValues.month);

  const nextKey = useRef(0);
  const toRows = (items: ExpenseItemInput[]): ExpenseRow[] =>
    items.map((item) => ({ key: nextKey.current++, item }));

  const [rows, setRows] = useState<ExpenseRow[]>(() => {
    const initial =
      defaultValues.items.length > 0
        ? defaultValues.items
        : [
            emptyItem(
              `${defaultValues.year}-${String(defaultValues.month).padStart(2, "0")}-01`,
            ),
          ];
    return toRows(initial);
  });

  const totals = useMemo(() => {
    const amount = rows.reduce(
      (sum, { item: it }) =>
        sum + (it.subtotal > 0 ? it.subtotal : calcExpenseItemSubtotal(it)),
      0,
    );
    const receipts = rows.reduce((sum, { item: it }) => sum + (it.receipts ?? 0), 0);
    return { amount, receipts };
  }, [rows]);

  function updateItem(idx: number, patch: Partial<ExpenseItemInput>) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const merged = { ...row.item, ...patch };
        merged.subtotal = calcExpenseItemSubtotal(merged);
        return { ...row, item: merged };
      }),
    );
  }

  const addRow = useCallback(() => {
    const base = `${year}-${String(month).padStart(2, "0")}-01`;
    setRows((prev) => [...prev, { key: nextKey.current++, item: emptyItem(base) }]);
  }, [year, month]);

  const removeRow = useCallback((idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseExpenseOnly(buf);
      if (parsed.errors.length > 0) {
        setError(`匯入警告：${parsed.errors.join("; ")}`);
      } else {
        setError(null);
      }
      if (parsed.items.length > 0) {
        setRows(toRows(parsed.items));
        setYear(parsed.year);
        const m = new Date(parsed.items[0].date).getMonth() + 1;
        if (m >= 1 && m <= 12) setMonth(m);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "匯入失敗");
    } finally {
      e.target.value = "";
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    if (rows.length === 0) {
      setError("至少需要一筆明細");
      return;
    }
    const normalized = rows.map(({ item: it }) => ({
      ...it,
      subtotal: it.subtotal > 0 ? it.subtotal : calcExpenseItemSubtotal(it),
    }));
    formData.set("items", JSON.stringify(normalized));
    startTransition(async () => {
      try {
        await submitAction(formData);
        router.push("/expense");
      } catch (e) {
        setError(e instanceof Error ? e.message : "送出失敗");
      }
    });
  }

  return (
    <ExpenseFormShell
      formNumber={defaultValues.formNumber}
      year={year}
      month={month}
      onYearChange={setYear}
      onMonthChange={setMonth}
      summaryLabel="總金額 / 單據數"
      summaryValue={`$${totals.amount.toLocaleString("zh-TW")} / ${totals.receipts}`}
      existingAttachmentName={defaultValues.existingAttachmentName}
      submissionId={defaultValues.submissionId}
      maxSizeMb={defaultValues.maxSizeMb}
      onSubmit={handleSubmit}
      isPending={isPending}
      hasItems={rows.length > 0}
      submitLabel={submitLabel}
      error={error}
      onErrorClose={() => setError(null)}
    >
      <div className="flex items-center justify-between pt-2">
        <h3 className="font-semibold">明細</h3>
        <div className="flex gap-2">
          <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-md border px-3 h-9 text-sm hover:bg-muted">
            <Upload className="h-4 w-4" />
            匯入 Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileImport}
            />
          </label>
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-3 w-3 mr-1" />
            新增一列
          </Button>
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="min-w-max text-xs">
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="p-2 min-w-[128px]">日期</th>
              <th className="p-2 min-w-[96px]">類別</th>
              <th className="p-2 min-w-[320px]">工作項目/起訖地點</th>
              <th className="p-2 min-w-[96px]">私車補貼</th>
              <th className="p-2 min-w-[96px]">停車費</th>
              <th className="p-2 min-w-[96px]">ETC</th>
              <th className="p-2 min-w-[96px]">油資</th>
              <th className="p-2 min-w-[96px]">交通類</th>
              <th className="p-2 min-w-[96px]">交通費</th>
              <th className="p-2 min-w-[96px]">膳食類</th>
              <th className="p-2 min-w-[96px]">膳食費</th>
              <th className="p-2 min-w-[96px]">其他類</th>
              <th className="p-2 min-w-[96px]">其他費</th>
              <th className="p-2 min-w-[96px]">小計</th>
              <th className="p-2 min-w-[80px]">單據</th>
              <th className="p-2 min-w-[40px]"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, item: it }, idx) => (
              <tr key={key} className="border-t">
                <td className="p-1">
                  <Input
                    type="date"
                    value={it.date}
                    onChange={(e) => updateItem(idx, { date: e.target.value })}
                    className="h-8 text-xs"
                  />
                </td>
                <td className="p-1">
                  <select
                    value={it.workCategory}
                    onChange={(e) =>
                      updateItem(idx, {
                        workCategory: e.target
                          .value as ExpenseItemInput["workCategory"],
                      })
                    }
                    className={SELECT_CLASS}
                  >
                    {WORK_CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-1">
                  <Input
                    value={it.workDetail}
                    onChange={(e) =>
                      updateItem(idx, { workDetail: e.target.value })
                    }
                    placeholder="如：客戶_ABC 台北→台中"
                    className="h-8 text-xs"
                  />
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    min={0}
                    value={it.mileageSubsidy}
                    onChange={(e) =>
                      updateItem(idx, {
                        mileageSubsidy: Number(e.target.value),
                      })
                    }
                    className="h-8 text-xs"
                  />
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    min={0}
                    value={it.parkingFee}
                    onChange={(e) =>
                      updateItem(idx, { parkingFee: Number(e.target.value) })
                    }
                    className="h-8 text-xs"
                  />
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    min={0}
                    value={it.etcFee}
                    onChange={(e) =>
                      updateItem(idx, { etcFee: Number(e.target.value) })
                    }
                    className="h-8 text-xs"
                  />
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    min={0}
                    value={it.gasFee}
                    onChange={(e) =>
                      updateItem(idx, { gasFee: Number(e.target.value) })
                    }
                    className="h-8 text-xs"
                  />
                </td>
                <td className="p-1">
                  <select
                    value={it.transportType ?? ""}
                    onChange={(e) =>
                      updateItem(idx, {
                        transportType:
                          (e.target.value ||
                            null) as ExpenseItemInput["transportType"],
                      })
                    }
                    className={SELECT_CLASS}
                  >
                    {TRANSPORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    min={0}
                    value={it.transportAmount}
                    onChange={(e) =>
                      updateItem(idx, {
                        transportAmount: Number(e.target.value),
                      })
                    }
                    className="h-8 text-xs"
                  />
                </td>
                <td className="p-1">
                  <select
                    value={it.mealType ?? ""}
                    onChange={(e) =>
                      updateItem(idx, {
                        mealType: (e.target.value ||
                          null) as ExpenseItemInput["mealType"],
                      })
                    }
                    className={SELECT_CLASS}
                  >
                    {MEAL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    min={0}
                    value={it.mealAmount}
                    onChange={(e) =>
                      updateItem(idx, { mealAmount: Number(e.target.value) })
                    }
                    className="h-8 text-xs"
                  />
                </td>
                <td className="p-1">
                  <select
                    value={it.otherKind ?? ""}
                    onChange={(e) =>
                      updateItem(idx, {
                        otherKind: (e.target.value ||
                          null) as ExpenseItemInput["otherKind"],
                      })
                    }
                    className={SELECT_CLASS}
                  >
                    {OTHER_KIND_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    min={0}
                    value={it.otherAmount}
                    onChange={(e) =>
                      updateItem(idx, { otherAmount: Number(e.target.value) })
                    }
                    className="h-8 text-xs"
                  />
                </td>
                <td className="p-1 text-right font-medium">
                  $
                  {(it.subtotal > 0
                    ? it.subtotal
                    : calcExpenseItemSubtotal(it)
                  ).toLocaleString("zh-TW")}
                </td>
                <ReceiptsCell
                  receipts={it.receipts}
                  onUpdate={(v) => updateItem(idx, { receipts: v })}
                />
                <DeleteRowCell onRemove={() => removeRow(idx)} />
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={16}
                  className="p-4 text-center text-muted-foreground"
                >
                  尚無明細，請新增或匯入 Excel
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ExpenseFormShell>
  );
}
