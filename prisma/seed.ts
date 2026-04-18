import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 建立假別
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

  // 建立預設系統設定
  const settings = [
    { key: "timezone", value: "Asia/Taipei" },
    { key: "dateFormat", value: "YYYY-MM-DD" },
    { key: "logRetentionMonths", value: "12" },
  ];

  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  // 建立預設簽核流程（請假單 → 直屬主管）
  await prisma.workflowConfig.upsert({
    where: { formType_stepOrder: { formType: "LEAVE", stepOrder: 1 } },
    update: {},
    create: { formType: "LEAVE", stepOrder: 1, approverRole: "DIRECT_MANAGER" },
  });

  console.log("Seed 完成");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
