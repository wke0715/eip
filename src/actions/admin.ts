"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
    managerId: formData.get("managerId") || undefined,
  };

  const parsed = createUserSchema.parse(raw);

  const existing = await prisma.user.findUnique({
    where: { email: parsed.email },
  });
  if (existing) return { error: "此 Email 已存在" };

  await prisma.user.create({ data: parsed });

  await prisma.systemLog.create({
    data: {
      userId: session.user.id,
      action: "ADMIN_CREATE_USER",
      target: parsed.email,
      detail: JSON.stringify({ name: parsed.name, role: parsed.role }),
    },
  });

  revalidatePath("/admin/users");
}

export async function updateUser(formData: FormData) {
  const session = await requireAdmin();

  const raw = {
    id: formData.get("id"),
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
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

  revalidatePath("/admin/users");
}

export async function deleteUser(id: string) {
  const session = await requireAdmin();

  const user = await prisma.user.findUniqueOrThrow({ where: { id } });

  if (user.email === process.env.INITIAL_ADMIN_EMAIL) {
    throw new Error("無法刪除初始管理員帳號");
  }
  if (user.id === session.user.id) {
    throw new Error("無法刪除自己的帳號");
  }

  await prisma.user.delete({ where: { id } });

  await prisma.systemLog.create({
    data: {
      userId: session.user.id,
      action: "ADMIN_DELETE_USER",
      target: user.email,
    },
  });

  revalidatePath("/admin/users");
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

  // 批次查詢操作者姓名
  const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))] as string[];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name ?? u.email]));

  const fmt = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const logsWithName = logs.map((l) => ({
    ...l,
    createdAt: fmt.format(l.createdAt),
    userName: l.userId ? (userMap[l.userId] ?? l.userId) : null,
  }));

  return { logs: logsWithName, total, page, pageSize };
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

  revalidatePath("/admin/settings");
}

// ─── SMTP 管理 ───

export async function getSmtpConfig() {
  await requireAdmin();
  const config = await prisma.smtpConfig.findFirst({
    where: { isActive: true },
  });
  if (!config) return null;
  return { senderName: config.senderName, senderEmail: config.senderEmail };
}

export async function updateSmtpConfig(formData: FormData) {
  const session = await requireAdmin();

  const raw = {
    senderName: formData.get("senderName"),
    senderEmail: formData.get("senderEmail"),
  };

  const parsed = smtpConfigSchema.parse(raw);

  const existing = await prisma.smtpConfig.findFirst({
    where: { isActive: true },
  });

  if (existing) {
    await prisma.smtpConfig.update({
      where: { id: existing.id },
      data: { senderName: parsed.senderName, senderEmail: parsed.senderEmail },
    });
  } else {
    await prisma.smtpConfig.create({
      data: { senderName: parsed.senderName, senderEmail: parsed.senderEmail },
    });
  }

  await prisma.systemLog.create({
    data: {
      userId: session.user.id,
      action: "ADMIN_UPDATE_SMTP",
      target: parsed.senderEmail,
    },
  });

  revalidatePath("/admin/smtp");
}

export async function testSmtpConnection() {
  try {
    const session = await requireAdmin();

    const gmailUser = process.env.GMAIL_USER;
    if (!gmailUser) return { error: "未設定 GMAIL_USER 環境變數" };

    const config = await prisma.smtpConfig.findFirst({ where: { isActive: true } });
    const senderName = config?.senderName ?? "企盉 EIP";
    const to = session.user.email!;

    const { sendViaGmail } = await import("@/lib/gmail");
    await sendViaGmail({
      from: `${senderName} <${gmailUser}>`,
      to: [to],
      subject: "企盉 EIP — 郵件功能測試",
      text: "這是一封郵件功能測試信，收到代表設定正確。",
      html: "<p>這是一封<strong>郵件功能測試信</strong>，收到代表設定正確。</p>",
    });

    return { success: true, message: `測試信已寄送至 ${to}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[testSmtpConnection] error:", msg, e);
    return { error: `發送失敗：${msg}` };
  }
}

// ─── 會議室管理 ───

export async function getMeetingRoomsAdmin() {
  await requireAdmin();
  return prisma.meetingRoom.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createMeetingRoom(formData: FormData) {
  const session = await requireAdmin();

  const name = (formData.get("name") as string)?.trim();
  const location = (formData.get("location") as string)?.trim() || null;
  const capacityRaw = formData.get("capacity") as string;
  const capacity = capacityRaw ? Number.parseInt(capacityRaw, 10) : null;

  if (!name) throw new Error("請填寫會議室名稱");

  const existing = await prisma.meetingRoom.findUnique({ where: { name } });
  if (existing) throw new Error("此名稱已存在");

  await prisma.meetingRoom.create({
    data: { name, location, capacity },
  });

  await prisma.systemLog.create({
    data: {
      userId: session.user.id,
      action: "ADMIN_CREATE_ROOM",
      target: name,
    },
  });

  revalidatePath("/admin/rooms");
}

export async function updateMeetingRoom(formData: FormData) {
  const session = await requireAdmin();

  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const location = (formData.get("location") as string)?.trim() || null;
  const capacityRaw = formData.get("capacity") as string;
  const capacity = capacityRaw ? Number.parseInt(capacityRaw, 10) : null;

  if (!id) throw new Error("缺少會議室 ID");
  if (!name) throw new Error("請填寫會議室名稱");

  const conflict = await prisma.meetingRoom.findFirst({
    where: { name, NOT: { id } },
  });
  if (conflict) throw new Error("此名稱已存在");

  await prisma.meetingRoom.update({
    where: { id },
    data: { name, location, capacity },
  });

  await prisma.systemLog.create({
    data: {
      userId: session.user.id,
      action: "ADMIN_UPDATE_ROOM",
      target: name,
    },
  });

  revalidatePath("/admin/rooms");
}

export async function toggleMeetingRoomStatus(id: string) {
  const session = await requireAdmin();

  const room = await prisma.meetingRoom.findUniqueOrThrow({ where: { id } });

  await prisma.meetingRoom.update({
    where: { id },
    data: { isActive: !room.isActive },
  });

  await prisma.systemLog.create({
    data: {
      userId: session.user.id,
      action: "ADMIN_UPDATE_ROOM",
      target: room.name,
      detail: JSON.stringify({ isActive: !room.isActive }),
    },
  });

  revalidatePath("/admin/rooms");
}

// ─── 簽核流程設定 ───

export async function getWorkflowConfigs() {
  await requireAdmin();
  return prisma.workflowConfig.findMany({
    orderBy: [{ formType: "asc" }, { stepOrder: "asc" }],
  });
}

export async function upsertWorkflowConfig(formData: FormData) {
  const session = await requireAdmin();

  const raw = {
    formType: formData.get("formType"),
    steps: JSON.parse(formData.get("steps") as string),
  };

  const parsed = workflowConfigSchema.parse(raw);

  // 刪除舊的設定，重新建立
  await prisma.$transaction(async (tx) => {
    await tx.workflowConfig.deleteMany({
      where: { formType: parsed.formType },
    });

    await tx.workflowConfig.createMany({
      data: parsed.steps.map((step) => ({
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
      target: parsed.formType,
      detail: JSON.stringify(parsed.steps),
    },
  });

  revalidatePath("/admin/workflow");
}
