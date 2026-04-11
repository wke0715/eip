import { getSystemSettings } from "@/actions/admin";
import { SettingsForm } from "./settings-form";

export default async function AdminSettingsPage() {
  const settings = await getSystemSettings();

  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">系統設定</h1>
      <SettingsForm settings={settingsMap} />
    </div>
  );
}
