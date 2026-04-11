"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { createUserSchema, updateUserSchema } from "@/lib/validators/user";
import {
  updateSystemSettingSchema,
  smtpConfigSchema,
  workflowConfigSchema,
} from "@/lib/validators/settings";
import { revalidatePath } from "next/cache";

// ─── 權限檢查 ───

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登入");
  if (session.user.role !== "ADMIN") throw new Error("權限不足");
  return session;
}

// ─── 人員管理 ───

export async function getUsers() {
  await requireAdmin();
  return prisma.user.findMany({
    include: {
      department: { select: { id: true, name: true } },
      manager: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createUser(formData: FormData) {
  const session = await requireAdmin();

  const raw = {
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
    departmentId: formData.get("departmentId") || undefined,
    managerId: formData.get("managerId") || undefined,
  };

  const parsed = createUserSchema.parse(raw);

  const existing = await prisma.user.findUnique({
    where: { email: parsed.email },
  });
  if (existing) throw new Error("此 Email 已存在");

  await prisma.user.create({ data: parsed });

  await prisma.systemLog.create({
    data: {
      userId: session.user.id,
      action: "ADMIN_CREATE_USER",
      target: parsed.email,
      detail: JSON.stringify({ name: parsed.name, role: parsed.role }),
    },
  });

  revalidatePath("/dashboard/admin/users");
}

export async function updateUser(formData: FormData) {
  const session = await requireAdmin();

  const raw = {
    id: formData.get("id"),
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
    departmentId: formData.get("departmentId") || undefined,
    managerId: formData.get("managerId") || undefined,
    isActive: formData.get("isActive") === "true",
  };

  const parsed = updateUserSchema.parse(raw);
  const { id, ...data } = parsed;

  await prisma.user.update({ where: { id }, data });

  await prisma.systemLog.create({
    data: {
      userId: session.user.id,
      action: "ADMIN_UPDATE_USER",
      target: parsed.email,
      detail: JSON.stringify(data),
    },
  });

  revalidatePath("/dashboard/admin/users");
}

export async function getDepartments() {
  return prisma.department.findMany({ orderBy: { name: "asc" } });
}

export async function createDepartment(name: string) {
  await requireAdmin();
  return prisma.department.create({ data: { name } });
}

// ─── 系統 Log ───

export async function getSystemLogs(page = 1, pageSize = 50) {
  await requireAdmin();

  const [logs, total] = await Promise.all([
    prisma.systemLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.systemLog.count(),
  ]);

  return { logs, total, page, pageSize };
}

export async function exportLogsAsCsv() {
  await requireAdmin();

  const logs = await prisma.systemLog.findMany({
    orderBy: { createdAt: "desc" },
  });

  const header = "ID,操作者ID,操作類型,操作目標,詳細內容,IP位址,時間";
  const rows = logs.map(
    (l) =>
      `"${l.id}","${l.userId ?? ""}","${l.action}","${l.target ?? ""}","${(l.detail ?? "").replace(/"/g, '""')}","${l.ipAddress ?? ""}","${l.createdAt.toISOString()}"`
  );

  return [header, ...rows].join("\n");
}

// ─── 系統設定 ───

export async function getSystemSettings() {
  await requireAdmin();
  return prisma.systemSetting.findMany();
}

export async function updateSystemSetting(formData: FormData) {
  const session = await requireAdmin();

  const raw = {
    key: formData.get("key"),
    value: formData.get("value"),
  };

  const parsed = updateSystemSettingSchema.parse(raw);

  await prisma.systemSetting.upsert({
    where: { key: parsed.key },
    update: { value: parsed.value },
    create: parsed,
  });

  await prisma.systemLog.create({
    data: {
      userId: session.user.id,
      action: "ADMIN_UPDATE_SETTING",
      target: parsed.key,
      detail: JSON.stringify({ value: parsed.value }),
    },
  });

  revalidatePath("/dashboard/admin/settings");
}

// ─── SMTP 管理 ───

export async function getSmtpConfig() {
  await requireAdmin();
  const config = await prisma.smtpConfig.findFirst({
    where: { isActive: true },
  });
  if (!config) return null;
  // 不回傳密碼
  return { ...config, encryptedPassword: undefined };
}

export async function updateSmtpConfig(formData: FormData) {
  const session = await requireAdmin();

  const raw = {
    host: formData.get("host"),
    port: formData.get("port"),
    username: formData.get("username"),
    password: formData.get("password"),
    senderName: formData.get("senderName"),
    senderEmail: formData.get("senderEmail"),
    encryption: formData.get("encryption"),
  };

  const parsed = smtpConfigSchema.parse(raw);
  const encryptedPassword = encrypt(parsed.password);

  // Upsert: 只保留一筆 active 設定
  const existing = await prisma.smtpConfig.findFirst({
    where: { isActive: true },
  });

  if (existing) {
    await prisma.smtpConfig.update({
      where: { id: existing.id },
      data: {
        host: parsed.host,
        port: parsed.port,
        username: parsed.username,
        encryptedPassword,
        senderName: parsed.senderName,
        senderEmail: parsed.senderEmail,
        encryption: parsed.encryption,
      },
    });
  } else {
    await prisma.smtpConfig.create({
      data: {
        host: parsed.host,
        port: parsed.port,
        username: parsed.username,
        encryptedPassword,
        senderName: parsed.senderName,
        senderEmail: parsed.senderEmail,
        encryption: parsed.encryption,
      },
    });
  }

  await prisma.systemLog.create({
    data: {
      userId: session.user.id,
      action: "ADMIN_UPDATE_SMTP",
      target: parsed.host,
    },
  });

  revalidatePath("/dashboard/admin/smtp");
}

export async function testSmtpConnection() {
  await requireAdmin();
  // 預留：待 SMTP 設定完成後實作真實寄信
  return { success: true, message: "SMTP 測試功能預留，待設定完成後啟用" };
}

// ─── 簽核流程設定 ───

export async function getWorkflowConfigs() {
  await requireAdmin();
  return prisma.workflowConfig.findMany({
    include: { department: { select: { id: true, name: true } } },
    orderBy: [{ departmentId: "asc" }, { formType: "asc" }, { stepOrder: "asc" }],
  });
}

export async function upsertWorkflowConfig(formData: FormData) {
  const session = await requireAdmin();

  const raw = {
    departmentId: formData.get("departmentId"),
    formType: formData.get("formType"),
    steps: JSON.parse(formData.get("steps") as string),
  };

  const parsed = workflowConfigSchema.parse(raw);

  // 刪除舊的設定，重新建立
  await prisma.$transaction(async (tx) => {
    await tx.workflowConfig.deleteMany({
      where: {
        departmentId: parsed.departmentId,
        formType: parsed.formType,
      },
    });

    await tx.workflowConfig.createMany({
      data: parsed.steps.map((step) => ({
        departmentId: parsed.departmentId,
        formType: parsed.formType,
        stepOrder: step.stepOrder,
        approverRole: step.approverRole,
      })),
    });
  });

  await prisma.systemLog.create({
    data: {
      userId: session.user.id,
      action: "ADMIN_UPDATE_WORKFLOW",
      target: `${parsed.departmentId}/${parsed.formType}`,
      detail: JSON.stringify(parsed.steps),
    },
  });

  revalidatePath("/dashboard/admin/workflow");
}
