import { getUsers, getWorkflowConfigs } from "@/actions/admin";
import { WorkflowManager } from "./workflow-manager";

export default async function AdminWorkflowPage() {
  const [configs, users] = await Promise.all([
    getWorkflowConfigs(),
    getUsers(),
  ]);

  const approverOptions = users
    .filter((u) => u.isActive)
    .map((u) => ({ id: u.id, name: u.name ?? u.email }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">簽核流程設定</h1>
      <WorkflowManager configs={configs} approverOptions={approverOptions} />
    </div>
  );
}
