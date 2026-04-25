import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.hoisted(() => vi.fn());
const mockRevalidatePath = vi.hoisted(() => vi.fn());

const mockTx = {
  workflowConfig: { deleteMany: vi.fn(), createMany: vi.fn() },
};

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  systemLog: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  systemSetting: { findMany: vi.fn(), upsert: vi.fn() },
  smtpConfig: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  meetingRoom: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  workflowConfig: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getSystemLogs,
  exportLogsAsCsv,
  getSystemSettings,
  updateSystemSetting,
  getSmtpConfig,
  updateSmtpConfig,
  getMeetingRoomsAdmin,
  createMeetingRoom,
  updateMeetingRoom,
  toggleMeetingRoomStatus,
  getWorkflowConfigs,
  upsertWorkflowConfig,
} from "@/actions/admin";

const adminSession = { user: { id: "admin-1", email: "admin@example.com", role: "ADMIN" } };
const userSession = { user: { id: "user-1", email: "user@example.com", role: "USER" } };

function makeFormData(data: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.append(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.systemLog.create.mockResolvedValue({});
  mockTx.workflowConfig.deleteMany.mockResolvedValue({});
  mockTx.workflowConfig.createMany.mockResolvedValue({});
});

// ─── requireAdmin 權限守門 ────────────────────────────────────

describe("requireAdmin guard", () => {
  it("未登入應拋出「未登入」", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(getUsers()).rejects.toThrow("未登入");
  });

  it("非管理員應拋出「權限不足」", async () => {
    mockAuth.mockResolvedValue(userSession);
    await expect(getUsers()).rejects.toThrow("權限不足");
  });
});

// ─── getUsers ─────────────────────────────────────────────────

describe("getUsers", () => {
  it("應回傳使用者列表", async () => {
    mockAuth.mockResolvedValue(adminSession);
    const users = [{ id: "u1", name: "佑霖", email: "user@example.com" }];
    mockPrisma.user.findMany.mockResolvedValue(users);

    const result = await getUsers();
    expect(result).toEqual(users);
  });
});

// ─── createUser ───────────────────────────────────────────────

describe("createUser", () => {
  it("Email 已存在應回傳 error", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1" });

    const result = await createUser(makeFormData({
      email: "existing@example.com",
      name: "佑霖",
      role: "USER",
    }));

    expect(result).toEqual({ error: "此 Email 已存在" });
  });

  it("合法資料應建立使用者並 revalidate", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({});

    await createUser(makeFormData({
      email: "new@example.com",
      name: "新人",
      role: "USER",
    }));

    expect(mockPrisma.user.create).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/users");
  });
});

// ─── updateUser ───────────────────────────────────────────────

describe("updateUser", () => {
  it("應更新使用者並 revalidate", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.user.update.mockResolvedValue({});

    await updateUser(makeFormData({
      id: "u-1",
      email: "user@example.com",
      name: "佑霖",
      role: "USER",
      isActive: "true",
    }));

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u-1" } })
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/users");
  });
});

// ─── deleteUser ───────────────────────────────────────────────

describe("deleteUser", () => {
  it("嘗試刪除初始管理員應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(adminSession);
    process.env.INITIAL_ADMIN_EMAIL = "admin@example.com";
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
      id: "u-999",
      email: "admin@example.com",
    });

    await expect(deleteUser("u-999")).rejects.toThrow("無法刪除初始管理員帳號");
  });

  it("嘗試刪除自己應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(adminSession);
    process.env.INITIAL_ADMIN_EMAIL = "other@example.com";
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });

    await expect(deleteUser("admin-1")).rejects.toThrow("無法刪除自己的帳號");
  });

  it("合法刪除應呼叫 delete 並 revalidate", async () => {
    mockAuth.mockResolvedValue(adminSession);
    process.env.INITIAL_ADMIN_EMAIL = "initial@example.com";
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
      id: "u-2",
      email: "target@example.com",
    });
    mockPrisma.user.delete.mockResolvedValue({});

    await deleteUser("u-2");

    expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: "u-2" } });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/users");
  });
});

// ─── getSystemLogs ────────────────────────────────────────────

describe("getSystemLogs", () => {
  it("應回傳帶有 userName 的 log 列表", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.systemLog.findMany.mockResolvedValue([
      { id: "log-1", userId: "u-1", action: "LOGIN", createdAt: new Date("2026-04-25T08:00:00Z") },
    ]);
    mockPrisma.systemLog.count.mockResolvedValue(1);
    mockPrisma.user.findMany.mockResolvedValue([{ id: "u-1", name: "佑霖", email: "u@e.com" }]);

    const result = await getSystemLogs();

    expect(result.total).toBe(1);
    expect(result.logs[0].userName).toBe("佑霖");
    expect(typeof result.logs[0].createdAt).toBe("string");
  });
});

// ─── exportLogsAsCsv ──────────────────────────────────────────

describe("exportLogsAsCsv", () => {
  it("應回傳 CSV 格式字串", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.systemLog.findMany.mockResolvedValue([
      { id: "l1", userId: "u-1", action: "LOGIN", target: null, detail: null, ipAddress: null, createdAt: new Date("2026-04-25T00:00:00Z") },
    ]);

    const csv = await exportLogsAsCsv();

    expect(csv).toContain("ID,操作者ID");
    expect(csv).toContain("l1");
  });
});

// ─── getSystemSettings ────────────────────────────────────────

describe("getSystemSettings", () => {
  it("應回傳設定列表", async () => {
    mockAuth.mockResolvedValue(adminSession);
    const settings = [{ key: "companyName", value: "企盉科技" }];
    mockPrisma.systemSetting.findMany.mockResolvedValue(settings);

    const result = await getSystemSettings();
    expect(result).toEqual(settings);
  });
});

// ─── updateSystemSetting ──────────────────────────────────────

describe("updateSystemSetting", () => {
  it("應 upsert 設定並 revalidate", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.systemSetting.upsert.mockResolvedValue({});

    await updateSystemSetting(makeFormData({ key: "companyName", value: "企盉科技" }));

    expect(mockPrisma.systemSetting.upsert).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/settings");
  });
});

// ─── getSmtpConfig ────────────────────────────────────────────

describe("getSmtpConfig", () => {
  it("沒有設定應回傳 null", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.smtpConfig.findFirst.mockResolvedValue(null);

    const result = await getSmtpConfig();
    expect(result).toBeNull();
  });

  it("有設定應回傳 senderName 和 senderEmail", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.smtpConfig.findFirst.mockResolvedValue({
      senderName: "企盉 EIP",
      senderEmail: "noreply@example.com",
      isActive: true,
    });

    const result = await getSmtpConfig();
    expect(result).toEqual({ senderName: "企盉 EIP", senderEmail: "noreply@example.com" });
  });
});

// ─── updateSmtpConfig ─────────────────────────────────────────

describe("updateSmtpConfig", () => {
  it("無現有設定應建立新設定", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.smtpConfig.findFirst.mockResolvedValue(null);
    mockPrisma.smtpConfig.create.mockResolvedValue({});

    await updateSmtpConfig(makeFormData({ senderName: "EIP", senderEmail: "eip@example.com" }));

    expect(mockPrisma.smtpConfig.create).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/smtp");
  });

  it("有現有設定應更新", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.smtpConfig.findFirst.mockResolvedValue({ id: "smtp-1", isActive: true });
    mockPrisma.smtpConfig.update.mockResolvedValue({});

    await updateSmtpConfig(makeFormData({ senderName: "EIP", senderEmail: "eip@example.com" }));

    expect(mockPrisma.smtpConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "smtp-1" } })
    );
  });
});

// ─── getMeetingRoomsAdmin ─────────────────────────────────────

describe("getMeetingRoomsAdmin", () => {
  it("應回傳所有會議室", async () => {
    mockAuth.mockResolvedValue(adminSession);
    const rooms = [{ id: "r1", name: "大會議室" }];
    mockPrisma.meetingRoom.findMany.mockResolvedValue(rooms);

    const result = await getMeetingRoomsAdmin();
    expect(result).toEqual(rooms);
  });
});

// ─── createMeetingRoom ────────────────────────────────────────

describe("createMeetingRoom", () => {
  it("名稱空白應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(adminSession);
    await expect(createMeetingRoom(makeFormData({ name: "   " }))).rejects.toThrow("請填寫會議室名稱");
  });

  it("名稱已存在應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.meetingRoom.findUnique.mockResolvedValue({ id: "r1" });

    await expect(createMeetingRoom(makeFormData({ name: "大會議室" }))).rejects.toThrow("此名稱已存在");
  });

  it("合法建立應 revalidate", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.meetingRoom.findUnique.mockResolvedValue(null);
    mockPrisma.meetingRoom.create.mockResolvedValue({});

    await createMeetingRoom(makeFormData({ name: "新會議室" }));

    expect(mockPrisma.meetingRoom.create).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/rooms");
  });
});

// ─── updateMeetingRoom ────────────────────────────────────────

describe("updateMeetingRoom", () => {
  it("名稱衝突應拋出錯誤", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.meetingRoom.findFirst.mockResolvedValue({ id: "r2" });

    await expect(updateMeetingRoom(makeFormData({ id: "r1", name: "已有名稱" }))).rejects.toThrow("此名稱已存在");
  });

  it("合法更新應 revalidate", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.meetingRoom.findFirst.mockResolvedValue(null);
    mockPrisma.meetingRoom.update.mockResolvedValue({});

    await updateMeetingRoom(makeFormData({ id: "r1", name: "新名稱" }));

    expect(mockPrisma.meetingRoom.update).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/rooms");
  });
});

// ─── toggleMeetingRoomStatus ──────────────────────────────────

describe("toggleMeetingRoomStatus", () => {
  it("應切換 isActive 狀態", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockPrisma.meetingRoom.findUniqueOrThrow.mockResolvedValue({ id: "r1", name: "大會議室", isActive: true });
    mockPrisma.meetingRoom.update.mockResolvedValue({});

    await toggleMeetingRoomStatus("r1");

    expect(mockPrisma.meetingRoom.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } })
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/rooms");
  });
});

// ─── getWorkflowConfigs ───────────────────────────────────────

describe("getWorkflowConfigs", () => {
  it("應回傳流程設定列表", async () => {
    mockAuth.mockResolvedValue(adminSession);
    const configs = [{ id: "wf-1", formType: "LEAVE", stepOrder: 1 }];
    mockPrisma.workflowConfig.findMany.mockResolvedValue(configs);

    const result = await getWorkflowConfigs();
    expect(result).toEqual(configs);
  });
});

// ─── upsertWorkflowConfig ─────────────────────────────────────

describe("upsertWorkflowConfig", () => {
  it("應刪除舊設定並重新建立", async () => {
    mockAuth.mockResolvedValue(adminSession);

    const steps = JSON.stringify([{ stepOrder: 1, approverRole: "USER:mgr-1" }]);
    await upsertWorkflowConfig(makeFormData({ formType: "LEAVE", steps }));

    expect(mockTx.workflowConfig.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { formType: "LEAVE" } })
    );
    expect(mockTx.workflowConfig.createMany).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/workflow");
  });
});
