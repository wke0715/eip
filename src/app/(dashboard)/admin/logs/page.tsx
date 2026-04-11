import { getSystemLogs } from "@/actions/admin";
import { LogTable } from "./log-table";

export default async function AdminLogsPage() {
  const { logs, total } = await getSystemLogs();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">系統 Log 管理</h1>
      <LogTable logs={logs} total={total} />
    </div>
  );
}
