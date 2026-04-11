"use client";

import { useTransition, useState } from "react";
import { updateSystemSetting } from "@/actions/admin";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  settings: Record<string, string>;
}

const settingFields = [
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
];

export function SettingsForm({ settings }: Props) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);

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
