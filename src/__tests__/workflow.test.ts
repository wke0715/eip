import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { resolveWorkflowApprovers } from "@/lib/workflow";

type MockTx = {
  user: { findUnique: ReturnType<typeof vi.fn> };
};

function makeTx(
  users: Record<string, { managerId: string | null } | null> = {},
): MockTx {
  return {
    user: {
      findUnique: vi
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) =>
          Promise.resolve(users[where.id] ?? null),
        ),
    },
  };
}

describe("resolveWorkflowApprovers", () => {
  it("steps 為空應回傳空陣列", async () => {
    const tx = makeTx();
    const result = await resolveWorkflowApprovers(tx as never, "user-1", []);
    expect(result).toEqual([]);
  });

  it("USER: 前綴應直接使用指定的 approverId", async () => {
    const tx = makeTx();
    const result = await resolveWorkflowApprovers(tx as never, "user-1", [
      { stepOrder: 1, approverRole: "USER:approver-abc" },
    ]);
    expect(result).toEqual([{ stepOrder: 1, approverId: "approver-abc" }]);
    expect(tx.user.findUnique).not.toHaveBeenCalled();
  });

  it("多個 USER: 步驟應全部解析", async () => {
    const tx = makeTx();
    const result = await resolveWorkflowApprovers(tx as never, "user-1", [
      { stepOrder: 1, approverRole: "USER:mgr-1" },
      { stepOrder: 2, approverRole: "USER:mgr-2" },
    ]);
    expect(result).toEqual([
      { stepOrder: 1, approverId: "mgr-1" },
      { stepOrder: 2, approverId: "mgr-2" },
    ]);
  });

  it("DIRECT_MANAGER 第一步應查詢申請人的直屬主管", async () => {
    const tx = makeTx({ "user-1": { managerId: "mgr-1" } });
    const result = await resolveWorkflowApprovers(tx as never, "user-1", [
      { stepOrder: 1, approverRole: "DIRECT_MANAGER" },
    ]);
    expect(result).toEqual([{ stepOrder: 1, approverId: "mgr-1" }]);
  });

  it("DIRECT_MANAGER 申請人無主管應拋出錯誤", async () => {
    const tx = makeTx({ "user-1": { managerId: null } });
    await expect(
      resolveWorkflowApprovers(tx as never, "user-1", [
        { stepOrder: 1, approverRole: "DIRECT_MANAGER" },
      ]),
    ).rejects.toThrow("您尚未設定直屬主管");
  });

  it("DIRECT_MANAGER 第二步應查詢上一關審核者的主管", async () => {
    const tx = makeTx({
      "user-1": { managerId: "mgr-1" },
      "mgr-1": { managerId: "mgr-2" },
    });
    const result = await resolveWorkflowApprovers(tx as never, "user-1", [
      { stepOrder: 1, approverRole: "DIRECT_MANAGER" },
      { stepOrder: 2, approverRole: "DIRECT_MANAGER" },
    ]);
    expect(result).toEqual([
      { stepOrder: 1, approverId: "mgr-1" },
      { stepOrder: 2, approverId: "mgr-2" },
    ]);
  });

  it("混合 USER: 與 DIRECT_MANAGER 步驟", async () => {
    const tx = makeTx({ "user-1": { managerId: "mgr-1" } });
    const result = await resolveWorkflowApprovers(tx as never, "user-1", [
      { stepOrder: 1, approverRole: "DIRECT_MANAGER" },
      { stepOrder: 2, approverRole: "USER:fixed-approver" },
    ]);
    expect(result).toEqual([
      { stepOrder: 1, approverId: "mgr-1" },
      { stepOrder: 2, approverId: "fixed-approver" },
    ]);
  });

  it("上一關審核者無主管應拋出含步驟編號的錯誤", async () => {
    const tx = makeTx({
      "user-1": { managerId: "mgr-1" },
      "mgr-1": { managerId: null, name: "主管A" },
    });
    await expect(
      resolveWorkflowApprovers(tx as never, "user-1", [
        { stepOrder: 1, approverRole: "DIRECT_MANAGER" },
        { stepOrder: 2, approverRole: "DIRECT_MANAGER" },
      ]),
    ).rejects.toThrow("第 1 關簽核者");
  });
});
