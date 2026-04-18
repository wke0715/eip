"use client";

import { useTransition } from "react";
import { exportLogsAsCsv } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download } from "lucide-react";

interface Log {
  id: string;
  userId: string | null;
  userName: string | null;
  action: string;
  target: string | null;
  detail: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export function LogTable({ logs, total }: { logs: Log[]; total: number }) {
  const [isPending, startTransition] = useTransition();

  function handleExport() {
    startTransition(async () => {
      const csv = await exportLogsAsCsv();
      const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `system-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          操作紀錄（共 {total} 筆）
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={handleExport}
        >
          <Download className="mr-2 h-4 w-4" />
          匯出 CSV
        </Button>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            尚無操作紀錄
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>時間</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>操作類型</TableHead>
                <TableHead>操作目標</TableHead>
                <TableHead>詳細內容</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {log.createdAt}
                  </TableCell>
                  <TableCell>{log.userName ?? "-"}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.target ?? "-"}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {log.detail ?? "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
