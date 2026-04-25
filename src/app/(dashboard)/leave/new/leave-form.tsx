"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { submitLeaveRequest } from "@/actions/leave";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { calculateLeaveHours } from "@/lib/leave-utils";
import { ErrorDialog } from "@/components/shared/error-dialog";
import { AttachmentInput } from "@/components/shared/attachment-input";

interface LeaveType {
  id: string;
  name: string;
  code: string;
}

// 產生 08:00 ~ 17:00，每 30 分鐘一格
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 8; h <= 17; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 17) slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs";

export interface LeaveFormDefaultValues {
  formNumber?: string;
  leaveTypeId?: string;
  startDate?: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endDate?: string;
  endTime?: string;
  reason?: string;
  existingAttachmentName?: string | null;
  submissionId?: string | null;
  maxSizeMb?: number;
}

function computeHours(startDate: string, startTime: string, endDate: string, endTime: string): number | null {
  if (!startDate || !startTime || !endDate || !endTime) return null;
  try {
    const start = new Date(`${startDate}T${startTime}:00+08:00`);
    const end = new Date(`${endDate}T${endTime}:00+08:00`);
    if (end <= start) return null;
    return calculateLeaveHours(start, end);
  } catch {
    return null;
  }
}

export function LeaveForm({
  leaveTypes,
  defaultValues,
  submitAction = submitLeaveRequest,
  submitLabel = "送出請假單",
}: {
  readonly leaveTypes: readonly LeaveType[];
  readonly defaultValues?: LeaveFormDefaultValues;
  readonly submitAction?: (formData: FormData) => Promise<unknown>;
  readonly submitLabel?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(defaultValues?.startDate ?? "");
  const [startTime, setStartTime] = useState(defaultValues?.startTime ?? "08:00");
  const [endDate, setEndDate] = useState(defaultValues?.endDate ?? "");
  const [endTime, setEndTime] = useState(defaultValues?.endTime ?? "17:00");

  const hours = computeHours(startDate, startTime, endDate, endTime);

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await submitAction(formData);
        const result = res as { error?: string } | null | undefined;
        if (result?.error) { setError(result.error); return; }
        router.push("/leave");
      } catch {
        setError("送出失敗");
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={handleSubmit} className="space-y-4">
          {/* 表單編號 + 請假時數（唯讀）*/}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>表單編號</Label>
              <Input
                value={defaultValues?.formNumber ?? ""}
                placeholder="送出後自動產生"
                readOnly
                disabled
                className="bg-muted text-muted-foreground cursor-not-allowed"
              />
            </div>
            <div className="space-y-2">
              <Label>請假時數</Label>
              <Input
                value={hours === null ? "" : `${hours} 小時`}
                placeholder="選擇日期時間後自動計算"
                readOnly
                disabled
                className="bg-muted text-muted-foreground cursor-not-allowed"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="leaveTypeId">假別</Label>
            <select
              id="leaveTypeId"
              name="leaveTypeId"
              required
              defaultValue={defaultValues?.leaveTypeId ?? ""}
              className={selectClass}
            >
              <option value="">請選擇假別</option>
              {leaveTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">起始日期</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">起始時間</Label>
              <select
                id="startTime"
                name="startTime"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={selectClass}
              >
                {TIME_SLOTS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">結束日期</Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">結束時間</Label>
              <select
                id="endTime"
                name="endTime"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={selectClass}
              >
                {TIME_SLOTS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">請假事由</Label>
            <Textarea
              id="reason"
              name="reason"
              required
              maxLength={500}
              placeholder="請填寫請假事由"
              defaultValue={defaultValues?.reason}
            />
          </div>

          <AttachmentInput
            currentFileName={defaultValues?.existingAttachmentName}
            submissionId={defaultValues?.submissionId}
            maxSizeMb={defaultValues?.maxSizeMb}
          />

          <ErrorDialog message={error} onClose={() => setError(null)} />

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending}>
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
