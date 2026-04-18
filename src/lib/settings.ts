import { prisma } from "./prisma";

export async function getCompanyName(): Promise<string> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: "companyName" },
  });
  return setting?.value ?? "EIP";
}

export async function getMaxAttachmentSizeMb(): Promise<number> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: "maxAttachmentSizeMb" },
  });
  const parsed = Number(setting?.value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}
