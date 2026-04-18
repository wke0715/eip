"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { submitOtherExpenseRequest } from "@/actions/otherExpense";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { ErrorDialog } from "@/components/shared/error-dialog";
import { AttachmentInput } from "@/components/shared/attachment-input";
import {
  calcOtherExpenseSubtotal,
  type OtherExpenseItemInput,
} from "@/lib/validators/otherExpense";

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
  const [items, setItems] = useState<OtherExpenseItemInput[]>(
    defaultValues.items.length > 0
      ? defaultValues.items
      : [emptyItem(`${defaultValues.year}-${String(defaultValues.month).padStart(2, "0")}-01`)],
  );

  const selectClass =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs";

  const totals = useMemo(() => {
    const amount = items.reduce(
      (sum, it) => sum + (it.subtotal > 0 ? it.subtotal : calcOtherExpenseSubtotal(it)),
      0,
    );
    const receipts = items.reduce((sum, it) => sum + (it.receipts ?? 0), 0);
    return { amount, receipts };
  }, [items]);

  function updateItem(idx: number, patch: Partial<OtherExpenseItemInput>) {
    setItems((prev) => {
      const next = [...prev];
      const merged = { ...next[idx], ...patch };
      merged.subtotal = calcOtherExpenseSubtotal(merged);
      next[idx] = merged;
      return next;
    });
  }

  function addRow() {
    const base = `${year}-${String(month).padStart(2, "0")}-01`;
    setItems((prev) => [...prev, emptyItem(base)]);
  }

  function removeRow(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    if (items.length === 0) {
      setError("至少需要一筆明細");
      return;
    }
    const normalized = items.map((it) => ({
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
    <Card>
      <CardContent className="pt-6">
        <form action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label>表單編號</Label>
              <Input
                value={defaultValues.formNumber ?? ""}
                placeholder="送出後自動產生"
                readOnly
                disabled
                className="bg-muted text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">年度</Label>
              <Input
                id="year"
                name="year"
                type="number"
                required
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="month">月份</Label>
              <select
                id="month"
                name="month"
                required
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className={selectClass}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m} 月
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>總金額 / 單據數</Label>
              <Input
                value={`$${totals.amount.toLocaleString("zh-TW")} / ${totals.receipts}`}
                readOnly
                disabled
                className="bg-muted text-muted-foreground"
              />
            </div>
          </div>

          <AttachmentInput
            currentFileName={defaultValues.existingAttachmentName}
            submissionId={defaultValues.submissionId}
            maxSizeMb={defaultValues.maxSizeMb}
          />

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
                {items.map((it, idx) => (
                  <tr key={idx} className="border-t">
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
                        onChange={(e) => updateItem(idx, { itemName: e.target.value })}
                        placeholder="品名"
                        className="h-8 text-xs"
                      />
                    </td>
                    <td className="p-1">
                      <Input
                        value={it.purpose}
                        onChange={(e) => updateItem(idx, { purpose: e.target.value })}
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
                      ${(it.subtotal > 0 ? it.subtotal : calcOtherExpenseSubtotal(it)).toLocaleString("zh-TW")}
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
                {items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-muted-foreground">
                      尚無明細，請新增一列
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <ErrorDialog message={error} onClose={() => setError(null)} />

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending || items.length === 0}>
              {isPending ? "送出中..." : submitLabel}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              取消
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
