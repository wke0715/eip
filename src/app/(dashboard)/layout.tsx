import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getCompanyName } from "@/lib/settings";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";
  const companyName = await getCompanyName();

  return (
    <DashboardShell
      user={session.user}
      isAdmin={isAdmin}
      companyName={companyName}
    >
      {children}
    </DashboardShell>
  );
}
