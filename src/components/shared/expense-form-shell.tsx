"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { AttachmentInput } from "@/components/shared/attachment-input";
import { ErrorDialog } from "@/components/shared/error-dialog";
import { Trash2, Plus } from "lucide-react";

export function ReceiptsCell({
  receipts,
  onUpdate,
}: {
  readonly receipts: number;
  readonly onUpdate: (v: number) => void;
}) {
  return (
    <td className="p-1">
      <Input
        type="number"
        min={0}
        value={receipts}
        onChange={(e) => onUpdate(Number(e.target.value))}
        className="h-8 text-xs"
      />
    </td>
  );
}

export function DeleteRowCell({ onRemove }: { readonly onRemove: () => void }) {
  return (
    <td className="p-1 text-center">
      <button
        type="button"
        onClick={onRemove}
        className="text-red-600 hover:text-red-700"
        title="刪除此列"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </td>
  );
}

export function ItemsTableHeader({
  onAddRow,
}: {
  readonly onAddRow: () => void;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      <h3 className="font-semibold">明細</h3>
      <Button type="button" variant="outline" size="sm" onClick={onAddRow}>
        <Plus className="h-3 w-3 mr-1" />
        新增一列
      </Button>
    </div>
  );
}

export const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs";

interface ExpenseFormShellProps {
  readonly formNumber?: string;
  readonly year: number;
  readonly month: number;
  readonly onYearChange: (v: number) => void;
  readonly onMonthChange: (v: number) => void;
  readonly summaryLabel: string;
  readonly summaryValue: string;
  readonly existingAttachmentName?: string | null;
  readonly submissionId?: string | null;
  readonly maxSizeMb?: number;
  readonly onSubmit: (formData: FormData) => void;
  readonly isPending: boolean;
  readonly hasItems: boolean;
  readonly submitLabel: string;
  readonly error: string | null;
  readonly onErrorClose: () => void;
  readonly children: React.ReactNode;
}

export function ExpenseFormShell({
  formNumber,
  year,
  month,
  onYearChange,
  onMonthChange,
  summaryLabel,
  summaryValue,
  existingAttachmentName,
  submissionId,
  maxSizeMb,
  onSubmit,
  isPending,
  hasItems,
  submitLabel,
  error,
  onErrorClose,
  children,
}: ExpenseFormShellProps) {
  const router = useRouter();
  return (
    <Card>
      <CardContent className="pt-6">
        <form action={onSubmit} className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label>表單編號</Label>
              <Input
                value={formNumber ?? ""}
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
                onChange={(e) => onYearChange(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="month">月份</Label>
              <select
                id="month"
                name="month"
                required
                value={month}
                onChange={(e) => onMonthChange(Number(e.target.value))}
                className={SELECT_CLASS}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m} 月
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{summaryLabel}</Label>
              <Input
                value={summaryValue}
                readOnly
                disabled
                className="bg-muted text-muted-foreground"
              />
            </div>
          </div>

          <AttachmentInput
            currentFileName={existingAttachmentName}
            submissionId={submissionId}
            maxSizeMb={maxSizeMb}
          />

          {children}

          <ErrorDialog message={error} onClose={onErrorClose} />

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending || !hasItems}>
              {isPending ? "送出中..." : submitLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              取消
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
