"use client";

import { useState, useTransition, useMemo } from "react";
import { upsertWorkflowConfig } from "@/actions/admin";
import { Button } from "@/components/ui/button";
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
  formType: string;
  stepOrder: number;
  approverRole: string;
}

interface ApproverOption {
  id: string;
  name: string;
}

const FORM_TYPES = [
  { value: "LEAVE", label: "請假單" },
  { value: "EXPENSE", label: "出差旅費報告單" },
  { value: "OTHER_EXPENSE", label: "其他費用申請單" },
  { value: "OVERTIME", label: "加班單" },
] as const;

const FORM_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  FORM_TYPES.map((t) => [t.value, t.label]),
);

const USER_PREFIX = "USER:";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs";

interface Props {
  readonly configs: readonly WorkflowConfig[];
  readonly approverOptions: readonly ApproverOption[];
}

function approverLabel(
  approverRole: string,
  approverOptions: readonly ApproverOption[],
): string {
  if (approverRole === "DIRECT_MANAGER") return "直屬主管";
  if (approverRole.startsWith(USER_PREFIX)) {
    const id = approverRole.slice(USER_PREFIX.length);
    const user = approverOptions.find((u) => u.id === id);
    return user ? user.name : `未知使用者（${id}）`;
  }
  return approverRole;
}

type Step = { stepOrder: number; approverRole: string };

function buildInitialSteps(
  configs: readonly WorkflowConfig[],
): Record<string, Step[]> {
  const map: Record<string, Step[]> = {};
  for (const t of FORM_TYPES) {
    const typeConfigs = configs
      .filter((c) => c.formType === t.value)
      .sort((a, b) => a.stepOrder - b.stepOrder);
    map[t.value] =
      typeConfigs.length > 0
        ? typeConfigs.map((c) => ({
            stepOrder: c.stepOrder,
            approverRole: c.approverRole,
          }))
        : [{ stepOrder: 1, approverRole: "DIRECT_MANAGER" }];
  }
  return map;
}

export function WorkflowManager({ configs, approverOptions }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>("LEAVE");
  const [stepsByType, setStepsByType] = useState<Record<string, Step[]>>(() =>
    buildInitialSteps(configs),
  );

  const steps = stepsByType[selectedType] ?? [];

  const configsByType = useMemo(() => {
    const map: Record<string, WorkflowConfig[]> = {};
    for (const c of configs) {
      if (!map[c.formType]) map[c.formType] = [];
      map[c.formType].push(c);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.stepOrder - b.stepOrder);
    }
    return map;
  }, [configs]);

  function updateStepsForType(update: (prev: Step[]) => Step[]) {
    setStepsByType((prev) => ({
      ...prev,
      [selectedType]: update(prev[selectedType] ?? []),
    }));
  }

  function addStep() {
    updateStepsForType((prev) => [
      ...prev,
      { stepOrder: prev.length + 1, approverRole: "DIRECT_MANAGER" },
    ]);
  }

  function removeStep(index: number) {
    updateStepsForType((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, stepOrder: i + 1 })),
    );
  }

  function updateStepApprover(index: number, approverRole: string) {
    updateStepsForType((prev) =>
      prev.map((s, j) => (j === index ? { ...s, approverRole } : s)),
    );
  }

  function handleSubmit() {
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.set("formType", selectedType);
    formData.set("steps", JSON.stringify(steps));

    startTransition(async () => {
      try {
        await upsertWorkflowConfig(formData);
        setSuccess(
          `${FORM_TYPE_LABELS[selectedType] ?? selectedType} 簽核流程已儲存`,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "儲存失敗");
      }
    });
  }

  const hasAnyConfig = configs.length > 0;

  return (
    <div className="space-y-6">
      {hasAnyConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">目前簽核流程</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {FORM_TYPES.map((t) => {
              const typeConfigs = configsByType[t.value] ?? [];
              if (typeConfigs.length === 0) return null;
              return (
                <div key={t.value}>
                  <p className="text-sm font-medium mb-2">{t.label}</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">關卡</TableHead>
                        <TableHead>簽核者</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {typeConfigs.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>第 {item.stepOrder} 關</TableCell>
                          <TableCell>
                            {approverLabel(item.approverRole, approverOptions)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">設定簽核流程</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="formType">表單類型</Label>
            <select
              id="formType"
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setError(null);
                setSuccess(null);
              }}
              className={selectClass}
            >
              {FORM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>簽核關卡</Label>
            {steps.map((step, i) => (
              <div key={step.stepOrder} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-16">
                  第 {step.stepOrder} 關
                </span>
                <select
                  value={step.approverRole}
                  onChange={(e) => updateStepApprover(i, e.target.value)}
                  className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                >
                  <option value="DIRECT_MANAGER">直屬主管</option>
                  {approverOptions.length > 0 && (
                    <optgroup label="指定使用者">
                      {approverOptions.map((u) => (
                        <option key={u.id} value={`${USER_PREFIX}${u.id}`}>
                          {u.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
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
