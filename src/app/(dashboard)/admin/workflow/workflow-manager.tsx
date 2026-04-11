"use client";

import { useState, useTransition } from "react";
import { upsertWorkflowConfig } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";

interface WorkflowConfig {
  id: string;
  departmentId: string;
  formType: string;
  stepOrder: number;
  approverRole: string;
  department: { id: string; name: string };
}

interface Department {
  id: string;
  name: string;
}

const APPROVER_ROLES = [
  { value: "DIRECT_MANAGER", label: "直屬主管" },
  { value: "DEPT_MANAGER", label: "部門主管" },
  { value: "HR", label: "HR" },
  { value: "CEO", label: "CEO" },
];

interface Props {
  configs: WorkflowConfig[];
  departments: Department[];
}

export function WorkflowManager({ configs, departments }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState("");
  const [steps, setSteps] = useState<
    Array<{ stepOrder: number; approverRole: string }>
  >([{ stepOrder: 1, approverRole: "DIRECT_MANAGER" }]);

  // 按部門分組顯示現有設定
  const grouped = configs.reduce(
    (acc, c) => {
      const key = `${c.department.name} / ${c.formType === "LEAVE" ? "請假單" : c.formType}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(c);
      return acc;
    },
    {} as Record<string, WorkflowConfig[]>
  );

  function addStep() {
    setSteps((prev) => [
      ...prev,
      { stepOrder: prev.length + 1, approverRole: "DIRECT_MANAGER" },
    ]);
  }

  function removeStep(index: number) {
    setSteps((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, stepOrder: i + 1 }))
    );
  }

  function handleSubmit() {
    if (!selectedDept) {
      setError("請選擇部門");
      return;
    }
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.set("departmentId", selectedDept);
    formData.set("formType", "LEAVE");
    formData.set("steps", JSON.stringify(steps));

    startTransition(async () => {
      try {
        await upsertWorkflowConfig(formData);
        setSuccess("簽核流程已儲存");
      } catch (e) {
        setError(e instanceof Error ? e.message : "儲存失敗");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* 現有設定 */}
      {Object.keys(grouped).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">目前簽核流程</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.entries(grouped).map(([key, items]) => (
              <div key={key} className="mb-4 last:mb-0">
                <p className="text-sm font-medium mb-2">{key}</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>關卡</TableHead>
                      <TableHead>簽核者角色</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>第 {item.stepOrder} 關</TableCell>
                        <TableCell>
                          {APPROVER_ROLES.find(
                            (r) => r.value === item.approverRole
                          )?.label ?? item.approverRole}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 新增/修改 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">設定簽核流程</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>部門</Label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              >
                <option value="">選擇部門</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>表單類型</Label>
              <Input value="請假單" disabled />
            </div>
          </div>

          <div className="space-y-2">
            <Label>簽核關卡</Label>
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-16">
                  第 {step.stepOrder} 關
                </span>
                <select
                  value={step.approverRole}
                  onChange={(e) =>
                    setSteps((prev) =>
                      prev.map((s, j) =>
                        j === i
                          ? { ...s, approverRole: e.target.value }
                          : s
                      )
                    )
                  }
                  className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                >
                  {APPROVER_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                {steps.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeStep(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={addStep}>
              <Plus className="mr-1 h-4 w-4" />
              新增關卡
            </Button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}

          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "儲存中..." : "儲存簽核流程"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
