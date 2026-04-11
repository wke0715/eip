import { getWorkflowConfigs, getDepartments } from "@/actions/admin";
import { WorkflowManager } from "./workflow-manager";

export default async function AdminWorkflowPage() {
  const [configs, departments] = await Promise.all([
    getWorkflowConfigs(),
    getDepartments(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">簽核流程設定</h1>
      <WorkflowManager configs={configs} departments={departments} />
    </div>
  );
}
