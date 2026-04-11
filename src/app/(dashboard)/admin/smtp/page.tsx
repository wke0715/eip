import { getSmtpConfig } from "@/actions/admin";
import { SmtpForm } from "./smtp-form";

export default async function AdminSmtpPage() {
  const config = await getSmtpConfig();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">SMTP 管理</h1>
      <SmtpForm config={config} />
    </div>
  );
}
