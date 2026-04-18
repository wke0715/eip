"use server";

import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export async function logLogout() {
  const session = await auth();
  if (!session?.user?.id) return;

  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  await prisma.systemLog.create({
    data: {
      userId: session.user.id,
      action: "USER_LOGOUT",
      detail: session.user.email ?? undefined,
      ipAddress: ip,
    },
  });
}

export async function logoutAction() {
  await logLogout();
  await signOut({ redirectTo: "/login" });
}
