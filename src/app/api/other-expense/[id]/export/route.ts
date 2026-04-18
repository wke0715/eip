import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildOtherExpenseWorkbook } from "@/lib/excel/other-expense-exporter";
import * as XLSX from "xlsx";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;

  const submission = await prisma.formSubmission.findUnique({
    where: { id },
    include: {
      otherExpenseRequest: { include: { items: { orderBy: { date: "asc" } } } },
      applicant: { select: { name: true, email: true } },
    },
  });

  if (!submission?.otherExpenseRequest) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const isOwner = submission.applicantId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin)
    return new NextResponse("Forbidden", { status: 403 });

  const r = submission.otherExpenseRequest;
  const wb = buildOtherExpenseWorkbook({
    formNumber: r.formNumber,
    year: r.year,
    month: r.month,
    applicantName: submission.applicant.name ?? submission.applicant.email,
    items: r.items,
    totalAmount: r.totalAmount,
    totalReceipts: r.totalReceipts,
  });

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename = `other-expense-${r.formNumber}.xlsx`;

  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
