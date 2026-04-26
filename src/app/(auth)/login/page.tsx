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
          <svg
            width="48"
            height="48"
            viewBox="0 0 56 56"
            aria-hidden="true"
            className="mx-auto mb-4"
          >
            <g transform="translate(8, 8)">
              <rect
                x="0"
                y="0"
                width="40"
                height="40"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1="0"
                y1="20"
                x2="40"
                y2="20"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1="20"
                y1="20"
                x2="20"
                y2="40"
                stroke="currentColor"
                strokeWidth="2"
              />
              <circle cx="10" cy="10" r="2" fill="currentColor" />
            </g>
          </svg>
          <h1 className="text-3xl font-bold tracking-wide">{companyName}</h1>
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
