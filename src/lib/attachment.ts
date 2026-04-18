import { prisma } from "@/lib/prisma";
import { getMaxAttachmentSizeMb } from "@/lib/settings";

export async function upsertAttachment(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  submissionId: string,
  formData: FormData,
) {
  const file = formData.get("attachment");
  if (!(file instanceof File) || file.size === 0) return;

  const maxMb = await getMaxAttachmentSizeMb();
  const maxBytes = maxMb * 1024 * 1024;

  if (file.size > maxBytes) {
    throw new Error(`附件超過 ${maxMb} MB 上限`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  await tx.formAttachment.upsert({
    where: { submissionId },
    create: {
      submissionId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      data: buffer,
    },
    update: {
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      data: buffer,
    },
  });
}
