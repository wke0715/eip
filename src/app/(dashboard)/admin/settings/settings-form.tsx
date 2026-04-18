"use client";

import { useTransition, useState } from "react";
import { updateSystemSetting } from "@/actions/admin";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  settings: Record<string, string>;
}

type SelectField = {
  type?: "select";
  key: string;
  label: string;
  description: string;
  options: string[];
  suffix?: string;
};

type TextField = {
  type: "text";
  key: string;
  label: string;
  description: string;
  placeholder?: string;
};

type SettingField = SelectField | TextField;

const settingFields: SettingField[] = [
  {
    type: "text",
    key: "companyName",
    label: "公司名稱",
    description: "顯示於系統標題與各類文件上的公司名稱",
    placeholder: "請輸入公司名稱",
  },
  {
    key: "timezone",
    label: "時區",
    options: ["Asia/Taipei"],
    description: "全系統統一時區",
  },
  {
    key: "dateFormat",
    label: "日期格式",
    options: ["YYYY-MM-DD", "YYYY/MM/DD", "DD/MM/YYYY"],
    description: "所有使用者看到的日期格式",
  },
  {
    key: "logRetentionMonths",
    label: "Log 保留期限",
    options: ["3", "6", "9", "12"],
    description: "超過期限的 Log 將自動清除",
    suffix: "個月",
  },
  {
    key: "maxAttachmentSizeMb",
    label: "附件上傳大小上限",
    options: ["1", "2", "5", "10", "20"],
    description: "申請表單附件的最大允許檔案大小",
    suffix: "MB",
  },
];

export function SettingsForm({ settings }: Props) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const [textValues, setTextValues] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        settingFields
          .filter((f): f is TextField => f.type === "text")
          .map((f) => [f.key, settings[f.key] ?? ""])
      )
  );

  function handleSave(key: string, value: string) {
    const formData = new FormData();
    formData.set("key", key);
    formData.set("value", value);

    startTransition(async () => {
      await updateSystemSetting(formData);
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    });
  }

  return (
    <div className="space-y-4">
      {settingFields.map((field) => (
        <Card key={field.key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{field.label}</CardTitle>
            <p className="text-xs text-muted-foreground">{field.description}</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Label className="sr-only">{field.label}</Label>
              {field.type === "text" ? (
                <>
                  <Input
                    value={textValues[field.key]}
                    onChange={(e) =>
                      setTextValues((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    placeholder={field.placeholder}
                    disabled={isPending}
                    className="max-w-xs"
                  />
                  <Button
                    size="sm"
                    disabled={isPending || !textValues[field.key]?.trim()}
                    onClick={() => handleSave(field.key, textValues[field.key])}
                  >
                    儲存
                  </Button>
                </>
              ) : (
                <select
                  defaultValue={settings[field.key] ?? field.options[0]}
                  onChange={(e) => handleSave(field.key, e.target.value)}
                  disabled={isPending}
                  className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                >
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                      {field.suffix ? ` ${field.suffix}` : ""}
                    </option>
                  ))}
                </select>
              )}
              {saved === field.key && (
                <span className="text-sm text-green-600">已儲存</span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
