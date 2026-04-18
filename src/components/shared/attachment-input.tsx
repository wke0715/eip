"use client";

import { useRef } from "react";
import { Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface AttachmentInputProps {
  currentFileName?: string | null;
  submissionId?: string | null;
  maxSizeMb?: number;
}

export function AttachmentInput({
  currentFileName,
  submissionId,
  maxSizeMb = 10,
}: AttachmentInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  return (
    <div className="space-y-2">
      <Label>附件（選填，最大 {maxSizeMb} MB）</Label>

      {currentFileName && submissionId && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5 shrink-0" />
          <span>目前附件：</span>
          <a
            href={`/api/attachments/${submissionId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground truncate max-w-xs"
          >
            {currentFileName}
          </a>
          <span className="text-xs">（重新上傳即覆蓋）</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip className="h-3.5 w-3.5" />
          選擇檔案
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => {
            if (inputRef.current) {
              inputRef.current.value = "";
              if (labelRef.current) labelRef.current.textContent = "";
            }
          }}
        >
          <X className="h-3.5 w-3.5" />
          清除
        </Button>
        <span
          ref={labelRef}
          className="text-sm text-muted-foreground truncate max-w-xs"
        />
      </div>

      <input
        ref={inputRef}
        type="file"
        name="attachment"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.gif,.xlsx,.xls,.doc,.docx"
        onChange={(e) => {
          if (labelRef.current) {
            labelRef.current.textContent = e.target.files?.[0]?.name ?? "";
          }
        }}
      />
    </div>
  );
}
