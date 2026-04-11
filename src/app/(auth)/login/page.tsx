import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginButton } from "./login-button";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="w-full max-w-sm rounded-xl border bg-background p-8 shadow-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">企盉 EIP</h1>
          <p className="text-muted-foreground mt-2">企業資訊入口網站</p>
        </div>
        <LoginButton />
        <p className="text-xs text-center text-muted-foreground mt-6">
          需由管理員建立帳號後才能登入
        </p>
      </div>
    </div>
  );
}
