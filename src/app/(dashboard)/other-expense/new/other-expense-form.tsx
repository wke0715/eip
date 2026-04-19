"use client";

import { useState, useTransition, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { submitOtherExpenseRequest } from "@/actions/otherExpense";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import {
  calcOtherExpenseSubtotal,
  type OtherExpenseItemInput,
} from "@/lib/validators/otherExpense";
import { ExpenseFormShell } from "@/components/shared/expense-form-shell";

function emptyItem(date: string): OtherExpenseItemInput {
  return {
    date,
    itemName: "",
    purpose: "",
    quantity: 1,
    unitPrice: 0,
    subtotal: 0,
    receipts: 0,
  };
}

export interface OtherExpenseFormDefaultValues {
  formNumber?: string;
  year: number;
  month: number;
  existingAttachmentName?: string | null;
  submissionId?: string | null;
  maxSizeMb?: number;
  items: OtherExpenseItemInput[];
}

export function OtherExpenseForm({
  defaultValues,
  submitAction = submitOtherExpenseRequest,
  submitLabel = "送出申請單",
}: {
  defaultValues: OtherExpenseFormDefaultValues;
  submitAction?: (formData: FormData) => Promise<unknown>;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [year, setYear] = useState<number>(defaultValues.year);
  const [month, setMonth] = useState<number>(defaultValues.month);

  const nextKey = useRef(0);
  const [rows, setRows] = useState<Array<{ key: number; item: OtherExpenseItemInput }>>(() => {
    const initial =
      defaultValues.items.length > 0
        ? defaultValues.items
        : [emptyItem(`${defaultValues.year}-${String(defaultValues.month).padStart(2, "0")}-01`)];
    return initial.map((item) => ({ key: nextKey.current++, item }));
  });

  const totals = useMemo(() => {
    const amount = rows.reduce(
      (sum, { item: it }) =>
        sum + (it.subtotal > 0 ? it.subtotal : calcOtherExpenseSubtotal(it)),
      0,
    );
    const receipts = rows.reduce((sum, { item: it }) => sum + (it.receipts ?? 0), 0);
    return { amount, receipts };
  }, [rows]);

  function updateItem(idx: number, patch: Partial<OtherExpenseItemInput>) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const merged = { ...row.item, ...patch };
        merged.subtotal = calcOtherExpenseSubtotal(merged);
        return { ...row, item: merged };
      }),
    );
  }

  function addRow() {
    const base = `${year}-${String(month).padStart(2, "0")}-01`;
    setRows((prev) => [...prev, { key: nextKey.current++, item: emptyItem(base) }]);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    if (rows.length === 0) {
      setError("至少需要一筆明細");
      return;
    }
    const normalized = rows.map(({ item: it }) => ({
      ...it,
      subtotal: it.subtotal > 0 ? it.subtotal : calcOtherExpenseSubtotal(it),
    }));
    formData.set("items", JSON.stringify(normalized));
    startTransition(async () => {
      try {
        await submitAction(formData);
        router.push("/other-expense");
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
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-3 w-3 mr-1" />
          新增一列
        </Button>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="p-2 w-28">日期</th>
              <th className="p-2 min-w-[150px]">品名</th>
              <th className="p-2 min-w-[200px]">用途</th>
              <th className="p-2 w-20">數量</th>
              <th className="p-2 w-24">單價</th>
              <th className="p-2 w-24">合計</th>
              <th className="p-2 w-14">單據</th>
              <th className="p-2 w-10"></th>
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
                  <Input
                    value={it.itemName}
                    onChange={(e) =>
                      updateItem(idx, { itemName: e.target.value })
                    }
                    placeholder="品名"
                    className="h-8 text-xs"
                  />
                </td>
                <td className="p-1">
                  <Input
                    value={it.purpose}
                    onChange={(e) =>
                      updateItem(idx, { purpose: e.target.value })
                    }
                    placeholder="用途說明"
                    className="h-8 text-xs"
                  />
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={it.quantity}
                    onChange={(e) =>
                      updateItem(idx, { quantity: Number(e.target.value) })
                    }
                    className="h-8 text-xs"
                  />
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    min={0}
                    value={it.unitPrice}
                    onChange={(e) =>
                      updateItem(idx, { unitPrice: Number(e.target.value) })
                    }
                    className="h-8 text-xs"
                  />
                </td>
                <td className="p-1 text-right font-medium pr-2">
                  $
                  {(it.subtotal > 0
                    ? it.subtotal
                    : calcOtherExpenseSubtotal(it)
                  ).toLocaleString("zh-TW")}
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    min={0}
                    value={it.receipts}
                    onChange={(e) =>
                      updateItem(idx, { receipts: Number(e.target.value) })
                    }
                    className="h-8 text-xs"
                  />
                </td>
                <td className="p-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    className="text-red-600 hover:text-red-700"
                    title="刪除此列"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="p-4 text-center text-muted-foreground"
                >
                  尚無明細，請新增一列
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ExpenseFormShell>
  );
}
