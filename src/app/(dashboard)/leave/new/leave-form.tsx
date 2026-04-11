"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { submitLeaveRequest } from "@/actions/leave";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

interface LeaveType {
  id: string;
  name: string;
  code: string;
}

export function LeaveForm({ leaveTypes }: { leaveTypes: LeaveType[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await submitLeaveRequest(formData);
        router.push("/dashboard/leave");
      } catch (e) {
        setError(e instanceof Error ? e.message : "送出失敗");
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="leaveTypeId">假別</Label>
            <select
              id="leaveTypeId"
              name="leaveTypeId"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
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
              <Input id="startDate" name="startDate" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">結束日期</Label>
              <Input id="endDate" name="endDate" type="date" required />
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
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="attachmentUrl">附件連結（選填）</Label>
            <Input
              id="attachmentUrl"
              name="attachmentUrl"
              type="url"
              placeholder="例如診斷證明的雲端連結"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "送出中..." : "送出請假單"}
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
