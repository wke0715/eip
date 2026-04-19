import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resubmitOvertimeRequest } from "@/actions/overtime";
import { getMaxAttachmentSizeMb } from "@/lib/settings";
import { OvertimeForm } from "../../new/overtime-form";
import type { OvertimeItemInput } from "@/lib/validators/overtime";

const TW_OFFSET_MS = 8 * 60 * 60 * 1000;

function toDateStr(d: Date) {
  return new Date(d.getTime() + TW_OFFSET_MS).toISOString().slice(0, 10);
}

export default async function ResubmitOvertimePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const submission = await prisma.formSubmission.findUnique({
    where: { id },
    include: {
      overtimeRequest: {
        include: { items: { orderBy: { date: "asc" } } },
      },
      attachment: true,
    },
  });

  if (
    !submission ||
    submission.applicantId !== session.user.id ||
    submission.status !== "REJECTED" ||
    !submission.overtimeRequest ||
    submission.overtimeRequest?.deletedAt !== null
  ) {
    notFound();
  }

  const r = submission.overtimeRequest;

  const items: OvertimeItemInput[] = r.items.map((it) => ({
    date: toDateStr(it.date),
    workerName: it.workerName,
    clientOrWork: it.clientOrWork,
    dayType: it.dayType as OvertimeItemInput["dayType"],
    workTime: it.workTime,
    workHours: it.workHours,
    overtimeHours: it.overtimeHours,
    holidayDoublePay: it.holidayDoublePay,
    overtimePay: it.overtimePay,
  }));

  const boundAction = resubmitOvertimeRequest.bind(null, id);
  const maxSizeMb = await getMaxAttachmentSizeMb();

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold">修改並重送加班單</h1>
      <OvertimeForm
        defaultValues={{
          formNumber: r.formNumber,
          year: r.year,
          month: r.month,
          existingAttachmentName: submission.attachment?.fileName ?? null,
          submissionId: id,
          maxSizeMb,
          items,
        }}
        submitAction={boundAction}
        submitLabel="修改並重送"
      />
    </div>
  );
}
