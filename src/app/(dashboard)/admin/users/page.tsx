import { getUsers, getDepartments } from "@/actions/admin";
import { UserTable } from "./user-table";
import { CreateUserDialog } from "./create-user-dialog";

export default async function AdminUsersPage() {
  const [users, departments] = await Promise.all([
    getUsers(),
    getDepartments(),
  ]);

  // 建立可選主管清單（所有 active 使用者）
  const managerOptions = users
    .filter((u) => u.isActive)
    .map((u) => ({ id: u.id, name: u.name, email: u.email }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">人員管理</h1>
        <CreateUserDialog
          departments={departments}
          managers={managerOptions}
        />
      </div>
      <UserTable
        users={users}
        departments={departments}
        managers={managerOptions}
      />
    </div>
  );
}
