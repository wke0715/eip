"use client";

import { useTransition, useState } from "react";
import { updateSmtpConfig, testSmtpConnection } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SmtpConfig = {
  senderName: string;
  senderEmail: string;
} | null;

export function SmtpForm({ config }: { config: SmtpConfig }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [fields, setFields] = useState({
    senderName: config?.senderName ?? "",
    senderEmail: config?.senderEmail ?? "",
  });

  function setField(key: keyof typeof fields) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setFields((prev) => ({ ...prev, [key]: e.target.value }));
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await updateSmtpConfig(formData);
        setSuccess("設定已儲存");
      } catch (e) {
        setError(e instanceof Error ? e.message : "儲存失敗");
      }
    });
  }

  function handleTest() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const result = await testSmtpConnection();
        if (result.error) { setError(result.error); return; }
        setSuccess(result.message ?? "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "測試失敗");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">郵件設定</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          郵件透過 Resend 發送，API Key 請設定於 Railway 環境變數{" "}
          <code className="rounded bg-muted px-1">RESEND_API_KEY</code>。
        </p>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="senderName">寄件人名稱</Label>
              <Input
                id="senderName"
                name="senderName"
                required
                value={fields.senderName}
                onChange={setField("senderName")}
                placeholder="企盉 EIP 系統"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senderEmail">寄件人 Email</Label>
              <Input
                id="senderEmail"
                name="senderEmail"
                type="email"
                required
                value={fields.senderEmail}
                onChange={setField("senderEmail")}
                placeholder="noreply@yourdomain.com"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "處理中..." : "儲存設定"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={handleTest}
            >
              發送測試信
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
