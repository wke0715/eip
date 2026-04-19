import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLeaveTypes, resubmitLeaveRequest } from "@/actions/leave";
import { getMaxAttachmentSizeMb } from "@/lib/settings";
import { toDateStr } from "@/lib/submission-helpers";
import { LeaveForm } from "../../new/leave-form";

const TW_OFFSET_MS = 8 * 60 * 60 * 1000;

function toTimeStr(d: Date) {
  const tw = new Date(d.getTime() + TW_OFFSET_MS);
  const h = String(tw.getUTCHours()).padStart(2, "0");
  const m = tw.getUTCMinutes() === 30 ? "30" : "00";
  return `${h}:${m}`;
}

export default async function ResubmitLeavePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const submission = await prisma.formSubmission.findUnique({
    where: { id },
    include: { leaveRequest: true, attachment: true },
  });

  if (
    !submission ||
    submission.applicantId !== session.user.id ||
    submission.status !== "REJECTED" ||
    !submission.leaveRequest
  ) {
    notFound();
  }

  const lr = submission.leaveRequest;
  const [leaveTypes, maxSizeMb] = await Promise.all([
    getLeaveTypes(),
    getMaxAttachmentSizeMb(),
  ]);

  const defaultValues = {
    formNumber: lr.formNumber,
    leaveTypeId: lr.leaveTypeId,
    startDate: toDateStr(lr.startDate),
    startTime: toTimeStr(lr.startDate),
    endDate: toDateStr(lr.endDate),
    endTime: toTimeStr(lr.endDate),
    reason: lr.reason,
    existingAttachmentName: submission.attachment?.fileName ?? null,
    submissionId: id,
    maxSizeMb,
  };

  const boundAction = resubmitLeaveRequest.bind(null, id);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">修改並重送請假單</h1>
      <LeaveForm
        leaveTypes={leaveTypes}
        defaultValues={defaultValues}
        submitAction={boundAction}
        submitLabel="修改並重送"
      />
    </div>
  );
}
