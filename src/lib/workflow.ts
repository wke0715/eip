import { prisma } from "./prisma";

type TxClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

interface WorkflowStep {
  stepOrder: number;
  approverRole: string;
}

const USER_PREFIX = "USER:";

async function resolveDirectManager(
  tx: TxClient,
  applicantId: string,
  previousApproverId: string | null,
  stepOrder: number,
): Promise<string> {
  if (previousApproverId === null) {
    const applicant = await tx.user.findUnique({
      where: { id: applicantId },
      select: { managerId: true },
    });
    if (!applicant?.managerId) throw new Error("您尚未設定直屬主管，無法送出");
    return applicant.managerId;
  }

  const prev = await tx.user.findUnique({
    where: { id: previousApproverId },
    select: { managerId: true, name: true },
  });
  if (!prev?.managerId) {
    const who = prev?.name ? `（${prev.name}）` : "";
    throw new Error(`第 ${stepOrder - 1} 關簽核者${who}尚未設定直屬主管，無法送出`);
  }
  return prev.managerId;
}

export async function resolveWorkflowApprovers(
  tx: TxClient,
  applicantId: string,
  steps: WorkflowStep[],
): Promise<Array<{ stepOrder: number; approverId: string }>> {
  const result: Array<{ stepOrder: number; approverId: string }> = [];
  let previousApproverId: string | null = null;

  for (const step of steps) {
    let approverId: string | null = null;

    if (step.approverRole === "DIRECT_MANAGER") {
      approverId = await resolveDirectManager(
        tx,
        applicantId,
        previousApproverId,
        step.stepOrder,
      );
    } else if (step.approverRole.startsWith(USER_PREFIX)) {
      approverId = step.approverRole.slice(USER_PREFIX.length);
    }

    if (approverId) {
      result.push({ stepOrder: step.stepOrder, approverId });
      previousApproverId = approverId;
    }
  }

  return result;
}
