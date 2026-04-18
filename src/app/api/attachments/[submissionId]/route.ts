import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { submissionId } = await params;

  const attachment = await prisma.formAttachment.findUnique({
    where: { submissionId },
    include: { submission: { select: { applicantId: true } } },
  });

  if (!attachment) {
    return NextResponse.json({ error: "找不到附件" }, { status: 404 });
  }

  const isOwner = attachment.submission.applicantId === session.user.id;
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "無存取權限" }, { status: 403 });
  }

  return new NextResponse(attachment.data, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
    },
  });
}
