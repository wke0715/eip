"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { submitOvertimeRequest } from "@/actions/overtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { ErrorDialog } from "@/components/shared/error-dialog";
import { AttachmentInput } from "@/components/shared/attachment-input";
import {
  calcWorkHoursFromRange,
  splitHolidayHours,
  OVERTIME_WARNING_HOURS,
  type OvertimeItemInput,
} from "@/lib/validators/overtime";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs";

const DAY_TYPE_OPTIONS = [
  { value: "REST_DAY", label: "休息日" },
  { value: "HOLIDAY", label: "國定假日" },
];

function emptyItem(date: string): OvertimeItemInput {
  return {
    date,
    workerName: "",
    clientOrWork: "",
    dayType: "REST_DAY",
    workTime: "09:00~18:00",
    workHours: 8,
    overtimeHours: 8,
    holidayDoublePay: 0,
    overtimePay: 0,
  };
}

export interface OvertimeFormDefaultValues {
  formNumber?: string;
  year: number;
  month: number;
  existingAttachmentName?: string | null;
  submissionId?: string | null;
  maxSizeMb?: number;
  items: OvertimeItemInput[];
}

export function OvertimeForm({
  defaultValues,
  submitAction = submitOvertimeRequest,
  submitLabel = "送出加班單",
}: {
  defaultValues: OvertimeFormDefaultValues;
  submitAction?: (formData: FormData) => Promise<unknown>;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [year, setYear] = useState<number>(defaultValues.year);
  const [month, setMonth] = useState<number>(defaultValues.month);
  const [items, setItems] = useState<OvertimeItemInput[]>(
    defaultValues.items.length > 0
      ? defaultValues.items
      : [emptyItem(`${defaultValues.year}-${String(defaultValues.month).padStart(2, "0")}-01`)],
  );

  const totals = useMemo(() => {
    const workHours = items.reduce((sum, it) => sum + (it.workHours ?? 0), 0);
    const overtimeHours = items.reduce((sum, it) => sum + (it.overtimeHours ?? 0), 0);
    const holidayPay = items.reduce((sum, it) => sum + (it.holidayDoublePay ?? 0), 0);
    const overtimePay = items.reduce((sum, it) => sum + (it.overtimePay ?? 0), 0);
    return { workHours, overtimeHours, holidayPay, overtimePay };
  }, [items]);

  const showOvertimeWarning = totals.overtimeHours > OVERTIME_WARNING_HOURS;

  function updateItem(idx: number, patch: Partial<OvertimeItemInput>) {
    setItems((prev) => {
      const next = [...prev];
      const merged = { ...next[idx], ...patch };
      // 重新計算 workHours
      if (patch.workTime !== undefined) {
        merged.workHours = calcWorkHoursFromRange(merged.workTime);
      }
      // 若 workHours 或 dayType 改變，重新計算加班/雙倍薪
      if (patch.workTime !== undefined || patch.dayType !== undefined || patch.workHours !== undefined) {
        const wh = patch.workHours !== undefined ? patch.workHours : merged.workHours;
        const { doublePayHours, overtimeHours } = splitHolidayHours(wh, merged.dayType);
        merged.workHours = wh;
        merged.overtimeHours = overtimeHours;
        // holidayDoublePay 只存時數，實際金額由使用者自填
        merged.holidayDoublePay = doublePayHours;
      }
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
    formData.set("items", JSON.stringify(items));
    startTransition(async () => {
      try {
        await submitAction(formData);
        router.push("/overtime");
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
              <Label>工作/加班時數</Label>
              <Input
                value={`${totals.workHours.toFixed(1)}h / ${totals.overtimeHours.toFixed(1)}h`}
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

          {showOvertimeWarning && (
            <div className="flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              本月加班時數（{totals.overtimeHours.toFixed(1)}h）已超過 {OVERTIME_WARNING_HOURS}h 上限，請確認是否正確。
            </div>
          )}

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
                  <th className="p-2 w-28">加班日期</th>
                  <th className="p-2 w-24">加班人員</th>
                  <th className="p-2 min-w-[180px]">客戶/工作內容</th>
                  <th className="p-2 w-24">日期類型</th>
                  <th className="p-2 w-32">工作時間</th>
                  <th className="p-2 w-18">工作時數</th>
                  <th className="p-2 w-18">加班時數</th>
                  <th className="p-2 w-24">2倍薪時數</th>
                  <th className="p-2 w-24">加班費</th>
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
                        value={it.workerName}
                        onChange={(e) => updateItem(idx, { workerName: e.target.value })}
                        placeholder="姓名"
                        className="h-8 text-xs"
                      />
                    </td>
                    <td className="p-1">
                      <Input
                        value={it.clientOrWork}
                        onChange={(e) => updateItem(idx, { clientOrWork: e.target.value })}
                        placeholder="客戶_ABC / 系統維護"
                        className="h-8 text-xs"
                      />
                    </td>
                    <td className="p-1">
                      <select
                        value={it.dayType}
                        onChange={(e) =>
                          updateItem(idx, {
                            dayType: e.target.value as OvertimeItemInput["dayType"],
                          })
                        }
                        className={selectClass}
                      >
                        {DAY_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-1">
                      <Input
                        value={it.workTime}
                        onChange={(e) => updateItem(idx, { workTime: e.target.value })}
                        placeholder="09:00~18:00"
                        className="h-8 text-xs font-mono"
                      />
                    </td>
                    <td className="p-1 text-center font-medium">
                      {it.workHours.toFixed(1)}
                    </td>
                    <td className="p-1 text-center font-medium">
                      {it.overtimeHours.toFixed(1)}
                    </td>
                    <td className="p-1 text-center text-blue-600 font-medium">
                      {it.dayType === "HOLIDAY" ? `${it.holidayDoublePay.toFixed(1)}h` : "—"}
                    </td>
                    <td className="p-1">
                      <Input
                        type="number"
                        min={0}
                        value={it.overtimePay}
                        onChange={(e) =>
                          updateItem(idx, { overtimePay: Number(e.target.value) })
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
                    <td colSpan={10} className="p-4 text-center text-muted-foreground">
                      尚無明細，請新增一列
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex gap-6 text-sm text-muted-foreground">
            <span>總工作時數：<strong className="text-foreground">{totals.workHours.toFixed(1)}h</strong></span>
            <span>總加班時數：<strong className="text-foreground">{totals.overtimeHours.toFixed(1)}h</strong></span>
            <span>加班費合計：<strong className="text-foreground">${totals.overtimePay.toLocaleString("zh-TW")}</strong></span>
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
