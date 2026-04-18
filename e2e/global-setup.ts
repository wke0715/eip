import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

async function globalSetup() {
  const prisma = new PrismaClient();

  // 確保測試用主管存在
  await prisma.user.upsert({
    where: { id: "test-manager-id" },
    update: {},
    create: {
      id: "test-manager-id",
      email: "testmanager@example.com",
      name: "測試主管",
      role: "USER",
      isActive: true,
    },
  });

  // 確保 mock auth 用的 test-user-id 在 DB 存在，並設定直屬主管
  await prisma.user.upsert({
    where: { id: "test-user-id" },
    update: { managerId: "test-manager-id" },
    create: {
      id: "test-user-id",
      email: "testuser@example.com",
      name: "測試使用者",
      role: "USER",
      isActive: true,
      managerId: "test-manager-id",
    },
  });

  // 確保測試用 ADMIN 帳號存在
  await prisma.user.upsert({
    where: { id: "test-admin-id" },
    update: { role: "ADMIN", isActive: true },
    create: {
      id: "test-admin-id",
      email: "testadmin@example.com",
      name: "測試管理員",
      role: "ADMIN",
      isActive: true,
    },
  });

  // 清除測試使用者的舊假單（避免跨次測試時段重疊）
  // 需先刪子表 LeaveRequest，再刪 FormSubmission
  const testSubs = await prisma.formSubmission.findMany({
    where: { applicantId: "test-user-id", formType: "LEAVE" },
    select: { id: true },
  });
  const testSubIds = testSubs.map((s) => s.id);
  if (testSubIds.length > 0) {
    await prisma.leaveRequest.deleteMany({ where: { submissionId: { in: testSubIds } } });
    await prisma.approvalAction.deleteMany({ where: { submissionId: { in: testSubIds } } });
    await prisma.notification.deleteMany({ where: { submissionId: { in: testSubIds } } });
    await prisma.formSubmission.deleteMany({ where: { id: { in: testSubIds } } });
  }

  // 確保假別資料存在
  const leaveTypes = [
    { name: "特休", code: "ANNUAL" },
    { name: "病假", code: "SICK" },
    { name: "事假", code: "PERSONAL" },
    { name: "公假", code: "OFFICIAL" },
    { name: "婚假", code: "MARRIAGE" },
    { name: "喪假", code: "BEREAVEMENT" },
    { name: "產假", code: "MATERNITY" },
    { name: "陪產假", code: "PATERNITY" },
  ];
  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { code: lt.code },
      update: {},
      create: lt,
    });
  }

  // 清除測試用會議室的所有預約（避免跨次測試衝突）
  // 注意：auth jwt callback 會把 token.id 替換成 DB 真實 user id，
  // 所以不能用 "test-user-id" 過濾，改用 roomId 清乾淨
  await prisma.meetingBooking.deleteMany({
    where: { roomId: "test-room-id" },
  });

  // 確保測試用會議室存在
  await prisma.meetingRoom.upsert({
    where: { id: "test-room-id" },
    update: {},
    create: {
      id: "test-room-id",
      name: "測試會議室 A",
      location: "1F",
      capacity: 10,
      isActive: true,
    },
  });

  // 清除 SMTP 設定（避免跨次測試狀態殘留）
  await prisma.smtpConfig.deleteMany({});

  await prisma.$disconnect();
}

export default globalSetup;
