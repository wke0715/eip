import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCompanyName } from "@/lib/settings";
import { LoginButton } from "./login-button";
import { DevLoginPanel } from "./dev-login-panel";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/");

  const [companyName, devUsers] = await Promise.all([
    getCompanyName(),
    process.env.NODE_ENV === "production"
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true, email: true, role: true },
          orderBy: [{ role: "asc" }, { name: "asc" }],
        }),
  ]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="w-full max-w-sm rounded-xl border bg-background p-8 shadow-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">{companyName}</h1>
          <p className="text-muted-foreground mt-2">企業資訊入口網站</p>
        </div>
        <LoginButton />
        <p className="text-xs text-center text-muted-foreground mt-6">
          需由管理員建立帳號後才能登入
        </p>
        {process.env.NODE_ENV !== "production" && (
          <div className="mt-6 pt-6 border-t">
            <DevLoginPanel users={devUsers} />
          </div>
        )}
      </div>
    </div>
  );
}
