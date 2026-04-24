"use client";

import { useTransition, useState } from "react";
import { updateSmtpConfig, testSmtpConnection } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SmtpConfig = {
  host: string;
  port: number;
  username: string;
  senderName: string;
  senderEmail: string;
  encryption: string;
} | null;

export function SmtpForm({ config }: { config: SmtpConfig }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 用受控狀態管理欄位值，避免 Base UI FieldControl uncontrolled 警告
  const [fields, setFields] = useState({
    host: config?.host ?? "",
    port: String(config?.port ?? 587),
    username: config?.username ?? "",
    password: "",
    senderName: config?.senderName ?? "",
    senderEmail: config?.senderEmail ?? "",
    encryption: config?.encryption ?? "TLS",
  });

  function setField(key: keyof typeof fields) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFields((prev) => ({ ...prev, [key]: e.target.value }));
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await updateSmtpConfig(formData);
        setSuccess("SMTP 設定已儲存");
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
      } catch {
        setError("測試失敗");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">SMTP 設定</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host">SMTP Host</Label>
              <Input
                id="host"
                name="host"
                required
                value={fields.host}
                onChange={setField("host")}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                name="port"
                type="number"
                required
                value={fields.port}
                onChange={setField("port")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">帳號</Label>
              <Input
                id="username"
                name="username"
                required
                value={fields.username}
                onChange={setField("username")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密碼</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                value={fields.password}
                onChange={setField("password")}
                placeholder="每次儲存需重新輸入"
              />
            </div>
          </div>

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
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="encryption">加密方式</Label>
            <select
              id="encryption"
              name="encryption"
              value={fields.encryption}
              onChange={setField("encryption")}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            >
              <option value="TLS">TLS</option>
              <option value="SSL">SSL</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "儲存中..." : "儲存設定"}
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
