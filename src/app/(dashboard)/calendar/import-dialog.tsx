"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { importCalendarFromExcel } from "@/actions/calendar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImportDialog({ open, onOpenChange, onSuccess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFileName(file?.name ?? "");
  }

  function handleClose() {
    onOpenChange(false);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleSubmit() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("請選擇 Excel 檔案");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const result = await importCalendarFromExcel(formData);
      if (result.success) {
        toast.success(result.message);
        handleClose();
        onSuccess();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>匯入行事曆 Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            請上傳包含「進度_2026」工作表的 .xlsx 檔案。匯入時會 upsert 現有資料。
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium">選擇檔案</label>
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                className="hidden"
                id="excel-upload"
              />
              <label
                htmlFor="excel-upload"
                className="flex items-center gap-2 cursor-pointer h-9 rounded-md border border-input bg-background px-3 py-1 text-sm hover:bg-accent transition-colors"
              >
                <Upload className="h-4 w-4" />
                選擇 .xlsx
              </label>
              <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                {fileName || "未選擇檔案"}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!fileName || isPending}>
            {isPending ? "匯入中..." : "開始匯入"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
