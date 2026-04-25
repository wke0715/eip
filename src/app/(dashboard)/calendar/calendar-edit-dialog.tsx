"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { upsertCalendarEvent, deleteCalendarEvent } from "@/actions/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { CalendarEventStatus } from "@prisma/client";

const STATUS_OPTIONS: { value: CalendarEventStatus; label: string }[] = [
  { value: "CONFIRMED", label: "已確認（藍）" },
  { value: "TENTATIVE", label: "未定（粉紅）" },
  { value: "COMPLETED", label: "完成（灰）" },
  { value: "HOLIDAY",   label: "假日（紅）" },
];

export interface EditTarget {
  date: string;           // "YYYY-MM-DD"
  personName: string;     // "" = 新增模式，需讓使用者選擇
  amTask: string | null;
  pmTask: string | null;
  fullDayTask: string | null;
  status: CalendarEventStatus;
  weekNumber: number | null;
}

interface Props {
  readonly target: EditTarget | null;
  readonly personNames: readonly string[];
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

export function CalendarEditDialog({ target, personNames, onClose, onSaved }: Props) {
  const [personName,  setPersonName]  = useState("");
  const [amTask,      setAmTask]      = useState("");
  const [pmTask,      setPmTask]      = useState("");
  const [fullDayTask, setFullDayTask] = useState("");
  const [status,      setStatus]      = useState<CalendarEventStatus>("CONFIRMED");
  const [isPending, startTransition]  = useTransition();
  const [prevTarget,  setPrevTarget]  = useState<EditTarget | null>(null);

  const isNew = target?.personName === "";

  // derived state：target 變更時同步 form（避免 useEffect 內 setState）
  if (target !== prevTarget) {
    setPrevTarget(target);
    if (target) {
      setPersonName(target.personName || (personNames[0] ?? ""));
      setAmTask(target.amTask ?? "");
      setPmTask(target.pmTask ?? "");
      setFullDayTask(target.fullDayTask ?? "");
      setStatus(target.status);
    }
  }

  function handleDelete() {
    if (!target || isNew) return;
    if (!confirm(`確定刪除 ${target.personName} 在 ${displayDate} 的行程？`)) return;
    startTransition(async () => {
      const result = await deleteCalendarEvent(target.date, target.personName);
      if (result.success) {
        toast.success("已刪除");
        onSaved();
        onClose();
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleSave() {
    if (!target) return;
    if (!personName.trim()) {
      toast.error("請選擇人員");
      return;
    }
    startTransition(async () => {
      const result = await upsertCalendarEvent({
        date: target.date,
        personName: personName.trim(),
        amTask:      amTask.trim()      || null,
        pmTask:      pmTask.trim()      || null,
        fullDayTask: fullDayTask.trim() || null,
        status,
        weekNumber: target.weekNumber,
      });
      if (result.success) {
        toast.success(isNew ? "已新增" : "已儲存");
        onSaved();
        onClose();
      } else {
        toast.error(result.message);
      }
    });
  }

  const displayDate = target
    ? target.date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1 年 $2 月 $3 日")
    : "";

  let saveButtonLabel: string;
  if (isPending) saveButtonLabel = "儲存中...";
  else if (isNew) saveButtonLabel = "新增";
  else saveButtonLabel = "儲存";

  return (
    <Dialog open={!!target} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isNew ? "新增行程" : `編輯行程 — ${target?.personName}`}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{displayDate}</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 新增模式：人員選擇 */}
          {isNew && (
            <div className="space-y-1.5">
              <Label htmlFor="personName">人員</Label>
              <select
                id="personName"
                value={personName}
                onChange={e => setPersonName(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {personNames.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
                {personNames.length === 0 && (
                  <option value="" disabled>（尚無人員資料）</option>
                )}
              </select>
            </div>
          )}

          {/* 全天任務 */}
          <div className="space-y-1.5">
            <Label htmlFor="fullDayTask">全天任務</Label>
            <Input
              id="fullDayTask"
              value={fullDayTask}
              onChange={e => setFullDayTask(e.target.value)}
              placeholder="全天任務（填此欄時上午/下午留空）"
            />
          </div>

          {/* 上午 / 下午 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amTask">上午</Label>
              <Input
                id="amTask"
                value={amTask}
                onChange={e => setAmTask(e.target.value)}
                placeholder="上午任務"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pmTask">下午</Label>
              <Input
                id="pmTask"
                value={pmTask}
                onChange={e => setPmTask(e.target.value)}
                placeholder="下午任務"
              />
            </div>
          </div>

          {/* 狀態 */}
          <div className="space-y-1.5">
            <Label htmlFor="status">狀態</Label>
            <select
              id="status"
              value={status}
              onChange={e => setStatus(e.target.value as CalendarEventStatus)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
          <div>
            {!isNew && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isPending}
              >
                刪除行程
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isPending}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={isPending || (isNew && !personName)}>
              {saveButtonLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
